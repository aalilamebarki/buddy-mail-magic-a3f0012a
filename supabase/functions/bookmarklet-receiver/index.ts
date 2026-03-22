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

    // 2. Delete old mahakim procedures then insert fresh data
    let newProcsCount = 0;
    await supabase
      .from('case_procedures')
      .delete()
      .eq('case_id', caseId)
      .eq('source', 'mahakim')
      .eq('is_manual', false);

    if (parsedProcedures.length > 0) {
      const newProcs = parsedProcedures.map((p: any) => ({
        case_id: caseId,
        action_date: p.action_date || null,
        action_type: p.action_type || '',
        decision: p.decision || null,
        next_session_date: p.next_session_date || null,
        source: 'mahakim',
        is_manual: false,
      }));

      await supabase.from('case_procedures').insert(newProcs);
      newProcsCount = newProcs.length;
    }

    // 3. Upsert only the next upcoming court session
    let newSessionsCount = 0;
    if (resolvedUserId) {
      const now = new Date();
      now.setHours(0, 0, 0, 0);

      const parseCandidate = (raw: string | undefined | null): { dateKey: string; time: string; room: string } | null => {
        if (!raw || typeof raw !== 'string') return null;
        const text = raw.trim();
        if (!text) return null;

        const slashMatch = text.match(/(\d{2})\/(\d{2})\/(\d{4})/);
        const isoMatch = text.match(/(\d{4})-(\d{2})-(\d{2})/);
        let dateKey: string | null = null;

        if (slashMatch) {
          const [, day, month, year] = slashMatch;
          dateKey = `${year}-${month}-${day}`;
        } else if (isoMatch) {
          const [, year, month, day] = isoMatch;
          dateKey = `${year}-${month}-${day}`;
        }

        if (!dateKey) return null;
        const dateObj = new Date(`${dateKey}T00:00:00`);
        if (isNaN(dateObj.getTime()) || dateObj < now) return null;

        const timeMatch = text.match(/(?:الساعة\s*)?(\d{1,2}:\d{2})/);
        const roomMatch = text.match(/(?:القاعة|بالقاعة|غرفة)\s*(.+?)$/);
        return {
          dateKey,
          time: timeMatch ? timeMatch[1] : '',
          room: roomMatch ? roomMatch[1].trim() : '',
        };
      };

      let nextCandidate: { dateKey: string; time: string; room: string } | null = null;
      const considerCandidate = (raw: string | undefined | null, fallback?: { time?: string; room?: string }) => {
        const parsed = parseCandidate(raw);
        if (!parsed) return;

        const merged = {
          dateKey: parsed.dateKey,
          time: parsed.time || fallback?.time || '',
          room: parsed.room || fallback?.room || '',
        };

        if (!nextCandidate || merged.dateKey < nextCandidate.dateKey) {
          nextCandidate = merged;
          return;
        }

        if (nextCandidate.dateKey === merged.dateKey) {
          nextCandidate = {
            dateKey: nextCandidate.dateKey,
            time: nextCandidate.time || merged.time,
            room: nextCandidate.room || merged.room,
          };
        }
      };

      for (const proc of parsedProcedures) {
        const fallback = { time: proc.session_time || '', room: proc.court_room || '' };
        considerCandidate(proc.next_session_date, fallback);
        considerCandidate(proc.action_date, fallback);
      }

      considerCandidate(parsedCaseInfo.next_hearing);
      considerCandidate(parsedCaseInfo.next_session_date);
      for (const key of ['الجلسة المقبلة', 'تاريخ الجلسة المقبلة', 'جلسة مقبلة']) {
        considerCandidate(allLabels?.[key]);
      }

      if (nextCandidate) {
        const { data: autoSessions } = await supabase
          .from('court_sessions')
          .select('id, session_date, session_time, court_room')
          .eq('case_id', caseId)
          .in('notes', ['تم الجلب تلقائياً من بوابة محاكم', 'تم الجلب من المتصفح (Bookmarklet)'])
          .order('session_date', { ascending: true });

        const exactMatch = (autoSessions || []).find((session: any) => session.session_date === nextCandidate!.dateKey);
        const sessionToKeep = exactMatch || (autoSessions || [])[0] || null;
        let keptSessionId: string | null = null;

        if (sessionToKeep) {
          keptSessionId = sessionToKeep.id;
          await supabase.from('court_sessions').update({
            session_date: nextCandidate.dateKey,
            session_time: nextCandidate.time || null,
            court_room: nextCandidate.room || null,
            user_id: resolvedUserId,
            status: 'scheduled',
            notes: 'تم الجلب من المتصفح (Bookmarklet)',
          }).eq('id', sessionToKeep.id);
          newSessionsCount = 1;
        } else {
          const { data: inserted } = await supabase.from('court_sessions').insert({
            case_id: caseId,
            session_date: nextCandidate.dateKey,
            user_id: resolvedUserId,
            required_action: '',
            notes: 'تم الجلب من المتصفح (Bookmarklet)',
            status: 'scheduled',
            session_time: nextCandidate.time || null,
            court_room: nextCandidate.room || null,
          }).select('id').single();
          keptSessionId = inserted?.id ?? null;
          newSessionsCount = 1;
        }

        const extraIds = (autoSessions || [])
          .filter((session: any) => session.id !== keptSessionId)
          .map((session: any) => session.id);

        if (extraIds.length > 0) {
          await supabase.from('court_sessions').delete().in('id', extraIds);
        }
      }
    }

    // 4. Auto-extract parties if none exist
    let partiesAdded = 0;
    try {
      partiesAdded = await autoExtractParties(supabase, caseId, parsedCaseInfo, allLabels);
    } catch (e) {
      console.log(`⚠ Party extraction failed: ${e instanceof Error ? e.message : 'unknown'}`);
    }

    // 5. Create notification
    if (resolvedUserId) {
      const msg = `تم جلب بيانات الملف ${caseNumber} من المتصفح ✅ (${newProcsCount} إجراء${newSessionsCount > 0 ? ` + ${newSessionsCount} جلسة` : ''})`;
      try {
        await supabase.from('notifications').insert({
          user_id: resolvedUserId,
          case_id: caseId,
          message: msg,
          is_read: false,
        });
      } catch (_) { /* ignore notification errors */ }
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
