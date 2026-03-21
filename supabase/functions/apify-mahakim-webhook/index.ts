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

    // Handle Apify built-in webhook format (eventType + datasetId)
    if (body.eventType && body.datasetId) {
      console.log('[apify-webhook] Built-in webhook: event=' + body.eventType + ' runId=' + body.runId);
      
      // If actor failed/timed out
      if (body.eventType !== 'ACTOR.RUN.SUCCEEDED' || body.status === 'FAILED' || body.status === 'TIMED_OUT' || body.status === 'ABORTED') {
        apifyError = `فشل Apify Actor: ${body.status || body.eventType}`;
      } else {
        // Fetch results from Apify dataset
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
                    // Store ALL raw data from the page
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

    // Ensure userId is always resolved — fall back to sync job's user_id
    if (!userId && jobId) {
      const { data: jobRow } = await supabase
        .from('mahakim_sync_jobs')
        .select('user_id')
        .eq('id', jobId)
        .maybeSingle();
      if (jobRow?.user_id) userId = jobRow.user_id;
    }

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
    const { caseInfo = {}, procedures = [], nextSessionDate, allLabels, dropdowns, tables, rawText, pageTitle, noData: resultNoData } = results;
    const blockedDetection = detectBlockedPortalResult({
      caseInfo,
      procedures,
      dropdowns,
      allLabels,
      rawText,
      noData: resultNoData,
    });

    // Handle "not found" — only when the portal really returned an empty result
    const isEmptyResult = !blockedDetection.blocked
      && !caseInfo.judge
      && !caseInfo.department
      && !caseInfo.status
      && procedures.length === 0;

    // ── Additional detection: if caseInfo only has placeholder values ──
    const caseInfoValues = Object.values(caseInfo).filter(v => v && !isPlaceholderValue(v));
    const isEffectivelyEmpty = !blockedDetection.blocked && caseInfoValues.length === 0 && procedures.length === 0;

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
        },
        completed_at: new Date().toISOString(),
      }).eq('id', jobId);

      await createNotification(supabase, userId, caseId, caseNumber,
        `تعذر جلب الملف ${caseNumber} لأن البوابة منعت الطلب مؤقتاً — ستتم إعادة المحاولة لاحقاً`);

      return new Response(JSON.stringify({ status: 'blocked', error: blockedMessage }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 1. Update case metadata — store FULL raw JSON but NEVER overwrite with placeholder values
    const caseUpdate: Record<string, unknown> = {
      last_synced_at: new Date().toISOString(),
      last_sync_result: lastSyncPayload,
    };

    if (isEmptyResult || isEffectivelyEmpty) {
      // Don't set court/judge/department to garbage placeholder values
      // Just mark as not found yet
    }
    if (caseInfo.judge && !isPlaceholderValue(caseInfo.judge)) caseUpdate.mahakim_judge = caseInfo.judge;
    if (caseInfo.department && !isPlaceholderValue(caseInfo.department)) caseUpdate.mahakim_department = caseInfo.department;
    if (caseInfo.status && !isPlaceholderValue(caseInfo.status)) caseUpdate.mahakim_status = caseInfo.status;
    if (caseInfo.court && !isPlaceholderValue(caseInfo.court)) caseUpdate.court = caseInfo.court;

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

    // 3. Schedule future court sessions from ALL available sources
    let newSessionsCount = 0;
    if (userId) {
      const now = new Date();
      now.setHours(0, 0, 0, 0);
      const futureSessionMap = new Map<string, { time: string; room: string }>();

      const addCandidate = (raw: string | undefined, fallback?: { time?: string; room?: string }) => {
        const parsed = parseDateField(raw, now);
        if (!parsed) return;
        const existing = futureSessionMap.get(parsed.dateKey);
        futureSessionMap.set(parsed.dateKey, {
          time: parsed.time || fallback?.time || existing?.time || '',
          room: parsed.room || fallback?.room || existing?.room || '',
        });
      };

      // Extract from procedures: check ALL date-like fields
      for (const proc of procedures) {
        const fallback = {
          time: proc.session_time || '',
          room: proc.court_room || '',
        };
        addCandidate(proc.next_session_date, fallback);
        addCandidate(proc.action_date, fallback);
        addCandidate(proc.decision, fallback);
        addCandidate(proc.court_room, fallback);
        addCandidate(proc.action_type, fallback);
      }

      // Extract from caseInfo
      if (caseInfo) {
        addCandidate(caseInfo.next_hearing);
        addCandidate(caseInfo.next_session_date);
      }

      // Extract from allLabels
      if (allLabels) {
        const labelKeys = ['الجلسة المقبلة', 'تاريخ الجلسة المقبلة', 'جلسة مقبلة'];
        for (const key of labelKeys) {
          addCandidate(allLabels[key]);
        }
      }

      // Fallback: top-level nextSessionDate
      if (nextSessionDate) {
        const parsed = parseDateField(nextSessionDate, now);
        if (parsed && !futureSessionMap.has(parsed.dateKey)) {
          futureSessionMap.set(parsed.dateKey, { time: parsed.time, room: parsed.room });
        } else if (!parsed && /^\d{4}-\d{2}-\d{2}$/.test(nextSessionDate) && new Date(nextSessionDate) >= now) {
          if (!futureSessionMap.has(nextSessionDate)) {
            futureSessionMap.set(nextSessionDate, { time: '', room: '' });
          }
        }
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
    }

    // 4. Update sync job as completed
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
