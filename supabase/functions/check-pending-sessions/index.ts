import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const AUTO_SESSION_NOTE = "تم الجلب تلقائياً من بوابة محاكم";
const AUTO_REVIEW_PREFIX = "المراجعة الآلية للجلسات";
const PAGE_SIZE = 500;
const CHUNK_SIZE = 200;
const RETRY_COOLDOWN_MINUTES = 30;
const EMPTY_RESULT_RETRY_MINUTES = 30 * 60; // 30 hours in minutes

type CaseRow = {
  id: string;
  title: string;
  case_number: string | null;
  assigned_to: string | null;
  last_sync_result: Record<string, unknown> | null;
  last_synced_at: string | null;
  status: string;
};

type SessionRow = {
  id: string;
  case_id: string;
  session_date: string;
  session_time: string | null;
  court_room: string | null;
  user_id: string;
};

type JobRow = {
  id: string;
  case_id: string;
  user_id: string;
  case_number: string;
  status: string;
  created_at: string;
  request_payload: Record<string, unknown> | null;
};

type ParsedSession = {
  dateKey: string;
  time: string;
  room: string;
};

function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) chunks.push(items.slice(index, index + size));
  return chunks;
}

function minutesSince(dateLike: string | null | undefined): number {
  if (!dateLike) return Number.POSITIVE_INFINITY;
  const timestamp = new Date(dateLike).getTime();
  if (Number.isNaN(timestamp)) return Number.POSITIVE_INFINITY;
  return (Date.now() - timestamp) / 60000;
}

function parseDateField(raw: unknown, today: Date): ParsedSession | null {
  if (typeof raw !== "string") return null;
  const text = raw.trim();
  if (!text) return null;

  let dateKey: string | null = null;
  const slashMatch = text.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  const isoMatch = text.match(/(\d{4})-(\d{2})-(\d{2})/);

  if (slashMatch) {
    const [, day, month, year] = slashMatch;
    dateKey = `${year}-${month}-${day}`;
  } else if (isoMatch) {
    const [, year, month, day] = isoMatch;
    dateKey = `${year}-${month}-${day}`;
  }

  if (!dateKey) return null;

  const dateObj = new Date(`${dateKey}T00:00:00`);
  if (Number.isNaN(dateObj.getTime()) || dateObj < today) return null;

  const timeMatch = text.match(/(?:الساعة\s*)?(\d{1,2}:\d{2})/);
  const roomMatch = text.match(/(?:بالقاعة|القاعة|غرفة)\s*(.+?)$/);

  return {
    dateKey,
    time: timeMatch?.[1] || "",
    room: roomMatch?.[1]?.trim() || "",
  };
}

function extractFutureSessions(lastSyncResult: Record<string, unknown> | null, today: Date): ParsedSession[] {
  if (!lastSyncResult) return [];

  const futureSessions = new Map<string, ParsedSession>();
  const addCandidate = (raw: unknown, fallback?: Partial<ParsedSession>) => {
    const parsed = parseDateField(raw, today);
    if (!parsed) return;
    const existing = futureSessions.get(parsed.dateKey);
    futureSessions.set(parsed.dateKey, {
      dateKey: parsed.dateKey,
      time: parsed.time || fallback?.time || existing?.time || "",
      room: parsed.room || fallback?.room || existing?.room || "",
    });
  };

  const procedures = Array.isArray(lastSyncResult.procedures)
    ? (lastSyncResult.procedures as Record<string, unknown>[])
    : [];

  for (const procedure of procedures) {
    const fallback = {
      time: typeof procedure.session_time === "string" ? procedure.session_time : "",
      room: typeof procedure.court_room === "string" ? procedure.court_room : "",
    };

    addCandidate(procedure.next_session_date, fallback);
    addCandidate(procedure.court_room, fallback);
    addCandidate(procedure.action_date, fallback);
    addCandidate(procedure.decision, fallback);
    addCandidate(procedure.action_type, fallback);
  }

  const caseInfo = typeof lastSyncResult.caseInfo === "object" && lastSyncResult.caseInfo !== null
    ? (lastSyncResult.caseInfo as Record<string, unknown>)
    : {};

  const allLabels = typeof lastSyncResult.allLabels === "object" && lastSyncResult.allLabels !== null
    ? (lastSyncResult.allLabels as Record<string, unknown>)
    : {};

  [
    lastSyncResult.nextSessionDate,
    lastSyncResult.next_session_date,
    caseInfo.next_hearing,
    caseInfo.next_session_date,
    allLabels["الجلسة المقبلة"],
    allLabels["تاريخ الجلسة المقبلة"],
    allLabels["جلسة مقبلة"],
  ].forEach((value) => addCandidate(value));

  return Array.from(futureSessions.values()).sort((a, b) => a.dateKey.localeCompare(b.dateKey));
}

async function fetchAllCases(supabase: ReturnType<typeof createClient>): Promise<CaseRow[]> {
  const rows: CaseRow[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("cases")
      .select("id, title, case_number, assigned_to, last_sync_result, last_synced_at, status")
      .neq("status", "archived")
      .range(from, from + PAGE_SIZE - 1);

    if (error) throw error;
    const batch = (data || []) as CaseRow[];
    rows.push(...batch);
    if (batch.length < PAGE_SIZE) break;
  }
  return rows.filter((row) => !!row.case_number?.trim());
}

async function fetchSessionsByCase(supabase: ReturnType<typeof createClient>, caseIds: string[]) {
  const rows: SessionRow[] = [];
  for (const ids of chunkArray(caseIds, CHUNK_SIZE)) {
    const { data, error } = await supabase
      .from("court_sessions")
      .select("id, case_id, session_date, session_time, court_room, user_id")
      .in("case_id", ids);

    if (error) throw error;
    rows.push(...((data || []) as SessionRow[]));
  }

  const byCase = new Map<string, SessionRow[]>();
  for (const row of rows) {
    const current = byCase.get(row.case_id) || [];
    current.push(row);
    byCase.set(row.case_id, current);
  }
  return byCase;
}

async function fetchLatestJobsByCase(supabase: ReturnType<typeof createClient>, caseIds: string[]) {
  const rows: JobRow[] = [];
  for (const ids of chunkArray(caseIds, CHUNK_SIZE)) {
    const { data, error } = await supabase
      .from("mahakim_sync_jobs")
      .select("id, case_id, user_id, case_number, status, created_at, request_payload")
      .in("case_id", ids)
      .order("created_at", { ascending: false });

    if (error) throw error;
    rows.push(...((data || []) as JobRow[]));
  }

  const latestByCase = new Map<string, JobRow>();
  for (const row of rows) {
    if (!latestByCase.has(row.case_id)) latestByCase.set(row.case_id, row);
  }
  return latestByCase;
}

async function createCaseNotification(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  caseId: string,
  todayKey: string,
  message: string,
) {
  const { data: existing, error: existingError } = await supabase
    .from("notifications")
    .select("id")
    .eq("case_id", caseId)
    .eq("user_id", userId)
    .gte("created_at", `${todayKey}T00:00:00`)
    .ilike("message", `${AUTO_REVIEW_PREFIX}%`)
    .limit(1);

  if (existingError) throw existingError;
  if (existing && existing.length > 0) return false;

  const { error } = await supabase.from("notifications").insert({
    user_id: userId,
    case_id: caseId,
    session_id: null,
    message,
    is_read: false,
  });

  if (error) throw error;
  return true;
}

async function launchBackgroundSync(
  supabase: ReturnType<typeof createClient>,
  supabaseUrl: string,
  anonKey: string,
  caseRow: CaseRow,
  userId: string,
  latestJob?: JobRow,
) {
  const jobId = crypto.randomUUID();
  const requestPayload = latestJob?.request_payload || {};

  const { error: insertError } = await supabase.from("mahakim_sync_jobs").insert({
    id: jobId,
    case_id: caseRow.id,
    user_id: userId,
    case_number: caseRow.case_number!,
    status: "pending",
    request_payload: requestPayload,
  });

  if (insertError) throw insertError;

  const response = await fetch(`${supabaseUrl}/functions/v1/fetch-dossier`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${anonKey}`,
      apikey: anonKey,
    },
    body: JSON.stringify({
      action: "submitSyncJob",
      jobId,
      caseId: caseRow.id,
      userId,
      caseNumber: caseRow.case_number,
      appealCourt: typeof requestPayload.appealCourt === "string" ? requestPayload.appealCourt : undefined,
      firstInstanceCourt: typeof requestPayload.firstInstanceCourt === "string" ? requestPayload.firstInstanceCourt : undefined,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`فشل تشغيل إعادة المزامنة: ${text.substring(0, 200)}`);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayKey = today.toISOString().split("T")[0];

    const cases = await fetchAllCases(supabase);
    if (cases.length === 0) {
      return new Response(JSON.stringify({ checked_cases: 0, created_sessions: 0, retried_syncs: 0, notifications: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const caseIds = cases.map((row) => row.id);
    const [sessionsByCase, latestJobByCase] = await Promise.all([
      fetchSessionsByCase(supabase, caseIds),
      fetchLatestJobsByCase(supabase, caseIds),
    ]);

    let createdSessions = 0;
    let retriedSyncs = 0;
    let notifications = 0;

    for (const caseRow of cases) {
      const caseSessions = sessionsByCase.get(caseRow.id) || [];
      const hasFutureSession = caseSessions.some((session) => session.session_date >= todayKey);
      if (hasFutureSession) continue;

      const latestJob = latestJobByCase.get(caseRow.id);
      const userId = caseRow.assigned_to || latestJob?.user_id || caseSessions[0]?.user_id || null;
      const caseLabel = caseRow.case_number ? `${caseRow.title} (${caseRow.case_number})` : caseRow.title;

      const extractedSessions = extractFutureSessions(caseRow.last_sync_result, today);
      const existingDates = new Set(caseSessions.map((session) => session.session_date));
      const sessionsToInsert = extractedSessions.filter((session) => !existingDates.has(session.dateKey));

      if (userId && sessionsToInsert.length > 0) {
        const { error: insertError } = await supabase.from("court_sessions").insert(
          sessionsToInsert.map((session) => ({
            case_id: caseRow.id,
            user_id: userId,
            session_date: session.dateKey,
            session_time: session.time || null,
            court_room: session.room || null,
            required_action: "",
            status: "scheduled",
            notes: AUTO_SESSION_NOTE,
          })),
        );

        if (!insertError) {
          createdSessions += sessionsToInsert.length;
          continue;
        }
      }

      let didRetry = false;
      const latestActivityAt = latestJob?.created_at || caseRow.last_synced_at;
      const canRetry = !!userId
        && !!caseRow.case_number
        && !["pending", "scraping"].includes(latestJob?.status || "")
        && minutesSince(latestActivityAt) >= RETRY_COOLDOWN_MINUTES;

      if (canRetry) {
        try {
          await launchBackgroundSync(supabase, supabaseUrl, anonKey, caseRow, userId, latestJob);
          retriedSyncs += 1;
          didRetry = true;
        } catch (error) {
          console.error("[check-pending-sessions] retry failed", caseRow.case_number, error);
        }
      }

      if (!userId) continue;

      const message = didRetry
        ? `${AUTO_REVIEW_PREFIX}: الملف "${caseLabel}" غير مُدرج حالياً في الجلسات، وتمت إعادة محاولة الجلب والإدراج تلقائياً.`
        : `${AUTO_REVIEW_PREFIX}: الملف "${caseLabel}" غير مُدرج حالياً في الجلسات بعد آخر مزامنة، ويحتاج مراجعة.`;

      const created = await createCaseNotification(supabase, userId, caseRow.id, todayKey, message);
      if (created) notifications += 1;
    }

    return new Response(JSON.stringify({
      checked_cases: cases.length,
      created_sessions: createdSessions,
      retried_syncs: retriedSyncs,
      notifications,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("[check-pending-sessions] fatal", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
