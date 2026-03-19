import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const MAHAKIM_SEARCH_URL = "https://www.mahakim.ma/#/suivi/dossier-suivi";

/* ── Firecrawl Actions Builder ── */
function buildSearchActions(numero: string, mark: string, annee: string, appealCourt?: string) {
  const actions: Record<string, unknown>[] = [
    { type: "wait", milliseconds: 4000 },
    { type: "click", selector: "input[placeholder*='رقم'], input[type='number']:first-of-type, .p-inputtext:first-of-type" },
    { type: "write", text: numero, selector: "input[placeholder*='رقم'], input[type='number']:first-of-type, .p-inputtext:first-of-type" },
    { type: "click", selector: "input[placeholder*='رمز'], input[type='number']:nth-of-type(2), .p-inputtext:nth-of-type(2)" },
    { type: "write", text: mark, selector: "input[placeholder*='رمز'], input[type='number']:nth-of-type(2), .p-inputtext:nth-of-type(2)" },
    { type: "click", selector: "input[placeholder*='سنة'], input[type='number']:nth-of-type(3), .p-inputtext:nth-of-type(3)" },
    { type: "write", text: annee, selector: "input[placeholder*='سنة'], input[type='number']:nth-of-type(3), .p-inputtext:nth-of-type(3)" },
  ];

  if (appealCourt) {
    actions.push(
      { type: "click", selector: "p-dropdown:first-of-type .p-dropdown, .p-dropdown:first-of-type" },
      { type: "wait", milliseconds: 1000 },
      { type: "executeJavascript", script: `
        const items = document.querySelectorAll('.p-dropdown-item, .p-dropdown-items li');
        for (const item of items) {
          if (item.textContent.includes('${appealCourt}')) { item.click(); break; }
        }
      `},
      { type: "wait", milliseconds: 500 },
    );
  }

  actions.push(
    { type: "click", selector: "button[type='submit'], button.p-button, .btn-search, button[label*='بحث']" },
    { type: "wait", milliseconds: 5000 },
    { type: "screenshot" },
  );

  return actions;
}

/* ── Result Parser ── */
function parseResults(markdown?: string, html?: string) {
  const result: Record<string, unknown> = {};
  const content = markdown || html || '';

  if (!content || content.length < 100) {
    return { error: 'لم يتم العثور على نتائج', raw_length: content.length };
  }

  const fieldPatterns: Record<string, RegExp> = {
    court: /المحكمة[:\s]*([^\n|]+)/,
    national_number: /الرقم الوطني[:\s]*([^\n|]+)/,
    case_type: /نوع القضية[:\s]*([^\n|]+)/,
    department: /الشعبة[:\s]*([^\n|]+)/,
    judge: /القاضي المقرر[:\s]*([^\n|]+)/,
    subject: /الموضوع[:\s]*([^\n|]+)/,
    registration_date: /تاريخ التسجيل[:\s]*([^\n|]+)/,
    latest_judgment: /آخر حكم[:\s]*([^\n|]+)/,
    status: /الحالة[:\s]*([^\n|]+)/,
  };

  for (const [key, pattern] of Object.entries(fieldPatterns)) {
    const match = content.match(pattern);
    if (match) result[key] = match[1].trim();
  }

  // Extract procedures table
  const sessions: Record<string, string>[] = [];
  const tableRows = content.match(/\|[^|\n]+\|[^|\n]+\|[^|\n]*\|?[^|\n]*\|?/g);
  if (tableRows && tableRows.length > 2) {
    const dataRows = tableRows.slice(2);
    for (const row of dataRows) {
      const cells = row.split('|').map(c => c.trim()).filter(c => c && c !== '---');
      if (cells.length >= 3) {
        sessions.push({
          action_date: cells[0] || '',
          action_type: cells[1] || '',
          decision: cells[2] || '',
          next_session_date: cells[3] || '',
        });
      }
    }
  }

  if (sessions.length > 0) {
    result.sessions = sessions;
    const now = new Date();
    const futureSessions = sessions
      .filter(s => s.next_session_date && s.next_session_date.match(/\d{2}\/\d{2}\/\d{4}/))
      .map(s => {
        const [d, m, y] = s.next_session_date.split('/');
        return { ...s, date: new Date(`${y}-${m}-${d}`) };
      })
      .filter(s => s.date >= now)
      .sort((a, b) => a.date.getTime() - b.date.getTime());

    if (futureSessions.length > 0) {
      result.next_session_date = futureSessions[0].next_session_date;
    }
  }

  result.raw_content_length = content.length;
  return result;
}

/* ── Supabase Admin Client ── */
function getSupabaseAdmin() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );
}

/* ── Field Mapping: Apply scraped data to app tables ── */
async function applyFieldMapping(
  supabaseAdmin: ReturnType<typeof getSupabaseAdmin>,
  caseId: string,
  userId: string,
  parsed: Record<string, unknown>,
) {
  const log: string[] = [];

  // 1. Update case metadata (judge, department, status)
  const caseUpdates: Record<string, unknown> = {
    last_synced_at: new Date().toISOString(),
    last_sync_result: parsed,
  };
  if (parsed.judge) caseUpdates.mahakim_judge = parsed.judge;
  if (parsed.department) caseUpdates.mahakim_department = parsed.department;
  if (parsed.status) caseUpdates.mahakim_status = parsed.status;

  await supabaseAdmin.from('cases').update(caseUpdates).eq('id', caseId);
  log.push('تم تحديث بيانات الملف');

  // 2. Insert procedures into case_procedures with conflict detection
  const procedures = (parsed.sessions as Record<string, string>[]) || [];
  if (procedures.length > 0) {
    // Get existing procedures for this case
    const { data: existingProcs } = await supabaseAdmin
      .from('case_procedures')
      .select('*')
      .eq('case_id', caseId)
      .eq('source', 'mahakim');

    const existingKeys = new Set(
      (existingProcs || []).map((p: any) => `${p.action_date}|${p.action_type}`)
    );

    const newProcs = procedures
      .filter(p => !existingKeys.has(`${p.action_date}|${p.action_type}`))
      .map(p => ({
        case_id: caseId,
        action_date: p.action_date || null,
        action_type: p.action_type,
        decision: p.decision || null,
        next_session_date: p.next_session_date || null,
        source: 'mahakim',
        is_manual: false,
      }));

    if (newProcs.length > 0) {
      await supabaseAdmin.from('case_procedures').insert(newProcs);
      log.push(`تم إضافة ${newProcs.length} إجراء جديد`);
    }

    // Conflict resolution: Check for manual entries that contradict court data
    if (existingProcs && existingProcs.length > 0) {
      const manualProcs = (await supabaseAdmin
        .from('case_procedures')
        .select('*')
        .eq('case_id', caseId)
        .eq('is_manual', true)).data || [];

      for (const manual of manualProcs) {
        const courtMatch = procedures.find(
          p => p.action_date === manual.action_date && p.action_type !== manual.action_type
        );
        if (courtMatch) {
          // Court data takes priority — update manual entry but log the conflict
          await supabaseAdmin.from('case_procedures').update({
            action_type: courtMatch.action_type,
            decision: courtMatch.decision,
            next_session_date: courtMatch.next_session_date,
            source: 'mahakim',
            is_manual: false,
            conflict_log: {
              resolved_at: new Date().toISOString(),
              original_manual: {
                action_type: manual.action_type,
                decision: manual.decision,
              },
              court_data: courtMatch,
              resolution: 'court_priority',
            },
          }).eq('id', manual.id);
          log.push(`تعارض محلول: ${manual.action_type} ← ${courtMatch.action_type}`);
        }
      }
    }
  }

  // 3. Auto-create court session from next_session_date
  const nextDateStr = parsed.next_session_date as string | undefined;
  if (nextDateStr && nextDateStr.match(/\d{2}\/\d{2}\/\d{4}/)) {
    const [d, m, y] = nextDateStr.split('/');
    const nextDateISO = `${y}-${m}-${d}`;

    const { data: existingSession } = await supabaseAdmin
      .from('court_sessions')
      .select('id')
      .eq('case_id', caseId)
      .eq('session_date', nextDateISO)
      .limit(1);

    if (!existingSession || existingSession.length === 0) {
      await supabaseAdmin.from('court_sessions').insert({
        case_id: caseId,
        session_date: nextDateISO,
        user_id: userId,
        notes: 'تم الجلب تلقائياً من بوابة محاكم',
        status: 'scheduled',
      });
      log.push(`تم إنشاء جلسة مقبلة: ${nextDateISO}`);
    }

    return { nextDateISO, log };
  }

  return { nextDateISO: null, log };
}

/* ── Main Handler ── */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { action } = body;

    // ── ACTION: submitSyncJob ──
    if (action === 'submitSyncJob') {
      const { jobId, caseId, userId, caseNumber, appealCourt } = body;

      if (!jobId || !caseId || !caseNumber) {
        return new Response(JSON.stringify({ success: false, error: 'بيانات ناقصة' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const FIRECRAWL_API_KEY = Deno.env.get('FIRECRAWL_API_KEY');
      if (!FIRECRAWL_API_KEY) {
        return new Response(JSON.stringify({ success: false, error: 'Firecrawl غير مهيأ' }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const supabaseAdmin = getSupabaseAdmin();

      // Update job to 'scraping'
      await supabaseAdmin.from('mahakim_sync_jobs').update({
        status: 'scraping',
        updated_at: new Date().toISOString(),
      }).eq('id', jobId);

      const parts = caseNumber.split('/');
      const numero = parts[0] || '';
      const mark = parts[1] || '';
      const annee = parts[2] || '';

      const actions = buildSearchActions(numero, mark, annee, appealCourt);

      console.log(`[sync] Job ${jobId}: scraping ${caseNumber}`);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 22000);

      try {
        const scrapeRes = await fetch('https://api.firecrawl.dev/v1/scrape', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${FIRECRAWL_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            url: MAHAKIM_SEARCH_URL,
            formats: ['markdown', 'html'],
            waitFor: 5000,
            timeout: 55000,
            actions,
          }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);
        const scrapeData = await scrapeRes.json();

        if (!scrapeRes.ok) {
          console.error('[sync] Firecrawl error:', JSON.stringify(scrapeData));
          await supabaseAdmin.from('mahakim_sync_jobs').update({
            status: 'failed',
            error_message: `خطأ Firecrawl: ${scrapeData.error || scrapeRes.status}`,
            updated_at: new Date().toISOString(),
            completed_at: new Date().toISOString(),
          }).eq('id', jobId);

          return new Response(JSON.stringify({ success: false, error: 'فشل الجلب' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // Parse
        const markdown = scrapeData.data?.markdown || scrapeData.markdown;
        const html = scrapeData.data?.html || scrapeData.html;
        const parsed = parseResults(markdown, html);
        const hasError = parsed.error && !parsed.court;

        if (hasError) {
          await supabaseAdmin.from('mahakim_sync_jobs').update({
            status: 'failed',
            result_data: parsed,
            error_message: parsed.error as string,
            updated_at: new Date().toISOString(),
            completed_at: new Date().toISOString(),
          }).eq('id', jobId);

          return new Response(JSON.stringify({ success: false, status: 'failed', data: parsed }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // Apply field mapping — procedures, sessions, metadata
        const { nextDateISO, log } = await applyFieldMapping(supabaseAdmin, caseId, userId, parsed);

        // Update sync job
        await supabaseAdmin.from('mahakim_sync_jobs').update({
          status: 'completed',
          result_data: { ...parsed, mapping_log: log },
          next_session_date: nextDateISO,
          updated_at: new Date().toISOString(),
          completed_at: new Date().toISOString(),
        }).eq('id', jobId);

        console.log(`[sync] Job ${jobId} completed. Log: ${log.join(', ')}`);

        return new Response(JSON.stringify({
          success: true,
          status: 'completed',
          data: parsed,
          mapping_log: log,
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

      } catch (fetchErr) {
        clearTimeout(timeoutId);
        const isTimeout = fetchErr instanceof DOMException && fetchErr.name === 'AbortError';

        await supabaseAdmin.from('mahakim_sync_jobs').update({
          status: 'failed',
          error_message: isTimeout
            ? 'انتهت مهلة الاتصال ببوابة محاكم. البوابة بطيئة حالياً — يرجى المحاولة لاحقاً أو استخدام الرابط المباشر.'
            : `خطأ: ${fetchErr instanceof Error ? fetchErr.message : 'غير معروف'}`,
          updated_at: new Date().toISOString(),
          completed_at: new Date().toISOString(),
        }).eq('id', jobId);

        return new Response(JSON.stringify({
          success: false,
          error: isTimeout ? 'timeout' : 'fetch_error',
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // ── ACTION: autoSyncNewCase ──
    // Triggered after case creation — fire-and-forget style
    if (action === 'autoSyncNewCase') {
      const { caseId, userId, caseNumber, appealCourt } = body;

      if (!caseId || !caseNumber || !userId) {
        return new Response(JSON.stringify({ success: false, error: 'بيانات ناقصة' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const supabaseAdmin = getSupabaseAdmin();

      // Create a sync job automatically
      const jobId = crypto.randomUUID();
      await supabaseAdmin.from('mahakim_sync_jobs').insert({
        id: jobId,
        case_id: caseId,
        user_id: userId,
        case_number: caseNumber,
        status: 'pending',
        request_payload: { appealCourt, auto_triggered: true },
      });

      console.log(`[auto-sync] Created job ${jobId} for new case ${caseId}`);

      // Re-invoke ourselves with submitSyncJob (non-blocking from caller's perspective)
      // We do it inline here to avoid double network hop
      const FIRECRAWL_API_KEY = Deno.env.get('FIRECRAWL_API_KEY');
      if (!FIRECRAWL_API_KEY) {
        await supabaseAdmin.from('mahakim_sync_jobs').update({
          status: 'failed',
          error_message: 'Firecrawl غير مهيأ',
          completed_at: new Date().toISOString(),
        }).eq('id', jobId);

        return new Response(JSON.stringify({ success: true, jobId, status: 'skipped', reason: 'no_firecrawl' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Update to scraping
      await supabaseAdmin.from('mahakim_sync_jobs').update({
        status: 'scraping',
        updated_at: new Date().toISOString(),
      }).eq('id', jobId);

      const parts = caseNumber.split('/');
      const numero = parts[0] || '';
      const mark = parts[1] || '';
      const annee = parts[2] || '';
      const actions = buildSearchActions(numero, mark, annee, appealCourt);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 22000);

      try {
        const scrapeRes = await fetch('https://api.firecrawl.dev/v1/scrape', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${FIRECRAWL_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            url: MAHAKIM_SEARCH_URL,
            formats: ['markdown', 'html'],
            waitFor: 5000,
            timeout: 55000,
            actions,
          }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);
        const scrapeData = await scrapeRes.json();

        if (!scrapeRes.ok) {
          await supabaseAdmin.from('mahakim_sync_jobs').update({
            status: 'failed',
            error_message: `خطأ Firecrawl: ${scrapeData.error || scrapeRes.status}`,
            updated_at: new Date().toISOString(),
            completed_at: new Date().toISOString(),
          }).eq('id', jobId);
        } else {
          const markdown = scrapeData.data?.markdown || scrapeData.markdown;
          const html = scrapeData.data?.html || scrapeData.html;
          const parsed = parseResults(markdown, html);
          const hasError = parsed.error && !parsed.court;

          if (!hasError) {
            const { nextDateISO, log } = await applyFieldMapping(supabaseAdmin, caseId, userId, parsed);
            await supabaseAdmin.from('mahakim_sync_jobs').update({
              status: 'completed',
              result_data: { ...parsed, mapping_log: log },
              next_session_date: nextDateISO,
              updated_at: new Date().toISOString(),
              completed_at: new Date().toISOString(),
            }).eq('id', jobId);
          } else {
            await supabaseAdmin.from('mahakim_sync_jobs').update({
              status: 'failed',
              result_data: parsed,
              error_message: parsed.error as string,
              updated_at: new Date().toISOString(),
              completed_at: new Date().toISOString(),
            }).eq('id', jobId);
          }
        }
      } catch (fetchErr) {
        clearTimeout(timeoutId);
        const isTimeout = fetchErr instanceof DOMException && fetchErr.name === 'AbortError';
        await supabaseAdmin.from('mahakim_sync_jobs').update({
          status: 'failed',
          error_message: isTimeout
            ? 'انتهت مهلة الاتصال ببوابة محاكم — ستتم المحاولة لاحقاً.'
            : `خطأ: ${fetchErr instanceof Error ? fetchErr.message : 'غير معروف'}`,
          updated_at: new Date().toISOString(),
          completed_at: new Date().toISOString(),
        }).eq('id', jobId);
      }

      return new Response(JSON.stringify({ success: true, jobId }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── ACTION: getLatestSync ──
    if (action === 'getLatestSync') {
      const { caseId } = body;
      const supabaseAdmin = getSupabaseAdmin();
      const { data } = await supabaseAdmin
        .from('mahakim_sync_jobs')
        .select('*')
        .eq('case_id', caseId)
        .order('created_at', { ascending: false })
        .limit(1);

      return new Response(JSON.stringify({ success: true, data: data?.[0] || null }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({
      success: false,
      error: 'إجراء غير معروف. الإجراءات المتاحة: submitSyncJob, autoSyncNewCase, getLatestSync',
    }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'خطأ غير معروف',
    }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
