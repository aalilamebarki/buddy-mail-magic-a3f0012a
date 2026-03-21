/**
 * apify-mahakim-webhook — Webhook receiver for Apify Actor results
 * 
 * يستقبل نتائج Apify Actor بعد اكتمال جلب بيانات الملف من بوابة محاكم
 * ويحدث قاعدة البيانات تلقائياً (إجراءات، جلسات، بيانات القاضي)
 * 
 * ─── Flow ───
 * 1. Apify Actor completes → calls this webhook with results
 * 2. We parse the scraped data
 * 3. Update cases, case_procedures, court_sessions
 * 4. Update mahakim_sync_jobs status
 * 5. Supabase Realtime pushes changes to the lawyer's screen
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { jobId, caseId, userId, caseNumber, results, error: apifyError } = body;

    if (!jobId || !caseId) {
      return new Response(JSON.stringify({ error: 'Missing jobId or caseId' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // ── Handle Apify error ──
    if (apifyError || !results) {
      const errMsg = apifyError || 'لم يتم استلام نتائج من Apify';
      await supabase.from('mahakim_sync_jobs').update({
        status: 'failed',
        error_message: errMsg,
        completed_at: new Date().toISOString(),
      }).eq('id', jobId);

      // Create failure notification
      await createNotification(supabase, userId, caseId, caseNumber,
        `فشل المزامنة التلقائية للملف ${caseNumber}: ${errMsg}`);

      return new Response(JSON.stringify({ status: 'failed', error: errMsg }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── Parse Apify results ──
    const { caseInfo = {}, procedures = [], nextSessionDate } = results;

    // Handle "not found" — no data returned from portal
    const isEmptyResult = !caseInfo.judge && !caseInfo.department && !caseInfo.status && procedures.length === 0;

    // 1. Update case metadata
    const caseUpdate: Record<string, unknown> = {
      last_synced_at: new Date().toISOString(),
      last_sync_result: { caseInfo, procedures, _provider: 'apify', empty: isEmptyResult },
    };

    if (isEmptyResult) {
      caseUpdate.mahakim_status = 'لا يزال غير موجود';
    }
    if (caseInfo.judge) caseUpdate.mahakim_judge = caseInfo.judge;
    if (caseInfo.department) caseUpdate.mahakim_department = caseInfo.department;
    if (caseInfo.status) caseUpdate.mahakim_status = caseInfo.status;
    if (caseInfo.court) caseUpdate.court = caseInfo.court;

    await supabase.from('cases').update(caseUpdate).eq('id', caseId);

    // 2. Insert procedures (deduplicated)
    let newProcsCount = 0;
    if (procedures.length > 0) {
      const { data: existing } = await supabase
        .from('case_procedures')
        .select('action_date, action_type')
        .eq('case_id', caseId)
        .eq('source', 'mahakim');

      const existingKeys = new Set(
        (existing || []).map((p: any) => `${p.action_date}|${p.action_type}`)
      );

      const newProcs = procedures
        .filter((p: any) => !existingKeys.has(`${p.action_date}|${p.action_type}`))
        .map((p: any) => ({
          case_id: caseId,
          action_date: p.action_date || null,
          action_type: p.action_type || '',
          decision: p.decision || null,
          next_session_date: p.next_session_date || null,
          source: 'mahakim',
          is_manual: false,
        }));

      if (newProcs.length > 0) {
        await supabase.from('case_procedures').insert(newProcs);
        newProcsCount = newProcs.length;
      }
    }

    // 3. Schedule future court sessions
    let newSessionsCount = 0;
    if (userId) {
      const now = new Date();
      now.setHours(0, 0, 0, 0);
      const futureSessionMap = new Map<string, { time: string; room: string }>();

      for (const proc of procedures) {
        const parsed = parseDateField(proc.next_session_date, now);
        if (parsed) {
          if (!futureSessionMap.has(parsed.dateKey)) {
            futureSessionMap.set(parsed.dateKey, { time: parsed.time, room: parsed.room });
          }
        }
      }

      if (nextSessionDate && !futureSessionMap.has(nextSessionDate)) {
        futureSessionMap.set(nextSessionDate, { time: '', room: '' });
      }

      if (futureSessionMap.size > 0) {
        const { data: existingSessions } = await supabase
          .from('court_sessions')
          .select('id, session_date, session_time, court_room')
          .eq('case_id', caseId);

        const existingByDate = new Map(
          (existingSessions || []).map((s: any) => [s.session_date, s])
        );

        const newSessions: any[] = [];
        for (const [d, info] of futureSessionMap.entries()) {
          if (!existingByDate.has(d)) {
            newSessions.push({
              case_id: caseId,
              session_date: d,
              user_id: userId,
              required_action: '',
              notes: 'تم الجلب تلقائياً من بوابة محاكم',
              status: 'scheduled',
              session_time: info.time || null,
              court_room: info.room || null,
            });
          } else {
            // Update time/room if changed
            const existing = existingByDate.get(d);
            const needsUpdate = (info.time && info.time !== existing.session_time) ||
                                (info.room && info.room !== existing.court_room);
            if (needsUpdate) {
              const upd: Record<string, unknown> = {};
              if (info.time) upd.session_time = info.time;
              if (info.room) upd.court_room = info.room;
              await supabase.from('court_sessions').update(upd).eq('id', existing.id);
            }
          }
        }

        if (newSessions.length > 0) {
          await supabase.from('court_sessions').insert(newSessions);
          newSessionsCount = newSessions.length;
        }
      }
    }

    // 4. Update sync job as completed
    await supabase.from('mahakim_sync_jobs').update({
      status: 'completed',
      result_data: { ...caseInfo, _provider: 'apify', procedures_count: procedures.length },
      next_session_date: nextSessionDate || null,
      completed_at: new Date().toISOString(),
    }).eq('id', jobId);

    // 5. Create success notification
    const summary = `تم جلب إجراءات الملف ${caseNumber} تلقائياً ✅ (${newProcsCount} إجراء${newSessionsCount > 0 ? ` + ${newSessionsCount} جلسة` : ''})`;
    await createNotification(supabase, userId, caseId, caseNumber, summary);

    console.log(`✅ Apify webhook processed: ${caseNumber} — ${procedures.length} procedures, ${newSessionsCount} sessions`);

    return new Response(JSON.stringify({
      status: 'success',
      procedures_added: newProcsCount,
      sessions_added: newSessionsCount,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error('[apify-webhook] Fatal:', error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : 'Unknown error',
    }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});

/** Parse composite date field like "dd/mm/yyyy على الساعة HH:MM بالقاعة ..." */
function parseDateField(raw: string | undefined, now: Date): { dateKey: string; time: string; room: string } | null {
  if (!raw) return null;
  const m = raw.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (!m) return null;
  const [, day, month, year] = m;
  const dateObj = new Date(`${year}-${month}-${day}`);
  if (isNaN(dateObj.getTime()) || dateObj < now) return null;
  const tm = raw.match(/(?:الساعة\s*)?(\d{1,2}:\d{2})/);
  const rm = raw.match(/(?:بالقاعة|القاعة|غرفة)\s*(.+?)$/);
  return {
    dateKey: `${year}-${month}-${day}`,
    time: tm ? tm[1] : '',
    room: rm ? rm[1].trim() : '',
  };
}

/** Create a notification for the user */
async function createNotification(
  supabase: ReturnType<typeof createClient>,
  userId: string | undefined,
  caseId: string,
  caseNumber: string,
  message: string,
) {
  if (!userId) return;
  try {
    // Need a session_id for notification
    const { data: session } = await supabase
      .from('court_sessions')
      .select('id')
      .eq('case_id', caseId)
      .order('created_at', { ascending: false })
      .limit(1);

    if (!session?.[0]?.id) return;

    await supabase.from('notifications').insert({
      user_id: userId,
      case_id: caseId,
      session_id: session[0].id,
      message,
      is_read: false,
    });
  } catch (e) {
    console.error('Failed to create notification:', e);
  }
}
