import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const appendStatusParam = (urlString: string, status: "connected" | "error") => {
  try {
    const targetUrl = new URL(urlString);
    targetUrl.searchParams.set("googleCalendar", status);
    return targetUrl.toString();
  } catch {
    return null;
  }
};

const buildHtml = ({
  title,
  message,
  accentColor,
  redirectTo,
  messageType,
}: {
  title: string;
  message: string;
  accentColor: string;
  redirectTo: string | null;
  messageType: "google-calendar-connected" | "google-calendar-error";
}) => `<!DOCTYPE html>
<html dir="rtl" lang="ar">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title}</title>
  </head>
  <body style="margin:0;font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f8fafc;display:flex;align-items:center;justify-content:center;min-height:100vh;padding:24px;">
    <div style="width:min(100%,420px);background:#ffffff;border-radius:18px;padding:28px;text-align:center;box-shadow:0 10px 30px rgba(15,23,42,.08);border:1px solid rgba(148,163,184,.2);">
      <div style="width:56px;height:56px;border-radius:999px;background:${accentColor};display:flex;align-items:center;justify-content:center;color:#fff;font-size:24px;margin:0 auto 16px;">
        ${messageType === "google-calendar-connected" ? "✓" : "!"}
      </div>
      <h1 style="margin:0 0 10px;font-size:24px;color:#0f172a;">${title}</h1>
      <p style="margin:0 0 18px;color:#475569;line-height:1.8;">${message}</p>
      ${redirectTo ? `<a href="${redirectTo}" style="display:inline-block;background:${accentColor};color:#fff;text-decoration:none;padding:12px 18px;border-radius:12px;font-weight:700;">العودة إلى لوحة التحكم</a>` : ""}
    </div>
    <script>
      const redirectTo = ${JSON.stringify(redirectTo)};
      const messageType = ${JSON.stringify(messageType)};

      try {
        if (window.opener) {
          window.opener.postMessage({ type: messageType }, '*');
        }
      } catch (_) {}

      if (window.opener) {
        setTimeout(() => window.close(), 1200);
      }

      if (redirectTo) {
        setTimeout(() => window.location.replace(redirectTo), window.opener ? 1400 : 1200);
      }
    </script>
  </body>
</html>`;

Deno.serve(async (req) => {
  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const stateParam = url.searchParams.get("state");

    if (!code || !stateParam) {
      return new Response(buildHtml({
        title: "تعذر إكمال الربط",
        message: "البيانات القادمة من Google غير مكتملة. أعد المحاولة من لوحة التحكم.",
        accentColor: "#dc2626",
        redirectTo: null,
        messageType: "google-calendar-error",
      }), {
        status: 400,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }

    const state = JSON.parse(atob(stateParam));
    const userId = state.userId;
    const redirectTo = typeof state.redirectTo === "string"
      ? appendStatusParam(state.redirectTo, "connected")
      : null;
    const errorRedirectTo = typeof state.redirectTo === "string"
      ? appendStatusParam(state.redirectTo, "error")
      : null;

    const clientId = Deno.env.get("GOOGLE_CLIENT_ID")!;
    const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET")!;
    const redirectUri = `${Deno.env.get("SUPABASE_URL")}/functions/v1/google-calendar-callback`;

    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });

    const tokenData = await tokenRes.json();

    if (!tokenRes.ok || !tokenData.access_token || !userId) {
      console.error("Token exchange failed:", tokenData);
      return new Response(buildHtml({
        title: "فشل الحصول على الصلاحيات",
        message: "تعذر إتمام التفويض من Google. حاول مرة أخرى من لوحة التحكم.",
        accentColor: "#dc2626",
        redirectTo: errorRedirectTo,
        messageType: "google-calendar-error",
      }), {
        status: 400,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: existingToken } = await supabase
      .from("google_calendar_tokens")
      .select("refresh_token")
      .eq("user_id", userId)
      .maybeSingle();

    const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000).toISOString();

    const { error: upsertError } = await supabase
      .from("google_calendar_tokens")
      .upsert(
        {
          user_id: userId,
          access_token: tokenData.access_token,
          refresh_token: tokenData.refresh_token || existingToken?.refresh_token || "",
          token_expires_at: expiresAt,
          calendar_id: "primary",
        },
        { onConflict: "user_id" },
      );

    if (upsertError) {
      console.error("Upsert error:", upsertError);
      return new Response(buildHtml({
        title: "تعذر حفظ الربط",
        message: "حدث خطأ أثناء حفظ بيانات Google Calendar. حاول مرة أخرى.",
        accentColor: "#dc2626",
        redirectTo: errorRedirectTo,
        messageType: "google-calendar-error",
      }), {
        status: 500,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }

    return new Response(buildHtml({
      title: "تم ربط Google Calendar",
      message: "نجح الربط، وستعود الآن إلى لوحة التحكم تلقائياً.",
      accentColor: "#16a34a",
      redirectTo,
      messageType: "google-calendar-connected",
    }), {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  } catch (err) {
    console.error("Callback error:", err);
    return new Response(buildHtml({
      title: "حدث خطأ غير متوقع",
      message: "وقع خلل أثناء إكمال الربط. أعد المحاولة من لوحة التحكم.",
      accentColor: "#dc2626",
      redirectTo: null,
      messageType: "google-calendar-error",
    }), {
      status: 500,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }
});
