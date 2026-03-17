import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const today = new Date().toISOString().split("T")[0];

    // Find all court sessions that have passed (session_date < today)
    // where the case does NOT have any future session scheduled
    // and the case is NOT archived
    const { data: pastSessions, error: sessError } = await supabase
      .from("court_sessions")
      .select("id, case_id, session_date, user_id, cases!inner(title, case_number, status)")
      .lt("session_date", today)
      .neq("cases.status", "archived")
      .order("session_date", { ascending: false });

    if (sessError) throw sessError;

    if (!pastSessions || pastSessions.length === 0) {
      return new Response(JSON.stringify({ message: "No pending sessions found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Group by case_id to find cases with no future session
    const caseIds = [...new Set(pastSessions.map((s: any) => s.case_id))];

    // Check which cases have future sessions
    const { data: futureSessions, error: futErr } = await supabase
      .from("court_sessions")
      .select("case_id")
      .in("case_id", caseIds)
      .gte("session_date", today);

    if (futErr) throw futErr;

    const casesWithFuture = new Set((futureSessions || []).map((s: any) => s.case_id));

    // Filter to cases that have NO future session
    const casesNeedingAlert = pastSessions.filter(
      (s: any) => !casesWithFuture.has(s.case_id)
    );

    // Deduplicate by case_id - keep the most recent past session per case
    const latestPerCase = new Map<string, any>();
    for (const s of casesNeedingAlert) {
      if (!latestPerCase.has(s.case_id) || s.session_date > latestPerCase.get(s.case_id).session_date) {
        latestPerCase.set(s.case_id, s);
      }
    }

    let insertedCount = 0;

    for (const [, session] of latestPerCase) {
      const caseInfo = session.cases as any;
      const caseLabel = caseInfo.case_number
        ? `${caseInfo.title} (${caseInfo.case_number})`
        : caseInfo.title;

      // Check if we already sent a notification today for this case
      const { data: existing } = await supabase
        .from("notifications")
        .select("id")
        .eq("case_id", session.case_id)
        .eq("user_id", session.user_id)
        .gte("created_at", `${today}T00:00:00`)
        .limit(1);

      if (existing && existing.length > 0) continue;

      const message = `الملف "${caseLabel}" لم يتم تعيين جلسة مقبلة له بعد جلسة ${session.session_date}. يرجى تحديد موعد الجلسة القادمة.`;

      const { error: insErr } = await supabase.from("notifications").insert({
        user_id: session.user_id,
        case_id: session.case_id,
        session_id: session.id,
        message,
      });

      if (!insErr) insertedCount++;
    }

    return new Response(
      JSON.stringify({ message: `Inserted ${insertedCount} notifications` }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
