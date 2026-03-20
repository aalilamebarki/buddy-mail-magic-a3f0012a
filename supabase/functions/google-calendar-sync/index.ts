import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function refreshAccessToken(refreshToken: string): Promise<{ access_token: string; expires_in: number } | null> {
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const userId = claimsData.claims.sub;
    const adminClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Get user's Google token
    const { data: tokenRow, error: tokenErr } = await adminClient
      .from("google_calendar_tokens")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (tokenErr || !tokenRow) {
      return new Response(JSON.stringify({ error: "Google Calendar غير مربوط" }), { status: 400, headers: corsHeaders });
    }

    // Check if token expired, refresh if needed
    let accessToken = tokenRow.access_token;
    if (new Date(tokenRow.token_expires_at) <= new Date()) {
      const refreshed = await refreshAccessToken(tokenRow.refresh_token);
      if (!refreshed) {
        return new Response(JSON.stringify({ error: "فشل تجديد الرمز. أعد ربط Google Calendar" }), { status: 401, headers: corsHeaders });
      }
      accessToken = refreshed.access_token;
      const newExpiry = new Date(Date.now() + refreshed.expires_in * 1000).toISOString();
      await adminClient.from("google_calendar_tokens").update({
        access_token: accessToken,
        token_expires_at: newExpiry,
      }).eq("user_id", userId);
    }

    // Get upcoming sessions
    const { data: sessions } = await adminClient
      .from("court_sessions")
      .select("*, cases(title, case_number, court, clients(full_name))")
      .eq("user_id", userId)
      .gte("session_date", new Date().toISOString().split("T")[0])
      .order("session_date", { ascending: true });

    if (!sessions || sessions.length === 0) {
      return new Response(JSON.stringify({ synced: 0, message: "لا توجد جلسات مقبلة" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let synced = 0;
    let errors = 0;
    const calendarId = tokenRow.calendar_id || "primary";

    for (const session of sessions) {
      try {
        const clientName = session.cases?.clients?.full_name || "";
        const caseTitle = session.cases?.title || "";
        const caseNumber = session.cases?.case_number || "";
        const court = session.cases?.court || "";

        const summary = `⚖️ ${clientName || caseTitle} - ${caseNumber}`;
        const description = [
          `الملف: ${caseNumber}`,
          `الموكل: ${clientName}`,
          `المحكمة: ${court}`,
          session.court_room ? `القاعة: ${session.court_room}` : "",
          session.required_action ? `الإجراء: ${session.required_action}` : "",
        ].filter(Boolean).join("\n");

        const startTime = session.session_time || "09:00";
        const [hours, minutes] = startTime.split(":").map(Number);
        const endHours = hours + 1;

        const startDateTime = `${session.session_date}T${startTime.padStart(5, "0")}:00`;
        const endDateTime = `${session.session_date}T${String(endHours).padStart(2, "0")}:${String(minutes || 0).padStart(2, "0")}:00`;

        const eventBody = {
          summary,
          description,
          location: court,
          start: { dateTime: startDateTime, timeZone: "Africa/Casablanca" },
          end: { dateTime: endDateTime, timeZone: "Africa/Casablanca" },
          reminders: { useDefault: false, overrides: [{ method: "popup", minutes: 60 }, { method: "popup", minutes: 1440 }] },
        };

        if (session.gcal_event_id) {
          // Update existing event
          const updateRes = await fetch(
            `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events/${session.gcal_event_id}`,
            {
              method: "PUT",
              headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
              body: JSON.stringify(eventBody),
            }
          );
          if (updateRes.ok) {
            synced++;
          } else {
            const errText = await updateRes.text();
            console.error("Update event error:", errText);
            // If event not found, create new
            if (updateRes.status === 404) {
              const createRes = await fetch(
                `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events`,
                {
                  method: "POST",
                  headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
                  body: JSON.stringify(eventBody),
                }
              );
              if (createRes.ok) {
                const newEvent = await createRes.json();
                await adminClient.from("court_sessions").update({ gcal_event_id: newEvent.id }).eq("id", session.id);
                synced++;
              } else {
                errors++;
              }
            } else {
              errors++;
            }
          }
        } else {
          // Create new event
          const createRes = await fetch(
            `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events`,
            {
              method: "POST",
              headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
              body: JSON.stringify(eventBody),
            }
          );
          if (createRes.ok) {
            const newEvent = await createRes.json();
            await adminClient.from("court_sessions").update({ gcal_event_id: newEvent.id }).eq("id", session.id);
            synced++;
          } else {
            const errText = await createRes.text();
            console.error("Create event error:", errText);
            errors++;
          }
        }
      } catch (err) {
        console.error("Session sync error:", err);
        errors++;
      }
    }

    return new Response(
      JSON.stringify({ synced, errors, total: sessions.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Sync error:", err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
  }
});
