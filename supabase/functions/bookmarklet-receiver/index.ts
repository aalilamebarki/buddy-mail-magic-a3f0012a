/**
 * bookmarklet-receiver — Edge Function
 * 
 * Receives scraped data from the browser bookmarklet.
 * The bookmarklet runs on mahakim.ma in the lawyer's browser,
 * extracts DOM data, and POSTs it here.
 * 
 * This is 100% free — no proxy, no API, no quota.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { caseNumber, userId, caseInfo, procedures, allLabels, rawText } = body;

    console.log('[bookmarklet] Received data for case:', caseNumber, '| procedures:', procedures?.length);

    if (!caseNumber) {
      return new Response(JSON.stringify({ error: 'رقم الملف مطلوب' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Find the case by case_number
    const { data: caseRow, error: caseErr } = await supabase
      .from('cases')
      .select('id, assigned_to')
      .eq('case_number', caseNumber)
      .maybeSingle();

    if (caseErr || !caseRow) {
      return new Response(JSON.stringify({
        error: `لم يتم العثور على ملف برقم ${caseNumber}`,
        hint: 'تأكد من تسجيل الملف في النظام أولاً',
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const caseId = caseRow.id;
    let resolvedUserId = userId || caseRow.assigned_to;

    // إذا لم يتم تحديد المستخدم، نبحث في آخر مهمة مزامنة أو أول director
    if (!resolvedUserId) {
      const { data: lastJob } = await supabase
        .from('mahakim_sync_jobs')
        .select('user_id')
        .eq('case_id', caseId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (lastJob?.user_id) {
        resolvedUserId = lastJob.user_id;
      } else {
        // احتياط: أول director في النظام
        const { data: director } = await supabase
          .from('user_roles')
          .select('user_id')
          .eq('role', 'director')
          .limit(1)
          .maybeSingle();
        if (director?.user_id) resolvedUserId = director.user_id;
      }
    }
    console.log('[bookmarklet] resolvedUserId:', resolvedUserId);
    const parsedCaseInfo = caseInfo || {};
    const parsedProcedures = procedures || [];

    // 1. Update case metadata
    const caseUpdate: Record<string, unknown> = {
      last_synced_at: new Date().toISOString(),
      last_sync_result: {
        caseInfo: parsedCaseInfo,
        procedures: parsedProcedures,
        allLabels: allLabels || {},
        rawText: (rawText || '').substring(0, 10000),
        _provider: 'bookmarklet',
        _timestamp: new Date().toISOString(),
      },
    };

    if (parsedCaseInfo.judge) caseUpdate.mahakim_judge = parsedCaseInfo.judge;
    if (parsedCaseInfo.department) caseUpdate.mahakim_department = parsedCaseInfo.department;
    if (parsedCaseInfo.status) caseUpdate.mahakim_status = parsedCaseInfo.status;
    if (parsedCaseInfo.court) caseUpdate.court = parsedCaseInfo.court;

    await supabase.from('cases').update(caseUpdate).eq('id', caseId);

    // 2. Insert procedures (deduplicated)
    let newProcsCount = 0;
    if (parsedProcedures.length > 0) {
      const { data: existing } = await supabase
        .from('case_procedures')
        .select('action_date, action_type')
        .eq('case_id', caseId)
        .eq('source', 'mahakim');

      const existingKeys = new Set(
        (existing || []).map((p: any) => `${p.action_date}|${p.action_type}`)
      );

      const newProcs = parsedProcedures
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

    // 3. Extract and insert future court sessions
    let newSessionsCount = 0;
    if (resolvedUserId) {
      const now = new Date();
      now.setHours(0, 0, 0, 0);
      const dateRegex = /(\d{2})\/(\d{2})\/(\d{4})|(\d{4})-(\d{2})-(\d{2})/;
      const futureDates = new Map<string, { time: string; room: string }>();

      const tryAddDate = (raw: string | undefined | null) => {
        if (!raw || typeof raw !== 'string') return;
        const match = raw.match(dateRegex);
        if (!match) return;
        let dateKey: string;
        if (match[4]) {
          dateKey = `${match[4]}-${match[5]}-${match[6]}`;
        } else {
          dateKey = `${match[3]}-${match[2]}-${match[1]}`;
        }
        const d = new Date(`${dateKey}T00:00:00`);
        if (!isNaN(d.getTime()) && d >= now && !futureDates.has(dateKey)) {
          const timeMatch = raw.match(/(\d{1,2}:\d{2})/);
          const roomMatch = raw.match(/(?:القاعة|بالقاعة|غرفة)\s*(.+?)$/);
          futureDates.set(dateKey, {
            time: timeMatch ? timeMatch[1] : '',
            room: roomMatch ? roomMatch[1].trim() : '',
          });
        }
      };

      for (const proc of parsedProcedures) {
        tryAddDate(proc.next_session_date);
        tryAddDate(proc.action_date);
      }

      if (futureDates.size > 0) {
        const { data: existingSessions } = await supabase
          .from('court_sessions')
          .select('session_date')
          .eq('case_id', caseId);

        const existingDates = new Set((existingSessions || []).map((s: any) => s.session_date));

        const newSessions = [...futureDates.entries()]
          .filter(([d]) => !existingDates.has(d))
          .map(([d, info]) => ({
            case_id: caseId,
            session_date: d,
            user_id: resolvedUserId,
            required_action: '',
            notes: 'تم الجلب من المتصفح (Bookmarklet)',
            status: 'scheduled',
            session_time: info.time || null,
            court_room: info.room || null,
          }));

        if (newSessions.length > 0) {
          await supabase.from('court_sessions').insert(newSessions);
          newSessionsCount = newSessions.length;
        }
      }
    }

    // 4. Create notification
    if (resolvedUserId) {
      const msg = `تم جلب بيانات الملف ${caseNumber} من المتصفح ✅ (${newProcsCount} إجراء${newSessionsCount > 0 ? ` + ${newSessionsCount} جلسة` : ''})`;
      await supabase.from('notifications').insert({
        user_id: resolvedUserId,
        case_id: caseId,
        message: msg,
        is_read: false,
      }).catch(() => {});
    }

    // 5. Update any pending sync job
    await supabase.from('mahakim_sync_jobs')
      .update({
        status: 'completed',
        result_data: { _provider: 'bookmarklet', procedures_count: parsedProcedures.length },
        completed_at: new Date().toISOString(),
      })
      .eq('case_id', caseId)
      .in('status', ['pending', 'scraping', 'failed']);

    console.log(`✅ Bookmarklet: ${caseNumber} — ${newProcsCount} new procedures, ${newSessionsCount} sessions`);

    return new Response(JSON.stringify({
      success: true,
      message: `تم استيراد ${newProcsCount} إجراء${newSessionsCount > 0 ? ` و ${newSessionsCount} جلسة` : ''} بنجاح ✅`,
      procedures_added: newProcsCount,
      sessions_added: newSessionsCount,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[bookmarklet] Error:', error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : 'خطأ غير متوقع',
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
