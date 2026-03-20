import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/* ── helpers ─────────────────────────────────────────────── */

async function refreshAccessToken(
  refreshToken: string,
): Promise<{ access_token: string; expires_in: number } | null> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: Deno.env.get("GOOGLE_CLIENT_ID")!,
      client_secret: Deno.env.get("GOOGLE_CLIENT_SECRET")!,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) return null;
  return await res.json();
}

function extractDateAndTime(dateTime: string | undefined, date: string | undefined) {
  if (dateTime) {
    // "2026-03-26T10:00:00+01:00" → date = "2026-03-26", time = "10:00"
    const d = new Date(dateTime);
    const sessionDate = d.toISOString().split("T")[0];
    const sessionTime = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
    return { sessionDate, sessionTime };
  }
  if (date) {
    return { sessionDate: date, sessionTime: null };
  }
  return null;
}

/* ── main ────────────────────────────────────────────────── */

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Determine scope: single user (authenticated call) or all users (cron)
    let userIds: string[] = [];

    const authHeader = req.headers.get("Authorization");
    if (authHeader?.startsWith("Bearer ")) {
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: authHeader } } },
      );
      const token = authHeader.replace("Bearer ", "");
      const { data: claimsData } = await supabase.auth.getClaims(token);
      if (claimsData?.claims?.sub) {
        userIds = [claimsData.claims.sub as string];
      }
    }

    // If no authenticated user, process all connected users (cron mode)
    if (userIds.length === 0) {
      const { data: allTokens } = await adminClient
        .from("google_calendar_tokens")
        .select("user_id");
      if (!allTokens || allTokens.length === 0) {
        return new Response(
          JSON.stringify({ message: "No connected users", updated: 0 }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      userIds = allTokens.map((t) => t.user_id);
    }

    let totalUpdated = 0;
    let totalErrors = 0;

    for (const userId of userIds) {
      try {
        // Get token
        const { data: tokenRow } = await adminClient
          .from("google_calendar_tokens")
          .select("*")
          .eq("user_id", userId)
          .maybeSingle();

        if (!tokenRow) continue;

        // Refresh if expired
        let accessToken = tokenRow.access_token;
        if (new Date(tokenRow.token_expires_at) <= new Date()) {
          const refreshed = await refreshAccessToken(tokenRow.refresh_token);
          if (!refreshed) {
            console.error(`Failed to refresh token for user ${userId}`);
            totalErrors++;
            continue;
          }
          accessToken = refreshed.access_token;
          await adminClient
            .from("google_calendar_tokens")
            .update({
              access_token: accessToken,
              token_expires_at: new Date(
                Date.now() + refreshed.expires_in * 1000,
              ).toISOString(),
            })
            .eq("user_id", userId);
        }

        // Get sessions that have gcal_event_id
        const { data: sessions } = await adminClient
          .from("court_sessions")
          .select("id, session_date, session_time, gcal_event_id")
          .eq("user_id", userId)
          .not("gcal_event_id", "is", null);

        if (!sessions || sessions.length === 0) continue;

        const calendarId = tokenRow.calendar_id || "primary";

        for (const session of sessions) {
          if (!session.gcal_event_id) continue;

          try {
            const eventRes = await fetch(
              `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(session.gcal_event_id)}`,
              {
                headers: { Authorization: `Bearer ${accessToken}` },
              },
            );

            if (!eventRes.ok) {
              if (eventRes.status === 404 || eventRes.status === 410) {
                // Event deleted in Google → mark session
                console.log(`Event ${session.gcal_event_id} deleted in Google, clearing gcal_event_id`);
                await adminClient
                  .from("court_sessions")
                  .update({ gcal_event_id: null })
                  .eq("id", session.id);
                totalUpdated++;
              }
              continue;
            }

            const event = await eventRes.json();

            // If event cancelled in Google
            if (event.status === "cancelled") {
              await adminClient
                .from("court_sessions")
                .update({ gcal_event_id: null })
                .eq("id", session.id);
              totalUpdated++;
              continue;
            }

            // Extract updated date/time from Google event
            const extracted = extractDateAndTime(
              event.start?.dateTime,
              event.start?.date,
            );
            if (!extracted) continue;

            const { sessionDate, sessionTime } = extracted;

            // Compare and update if changed
            const dateChanged = sessionDate !== session.session_date;
            const timeChanged =
              sessionTime !== null && sessionTime !== (session.session_time || "");

            if (dateChanged || timeChanged) {
              const updatePayload: Record<string, string> = {};
              if (dateChanged) updatePayload.session_date = sessionDate;
              if (timeChanged && sessionTime) updatePayload.session_time = sessionTime;

              await adminClient
                .from("court_sessions")
                .update(updatePayload)
                .eq("id", session.id);

              console.log(
                `Updated session ${session.id}: date ${session.session_date} → ${sessionDate}, time ${session.session_time} → ${sessionTime}`,
              );
              totalUpdated++;
            }
          } catch (eventErr) {
            console.error(`Error processing event ${session.gcal_event_id}:`, eventErr);
            totalErrors++;
          }
        }
      } catch (userErr) {
        console.error(`Error processing user ${userId}:`, userErr);
        totalErrors++;
      }
    }

    return new Response(
      JSON.stringify({
        updated: totalUpdated,
        errors: totalErrors,
        users_processed: userIds.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Reverse sync error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
