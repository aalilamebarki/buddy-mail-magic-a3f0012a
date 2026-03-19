import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

/* ── ScrapingBee Custom JS for Mahakim.ma Angular/PrimeNG portal ── */
function buildScrapingBeeJS(numero: string, mark: string, annee: string, appealCourt?: string): string {
  return `
    (async () => {
      // Wait for Angular to bootstrap
      await new Promise(r => setTimeout(r, 5000));

      // Fill the search fields
      const inputs = document.querySelectorAll('.p-inputtext, input[type="number"], input[type="text"]');
      const fields = Array.from(inputs).filter(el => el.offsetParent !== null);
      
      // Try to find fields by placeholder or position
      for (const input of fields) {
        const ph = input.getAttribute('placeholder') || '';
        if (ph.includes('رقم') || (fields.indexOf(input) === 0 && !input.value)) {
          input.value = '${numero}';
          input.dispatchEvent(new Event('input', { bubbles: true }));
          input.dispatchEvent(new Event('change', { bubbles: true }));
        } else if (ph.includes('رمز') || (fields.indexOf(input) === 1 && !input.value)) {
          input.value = '${mark}';
          input.dispatchEvent(new Event('input', { bubbles: true }));
          input.dispatchEvent(new Event('change', { bubbles: true }));
        } else if (ph.includes('سنة') || (fields.indexOf(input) === 2 && !input.value)) {
          input.value = '${annee}';
          input.dispatchEvent(new Event('input', { bubbles: true }));
          input.dispatchEvent(new Event('change', { bubbles: true }));
        }
      }

      ${appealCourt ? `
      // Select appeal court from dropdown
      await new Promise(r => setTimeout(r, 1000));
      const dropdowns = document.querySelectorAll('.p-dropdown');
      if (dropdowns.length > 0) {
        dropdowns[0].click();
        await new Promise(r => setTimeout(r, 1500));
        const items = document.querySelectorAll('.p-dropdown-item, .p-dropdown-items li');
        for (const item of items) {
          if (item.textContent && item.textContent.includes('${appealCourt}')) {
            item.click();
            break;
          }
        }
        await new Promise(r => setTimeout(r, 500));
      }
      ` : ''}

      // Click search button
      await new Promise(r => setTimeout(r, 500));
      const buttons = document.querySelectorAll('button[type="submit"], button.p-button, .btn-search');
      for (const btn of buttons) {
        if (btn.offsetParent !== null) {
          btn.click();
          break;
        }
      }

      // Wait for results to load
      await new Promise(r => setTimeout(r, 8000));
    })();
  `;
}

/* ── Result Parser ── */
function parseResults(htmlContent: string) {
  const result: Record<string, unknown> = {};

  if (!htmlContent || htmlContent.length < 100) {
    return { error: 'لم يتم العثور على نتائج', raw_length: htmlContent?.length || 0 };
  }

  const fieldPatterns: Record<string, RegExp> = {
    court: /المحكمة[:\s]*([^\n<|]+)/,
    national_number: /الرقم الوطني[:\s]*([^\n<|]+)/,
    case_type: /نوع القضية[:\s]*([^\n<|]+)/,
    department: /الشعبة[:\s]*([^\n<|]+)/,
    judge: /القاضي المقرر[:\s]*([^\n<|]+)/,
    subject: /الموضوع[:\s]*([^\n<|]+)/,
    registration_date: /تاريخ التسجيل[:\s]*([^\n<|]+)/,
    latest_judgment: /آخر حكم[:\s]*([^\n<|]+)/,
    status: /الحالة[:\s]*([^\n<|]+)/,
  };

  for (const [key, pattern] of Object.entries(fieldPatterns)) {
    const match = htmlContent.match(pattern);
    if (match) result[key] = match[1].trim();
  }

  // Extract procedures table
  const sessions: Record<string, string>[] = [];
  // Match table rows from HTML
  const rowMatches = htmlContent.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi);
  for (const rowMatch of rowMatches) {
    const cells: string[] = [];
    const cellMatches = rowMatch[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi);
    for (const cellMatch of cellMatches) {
      cells.push(cellMatch[1].replace(/<[^>]*>/g, '').trim());
    }
    if (cells.length >= 3 && cells[0] && cells[0].match(/\d/)) {
      sessions.push({
        action_date: cells[0] || '',
        action_type: cells[1] || '',
        decision: cells[2] || '',
        next_session_date: cells[3] || '',
      });
    }
  }

  // Fallback: try markdown table format
  if (sessions.length === 0) {
    const tableRows = htmlContent.match(/\|[^|\n]+\|[^|\n]+\|[^|\n]*\|?[^|\n]*\|?/g);
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

  result.raw_content_length = htmlContent.length;
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

  // 1. Update case metadata
  const caseUpdates: Record<string, unknown> = {
    last_synced_at: new Date().toISOString(),
    last_sync_result: parsed,
  };
  if (parsed.judge) caseUpdates.mahakim_judge = parsed.judge;
  if (parsed.department) caseUpdates.mahakim_department = parsed.department;
  if (parsed.status) caseUpdates.mahakim_status = parsed.status;

  await supabaseAdmin.from('cases').update(caseUpdates).eq('id', caseId);
  log.push('تم تحديث بيانات الملف');

  // 2. Insert procedures with conflict detection
  const procedures = (parsed.sessions as Record<string, string>[]) || [];
  if (procedures.length > 0) {
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

    // Conflict resolution: court data takes priority
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
          await supabaseAdmin.from('case_procedures').update({
            action_type: courtMatch.action_type,
            decision: courtMatch.decision,
            next_session_date: courtMatch.next_session_date,
            source: 'mahakim',
            is_manual: false,
            conflict_log: {
              resolved_at: new Date().toISOString(),
              original_manual: { action_type: manual.action_type, decision: manual.decision },
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

/* ── ScrapingBee Scraper ── */
async function scrapeWithScrapingBee(
  caseNumber: string,
  appealCourt?: string,
): Promise<{ html: string; success: boolean; error?: string }> {
  const SCRAPINGBEE_API_KEY = Deno.env.get('SCRAPINGBEE_API_KEY');
  if (!SCRAPINGBEE_API_KEY) {
    return { html: '', success: false, error: 'ScrapingBee API key not configured' };
  }

  const parts = caseNumber.split('/');
  const numero = parts[0] || '';
  const mark = parts[1] || '';
  const annee = parts[2] || '';

  const jsScript = buildScrapingBeeJS(numero, mark, annee, appealCourt);
  const jsScriptBase64 = btoa(unescape(encodeURIComponent(jsScript)));

  const params = new URLSearchParams({
    api_key: SCRAPINGBEE_API_KEY,
    url: 'https://www.mahakim.ma/#/suivi/dossier-suivi',
    render_js: 'true',
    js_scenario: JSON.stringify({
      instructions: [
        { wait: 5000 },
        { evaluate: jsScript },
        { wait: 10000 },
      ],
    }),
    wait: '15000',
    timeout: '60000',
    block_ads: 'true',
    premium_proxy: 'true',
  });

  try {
    const response = await fetch(`https://app.scrapingbee.com/api/v1?${params.toString()}`, {
      method: 'GET',
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[ScrapingBee] Error:', response.status, errorText);
      return { html: '', success: false, error: `ScrapingBee error ${response.status}: ${errorText.slice(0, 200)}` };
    }

    const html = await response.text();
    return { html, success: true };
  } catch (err) {
    console.error('[ScrapingBee] Fetch error:', err);
    return { html: '', success: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

/* ── Retry Logic ── */
async function scheduleRetry(
  supabaseAdmin: ReturnType<typeof getSupabaseAdmin>,
  jobId: string,
  retryCount: number,
  maxRetries: number,
) {
  if (retryCount >= maxRetries) {
    return false; // No more retries
  }

  // Schedule retry by updating the job status back to pending
  await supabaseAdmin.from('mahakim_sync_jobs').update({
    status: 'pending',
    retry_count: retryCount + 1,
    error_message: `إعادة المحاولة ${retryCount + 1}/${maxRetries} — تمت جدولة المحاولة التالية`,
    updated_at: new Date().toISOString(),
  }).eq('id', jobId);

  return true;
}

/* ── Process a sync job ── */
async function processSyncJob(
  supabaseAdmin: ReturnType<typeof getSupabaseAdmin>,
  jobId: string,
  caseId: string,
  userId: string,
  caseNumber: string,
  appealCourt?: string,
) {
  // Get current job to check retry count
  const { data: jobData } = await supabaseAdmin
    .from('mahakim_sync_jobs')
    .select('retry_count, max_retries')
    .eq('id', jobId)
    .single();

  const retryCount = (jobData as any)?.retry_count || 0;
  const maxRetries = (jobData as any)?.max_retries || 2;

  // Update to scraping
  await supabaseAdmin.from('mahakim_sync_jobs').update({
    status: 'scraping',
    updated_at: new Date().toISOString(),
  }).eq('id', jobId);

  console.log(`[sync] Job ${jobId}: scraping ${caseNumber} (attempt ${retryCount + 1}/${maxRetries + 1})`);

  // Use ScrapingBee
  const { html, success, error: scrapeError } = await scrapeWithScrapingBee(caseNumber, appealCourt);

  if (!success) {
    console.error(`[sync] ScrapingBee failed for job ${jobId}:`, scrapeError);

    // Try retry
    const retryScheduled = await scheduleRetry(supabaseAdmin, jobId, retryCount, maxRetries);

    if (!retryScheduled) {
      await supabaseAdmin.from('mahakim_sync_jobs').update({
        status: 'failed',
        error_message: scrapeError || 'فشل جلب البيانات من بوابة محاكم',
        updated_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
      }).eq('id', jobId);
    }

    return { success: false, retryScheduled, error: scrapeError };
  }

  // Parse results
  const parsed = parseResults(html);
  const hasError = parsed.error && !parsed.court;

  if (hasError) {
    const retryScheduled = await scheduleRetry(supabaseAdmin, jobId, retryCount, maxRetries);

    if (!retryScheduled) {
      await supabaseAdmin.from('mahakim_sync_jobs').update({
        status: 'failed',
        result_data: parsed,
        error_message: parsed.error as string,
        updated_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
      }).eq('id', jobId);
    }

    return { success: false, retryScheduled, data: parsed };
  }

  // Apply field mapping
  const { nextDateISO, log } = await applyFieldMapping(supabaseAdmin, caseId, userId, parsed);

  // Mark completed
  await supabaseAdmin.from('mahakim_sync_jobs').update({
    status: 'completed',
    result_data: { ...parsed, mapping_log: log },
    next_session_date: nextDateISO,
    updated_at: new Date().toISOString(),
    completed_at: new Date().toISOString(),
  }).eq('id', jobId);

  console.log(`[sync] Job ${jobId} completed. Log: ${log.join(', ')}`);
  return { success: true, data: parsed, mapping_log: log };
}

/* ── Main Handler ── */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { action } = body;

    const supabaseAdmin = getSupabaseAdmin();

    // ── ACTION: submitSyncJob ──
    if (action === 'submitSyncJob') {
      const { jobId, caseId, userId, caseNumber, appealCourt } = body;

      if (!jobId || !caseId || !caseNumber) {
        return new Response(JSON.stringify({ success: false, error: 'بيانات ناقصة' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const result = await processSyncJob(supabaseAdmin, jobId, caseId, userId, caseNumber, appealCourt);

      return new Response(JSON.stringify({
        success: result.success,
        status: result.success ? 'completed' : (result.retryScheduled ? 'retrying' : 'failed'),
        data: result.data,
        mapping_log: result.mapping_log,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── ACTION: autoSyncNewCase ──
    if (action === 'autoSyncNewCase') {
      const { caseId, userId, caseNumber, appealCourt } = body;

      if (!caseId || !caseNumber || !userId) {
        return new Response(JSON.stringify({ success: false, error: 'بيانات ناقصة' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Check if a job already exists (could be from DB trigger)
      const { data: existingJobs } = await supabaseAdmin
        .from('mahakim_sync_jobs')
        .select('id, status')
        .eq('case_id', caseId)
        .in('status', ['pending', 'scraping'])
        .limit(1);

      let jobId: string;
      if (existingJobs && existingJobs.length > 0) {
        jobId = existingJobs[0].id;
        console.log(`[auto-sync] Using existing job ${jobId} for case ${caseId}`);
      } else {
        jobId = crypto.randomUUID();
        await supabaseAdmin.from('mahakim_sync_jobs').insert({
          id: jobId,
          case_id: caseId,
          user_id: userId,
          case_number: caseNumber,
          status: 'pending',
          request_payload: { appealCourt, auto_triggered: true },
        });
        console.log(`[auto-sync] Created job ${jobId} for new case ${caseId}`);
      }

      const result = await processSyncJob(supabaseAdmin, jobId, caseId, userId, caseNumber, appealCourt);

      return new Response(JSON.stringify({ success: true, jobId, ...result }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── ACTION: retryFailedJobs ──
    if (action === 'retryFailedJobs') {
      // Find pending retry jobs (status = 'pending', retry_count > 0)
      const { data: retryJobs } = await supabaseAdmin
        .from('mahakim_sync_jobs')
        .select('*')
        .eq('status', 'pending')
        .gt('retry_count', 0)
        .order('updated_at', { ascending: true })
        .limit(5);

      const results = [];
      for (const job of retryJobs || []) {
        const payload = (job.request_payload as Record<string, unknown>) || {};
        const result = await processSyncJob(
          supabaseAdmin,
          job.id,
          job.case_id,
          job.user_id,
          job.case_number,
          payload.appealCourt as string | undefined,
        );
        results.push({ jobId: job.id, ...result });
      }

      return new Response(JSON.stringify({ success: true, processed: results.length, results }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── ACTION: getLatestSync ──
    if (action === 'getLatestSync') {
      const { caseId } = body;
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
      error: 'إجراء غير معروف. الإجراءات المتاحة: submitSyncJob, autoSyncNewCase, retryFailedJobs, getLatestSync',
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
