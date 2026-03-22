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

function isPlaceholderValue(value?: string | null) {
  const normalized = value?.trim() || '';
  return !normalized
    || normalized === 'الرقم الكامل للملف'
    || normalized.startsWith('اختيار ')
    || normalized.includes('اختيار محكمة الاستئناف')
    || normalized.includes('اختيار المحكمة الإبتدائية')
    || normalized.includes('اختيار المحكمة الابتدائية');
}

function normalizeCourtName(value?: string | null) {
  return (value || '')
    .trim()
    .replace(/^المحكمة\s+/g, '')
    .replace(/^محكمة\s+/g, '')
    .replace(/^الابتدائية\s+/g, '')
    .replace(/^الابتدائية\s+ب/g, '')
    .replace(/^الابتدائية\s+بال/g, '')
    .replace(/^الاستئناف\s+/g, '')
    .replace(/^الاستئناف\s+ب/g, '')
    .replace(/^الاستئناف\s+بال/g, '')
    .replace(/^قسم\s+قضاء\s+الأسرة\s+ب/g, 'قسم قضاء الأسرة ')
    .replace(/^قسم\s+قضاء\s+الأسرة\s+بال/g, 'قسم قضاء الأسرة ')
    .replace(/^ب/g, '')
    .replace(/^بال/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function doesResultMatchExpectedCourt(
  expectedCourt?: string | null,
  actualCourt?: string | null,
  fallbackTexts: Array<string | null | undefined> = [],
) {
  if (!expectedCourt) return true;
  const expected = normalizeCourtName(expectedCourt);
  if (!expected) return true;

  const candidates = [actualCourt, ...fallbackTexts]
    .filter((value): value is string => Boolean(value && value.trim()))
    .map((value) => normalizeCourtName(value));

  if (candidates.length === 0) return true;

  return candidates.some((candidate) =>
    candidate === expected
    || candidate.includes(expected)
    || expected.includes(candidate)
  );
}

function detectBlockedPortalResult(input: {
  caseInfo?: Record<string, string>;
  procedures?: Array<Record<string, string>>;
  dropdowns?: string[];
  allLabels?: Record<string, string>;
  rawText?: string;
  noData?: boolean;
}) {
  if (input.noData) {
    return { blocked: false, reason: '' };
  }

  const caseInfo = input.caseInfo || {};
  const procedures = input.procedures || [];
  const dropdowns = input.dropdowns || [];
  const allLabels = input.allLabels || {};
  const rawText = input.rawText || '';

  const meaningfulCaseValues = Object.values(caseInfo).filter((value) => !isPlaceholderValue(value));
  const onlyPlaceholderDropdowns = dropdowns.length > 0 && dropdowns.every((value) => isPlaceholderValue(value));
  const labelValues = Object.values(allLabels).map((value) => String(value || ''));
  const onlyPlaceholderLabels = labelValues.length > 0 && labelValues.every((value) => isPlaceholderValue(value));
  const looksLikeChallengeScript =
    /window\.[A-Za-z0-9_$]{3,}\s*=!!window\./.test(rawText)
    || rawText.includes('RegExp("\\x3c")')
    || (rawText.includes('navigator') && rawText.includes('userAgent'));

  const blocked = procedures.length === 0
    && meaningfulCaseValues.length === 0
    && (looksLikeChallengeScript || onlyPlaceholderDropdowns || onlyPlaceholderLabels);

  const reason = looksLikeChallengeScript
    ? 'challenge_page'
    : onlyPlaceholderDropdowns
      ? 'unresolved_dropdowns'
      : onlyPlaceholderLabels
        ? 'placeholder_labels'
        : '';

  return { blocked, reason };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    console.log('[apify-webhook] Received:', JSON.stringify(body).substring(0, 500));

    let { jobId, caseId, userId, caseNumber, results, error: apifyError } = body;

    if (body.eventType && body.datasetId) {
      console.log('[apify-webhook] Built-in webhook: event=' + body.eventType + ' runId=' + body.runId);

      if (body.eventType !== 'ACTOR.RUN.SUCCEEDED' || body.status === 'FAILED' || body.status === 'TIMED_OUT' || body.status === 'ABORTED') {
        apifyError = `فشل Apify Actor: ${body.status || body.eventType}`;
      } else {
        const APIFY_TOKEN = Deno.env.get('APIFY_API_TOKEN');
        if (APIFY_TOKEN && body.datasetId) {
          try {
            const dsResp = await fetch(
              `https://api.apify.com/v2/datasets/${body.datasetId}/items?token=${APIFY_TOKEN}&format=json`,
              { signal: AbortSignal.timeout(15000) }
            );
            if (dsResp.ok) {
              const items = await dsResp.json();
              console.log('[apify-webhook] Dataset items:', items.length);
              if (items.length > 0) {
                const item = items[0];
                if (item.error) {
                  apifyError = item.error;
                } else {
                  results = {
                    caseInfo: item.caseInfo || {},
                    procedures: item.procedures || [],
                    nextSessionDate: null,
                    allLabels: item.allLabels || {},
                    dropdowns: item.dropdowns || [],
                    tables: item.tables || [],
                    rawText: item.rawText || '',
                    pageTitle: item.pageTitle || '',
                    noData: item.noData || false,
                  };
                }
              } else {
                apifyError = 'لم يتم استخراج أي بيانات من البوابة';
              }
            } else {
              console.error('[apify-webhook] Dataset fetch failed:', dsResp.status);
              apifyError = 'تعذر جلب نتائج Apify Dataset';
            }
          } catch (e) {
            console.error('[apify-webhook] Dataset error:', e);
            apifyError = 'خطأ في جلب البيانات من Apify';
          }
        }
      }
    }

    if (!jobId || !caseId) {
      return new Response(JSON.stringify({ error: 'Missing jobId or caseId' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    let expectedCourt: string | null = null;
    if (jobId) {
      const { data: jobRow } = await supabase
        .from('mahakim_sync_jobs')
        .select('user_id, request_payload')
        .eq('id', jobId)
        .maybeSingle();
      if (!userId && jobRow?.user_id) userId = jobRow.user_id;
      expectedCourt = (jobRow?.request_payload as Record<string, unknown> | null)?.expectedCourt as string | null || null;
    }

    if (apifyError || !results) {
      const errMsg = apifyError || 'لم يتم استلام نتائج من Apify';
      await supabase.from('mahakim_sync_jobs').update({
        status: 'failed',
        error_message: errMsg,
        completed_at: new Date().toISOString(),
      }).eq('id', jobId);

      await createNotification(supabase, userId, caseId, caseNumber,
        `فشل المزامنة التلقائية للملف ${caseNumber}: ${errMsg}`);

      return new Response(JSON.stringify({ status: 'failed', error: errMsg }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { caseInfo = {}, procedures = [], nextSessionDate, allLabels, dropdowns, tables, rawText, pageTitle, noData: resultNoData } = results;
    const blockedDetection = detectBlockedPortalResult({
      caseInfo,
      procedures,
      dropdowns,
      allLabels,
      rawText,
      noData: resultNoData,
    });

    const isEmptyResult = !blockedDetection.blocked
      && !caseInfo.judge
      && !caseInfo.department
      && !caseInfo.status
      && procedures.length === 0;

    const caseInfoValues = Object.values(caseInfo).filter(v => v && !isPlaceholderValue(v));
    const isEffectivelyEmpty = !blockedDetection.blocked && caseInfoValues.length === 0 && procedures.length === 0;

    const courtMatched = doesResultMatchExpectedCourt(
      expectedCourt,
      caseInfo.court,
      [caseInfo.section, caseInfo.department, caseInfo.subject, ...(dropdowns || [])],
    );

    const lastSyncPayload = {
      caseInfo,
      procedures,
      allLabels: allLabels || {},
      dropdowns: dropdowns || [],
      tables: tables || [],
      rawText: (rawText || '').substring(0, 10000),
      pageTitle: pageTitle || '',
      _provider: 'apify',
      _timestamp: new Date().toISOString(),
      empty: isEmptyResult || isEffectivelyEmpty,
      blocked: blockedDetection.blocked,
      blocked_reason: blockedDetection.reason || null,
      expected_court: expectedCourt,
      court_match: courtMatched,
    };

    if (blockedDetection.blocked) {
      await supabase.from('cases').update({
        last_synced_at: new Date().toISOString(),
        last_sync_result: lastSyncPayload,
      }).eq('id', caseId);

      const blockedMessage = 'تم حظر الجلب من بوابة محاكم مؤقتاً ولم يتم استخراج البيانات الفعلية';
      await supabase.from('mahakim_sync_jobs').update({
        status: 'failed',
        error_message: blockedMessage,
        result_data: {
          _provider: 'apify',
          blocked: true,
          blocked_reason: blockedDetection.reason,
          procedures_count: 0,
          labels_count: Object.keys(allLabels || {}).length,
          tables_count: (tables || []).length,
          expected_court: expectedCourt,
        },
        completed_at: new Date().toISOString(),
      }).eq('id', jobId);

      await createNotification(supabase, userId, caseId, caseNumber,
        `تعذر جلب الملف ${caseNumber} لأن البوابة منعت الطلب مؤقتاً — ستتم إعادة المحاولة لاحقاً`);

      return new Response(JSON.stringify({ status: 'blocked', error: blockedMessage }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // نثق بالنتائج — رقم الملف فريد داخل الاختصاص القضائي
    if (!courtMatched) {
      console.log(`[apify-webhook] Court name differs: expected="${expectedCourt}" actual="${caseInfo.court || 'N/A'}" — accepting results (case number is unique within jurisdiction)`);
    }

    const caseUpdate: Record<string, unknown> = {
      last_synced_at: new Date().toISOString(),
      last_sync_result: lastSyncPayload,
    };

    if (isEmptyResult || isEffectivelyEmpty) {
    }
    if (caseInfo.judge && !isPlaceholderValue(caseInfo.judge)) caseUpdate.mahakim_judge = caseInfo.judge;
    if (caseInfo.department && !isPlaceholderValue(caseInfo.department)) caseUpdate.mahakim_department = caseInfo.department;
    if (caseInfo.status && !isPlaceholderValue(caseInfo.status)) caseUpdate.mahakim_status = caseInfo.status;
    if (caseInfo.court && !isPlaceholderValue(caseInfo.court)) caseUpdate.court = caseInfo.court;

    await supabase.from('cases').update(caseUpdate).eq('id', caseId);

    // 2. Delete old mahakim procedures then insert fresh data
    let newProcsCount = 0;
    // Always delete old auto-fetched procedures to avoid stale/wrong data
    await supabase
      .from('case_procedures')
      .delete()
      .eq('case_id', caseId)
      .eq('source', 'mahakim')
      .eq('is_manual', false);

    if (procedures.length > 0) {
      const newProcs = procedures.map((p: any) => ({
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
    if (userId) {
      const now = new Date();
      now.setHours(0, 0, 0, 0);

      let nextCandidate: { dateKey: string; time: string; room: string } | null = null;
      const considerCandidate = (raw: string | undefined, fallback?: { time?: string; room?: string }) => {
        const parsed = parseDateField(raw, now);
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

      for (const proc of procedures) {
        const fallback = {
          time: proc.session_time || '',
          room: proc.court_room || '',
        };
        considerCandidate(proc.next_session_date, fallback);
        considerCandidate(proc.action_date, fallback);
      }

      if (caseInfo) {
        considerCandidate(caseInfo.next_hearing);
        considerCandidate(caseInfo.next_session_date);
      }

      if (allLabels) {
        for (const key of ['الجلسة المقبلة', 'تاريخ الجلسة المقبلة', 'جلسة مقبلة']) {
          considerCandidate(allLabels[key]);
        }
      }

      considerCandidate(nextSessionDate || undefined);

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
            user_id: userId,
            status: 'scheduled',
            notes: 'تم الجلب تلقائياً من بوابة محاكم',
          }).eq('id', sessionToKeep.id);
          newSessionsCount = 1;
        } else {
          const { data: inserted } = await supabase.from('court_sessions').insert({
            case_id: caseId,
            session_date: nextCandidate.dateKey,
            user_id: userId,
            required_action: '',
            notes: 'تم الجلب تلقائياً من بوابة محاكم',
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
      partiesAdded = await autoExtractParties(supabase, caseId, caseInfo, allLabels);
    } catch (e) {
      console.log(`⚠ Party extraction failed: ${e instanceof Error ? e.message : 'unknown'}`);
    }

    // 5. Update sync job as completed
    await supabase.from('mahakim_sync_jobs').update({
      status: 'completed',
      result_data: {
        ...caseInfo,
        _provider: 'apify',
        procedures_count: procedures.length,
        labels_count: Object.keys(allLabels || {}).length,
        tables_count: (tables || []).length,
        has_raw_text: !!(rawText && rawText.length > 0),
        full_data: { caseInfo, procedures, allLabels, dropdowns, tables },
      },
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

/** Parse composite date field like "dd/mm/yyyy على الساعة HH:MM بالقاعة ..." or ISO "yyyy-mm-dd" */
function parseDateField(raw: string | undefined, now: Date): { dateKey: string; time: string; room: string } | null {
  if (!raw || typeof raw !== 'string') return null;
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
  if (isNaN(dateObj.getTime()) || dateObj < now) return null;

  const tm = text.match(/(?:الساعة\s*)?(\d{1,2}:\d{2})/);
  const rm = text.match(/(?:بالقاعة|القاعة|غرفة)\s*(.+?)$/);
  return {
    dateKey,
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

    await supabase.from('notifications').insert({
      user_id: userId,
      case_id: caseId,
      session_id: session?.[0]?.id ?? null,
      message,
      is_read: false,
    });
  } catch (e) {
    console.error('Failed to create notification:', e);
  }
}
