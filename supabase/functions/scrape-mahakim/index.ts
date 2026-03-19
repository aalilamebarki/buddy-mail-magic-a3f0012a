import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

/* ══════════════════════════════════════════════════════════════════
   Court Data Bridge — Async BaaS Orchestrator
   
   Architecture:
   1. Case created → DB trigger → this function (submitSyncJob)
   2. This function → Apify Actor Run (residential proxy + stealth)
   3. Apify completes → POSTs results to mahakim-webhook
   4. mahakim-webhook → processes & saves to DB
   5. Supabase Realtime → pushes to UI
   ══════════════════════════════════════════════════════════════════ */

function getSupabaseAdmin() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );
}

/* ── Build Puppeteer page function for Apify actor ── */
function buildApifyInput(
  caseNumber: string,
  appealCourt: string | undefined,
  jobId: string,
  caseId: string,
  userId: string,
  webhookUrl: string,
): Record<string, unknown> {
  const parts = caseNumber.split('/');
  const numero = parts[0] || '';
  const mark = parts[1] || '';
  const annee = parts[2] || '';

  // Puppeteer Scraper actor input
  return {
    startUrls: [{ url: 'https://www.mahakim.ma/#/suivi/dossier-suivi' }],
    keepUrlFragments: true,
    linkSelector: '', // Don't follow links
    globs: [],
    pseudoUrls: [],
    pageFunction: `
      async function pageFunction(context) {
        const { page, request, log } = context;
        
        log.info('Court Data Bridge: Starting scrape for case ${caseNumber}');
        
        // Wait for Angular app to bootstrap
        await page.waitForSelector('.p-dropdown, p-dropdown', { timeout: 30000 });
        log.info('Angular app loaded');
        
        // 1. Click the appeal court dropdown
        await page.click('.p-dropdown');
        await page.waitForTimeout(1500);
        
        // 2. Select appeal court
        ${appealCourt ? `
        const items = await page.$$('.p-dropdown-panel .p-dropdown-item, .p-dropdown-items li');
        let found = false;
        for (const item of items) {
          const text = await item.evaluate(el => el.textContent || '');
          if (text.includes('${appealCourt}')) {
            await item.click();
            found = true;
            log.info('Selected appeal court: ${appealCourt}');
            break;
          }
        }
        if (!found) {
          const available = await Promise.all(items.map(i => i.evaluate(el => el.textContent?.trim() || '')));
          log.warning('Appeal court not found. Available: ' + available.filter(Boolean).join(', '));
          // Select first option as fallback
          if (items.length > 1) await items[1].click();
        }
        ` : `
        const items = await page.$$('.p-dropdown-panel .p-dropdown-item, .p-dropdown-items li');
        if (items.length > 1) await items[1].click();
        `}
        await page.waitForTimeout(1500);
        
        // 3. Fill input fields (numero, mark/code, annee)
        const inputs = await page.$$('input.p-inputtext, input[pinputtext], input[type="text"], input[type="number"]');
        const visibleInputs = [];
        for (const input of inputs) {
          const visible = await input.evaluate(el => el.offsetParent !== null && el.type !== 'hidden');
          if (visible) visibleInputs.push(input);
        }
        
        log.info('Found ' + visibleInputs.length + ' visible inputs');
        
        if (visibleInputs.length >= 3) {
          // Set values using Angular-compatible method
          for (const [idx, val] of [[0, '${numero}'], [1, '${mark}'], [2, '${annee}']]) {
            await visibleInputs[idx].click({ clickCount: 3 }); // Select all
            await visibleInputs[idx].type(val, { delay: 50 });
          }
          log.info('Filled 3 input fields');
        } else if (visibleInputs.length >= 1) {
          await visibleInputs[0].click({ clickCount: 3 });
          await visibleInputs[0].type('${numero}/${mark}/${annee}', { delay: 50 });
          log.info('Filled 1 combined field');
        }
        
        await page.waitForTimeout(2000);
        
        // 4. Click search button
        const buttons = await page.$$('button.p-button, button[type="submit"]');
        for (const btn of buttons) {
          const text = await btn.evaluate(el => el.textContent || '');
          if (text.includes('بحث') || text.includes('عرض')) {
            await btn.click();
            log.info('Clicked search button: ' + text.trim());
            break;
          }
        }
        
        // 5. Wait for results (long wait for Angular rendering)
        await page.waitForTimeout(10000);
        
        // 6. Extract case info
        const pageText = await page.evaluate(() => document.body.innerText);
        const pageHtml = await page.evaluate(() => document.body.innerHTML);
        
        const caseInfo = {};
        const fieldPatterns = {
          court: /المحكمة[:\\s]*([^\\n|]+)/,
          national_number: /الرقم الوطني[:\\s]*([^\\n|]+)/,
          case_type: /نوع القضية[:\\s]*([^\\n|]+)/,
          department: /الشعبة[:\\s]*([^\\n|]+)/,
          judge: /القاضي المقرر[:\\s]*([^\\n|]+)/,
          subject: /الموضوع[:\\s]*([^\\n|]+)/,
          registration_date: /تاريخ التسجيل[:\\s]*([^\\n|]+)/,
          status: /الحالة[:\\s]*([^\\n|]+)/,
        };
        
        for (const [key, pattern] of Object.entries(fieldPatterns)) {
          const match = pageText.match(pattern);
          if (match) caseInfo[key] = match[1].trim();
        }
        
        // 7. Extract procedures table
        const procedures = await page.evaluate(() => {
          const rows = document.querySelectorAll('table tr, .p-datatable-tbody tr, p-table tr');
          const results = [];
          for (const row of rows) {
            const cells = row.querySelectorAll('td');
            if (cells.length >= 3) {
              const cellTexts = Array.from(cells).map(c => c.textContent?.trim() || '');
              if (cellTexts[0] && cellTexts[0].match(/\\d/)) {
                results.push({
                  action_date: cellTexts[0],
                  action_type: cellTexts[1] || '',
                  decision: cellTexts[2] || '',
                  next_session_date: cellTexts[3] || '',
                });
              }
            }
          }
          return results;
        });
        
        log.info('Extracted ' + procedures.length + ' procedures');
        log.info('Case info keys: ' + Object.keys(caseInfo).join(', '));
        
        // 8. Find next session date
        const now = new Date();
        let nextSessionDate = null;
        for (const proc of procedures) {
          const d = proc.next_session_date;
          if (d && d.match(/\\d{2}\\/\\d{2}\\/\\d{4}/)) {
            const [day, month, year] = d.split('/');
            const date = new Date(year + '-' + month + '-' + day);
            if (date >= now) {
              nextSessionDate = d;
              break;
            }
          }
        }
        
        return {
          jobId: '${jobId}',
          caseId: '${caseId}',
          userId: '${userId}',
          success: Object.keys(caseInfo).length > 0 || procedures.length > 0,
          caseInfo,
          procedures,
          nextSessionDate,
          rawTextLength: pageText.length,
        };
      }
    `,
    proxyConfiguration: {
      useApifyProxy: true,
      apifyProxyGroups: ['RESIDENTIAL'],
      apifyProxyCountry: 'MA', // Morocco residential IPs
    },
    navigationTimeoutSecs: 120,
    maxRequestRetries: 2,
    maxConcurrency: 1,
    preNavigationHooks: `[
      async ({ page }) => {
        // Stealth: Override navigator properties
        await page.evaluateOnNewDocument(() => {
          Object.defineProperty(navigator, 'webdriver', { get: () => false });
          Object.defineProperty(navigator, 'languages', { get: () => ['ar-MA', 'ar', 'fr-FR', 'fr'] });
          Object.defineProperty(navigator, 'platform', { get: () => 'Win32' });
        });
      }
    ]`,
    useChrome: true, // Use full Chrome instead of Chromium for better stealth
  };
}

/* ── Trigger Apify Actor Run ── */
async function triggerApifyRun(
  caseNumber: string,
  appealCourt: string | undefined,
  jobId: string,
  caseId: string,
  userId: string,
): Promise<{ success: boolean; runId?: string; error?: string }> {
  const APIFY_API_TOKEN = Deno.env.get('APIFY_API_TOKEN');
  if (!APIFY_API_TOKEN) {
    return { success: false, error: 'APIFY_API_TOKEN not configured' };
  }

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
  const webhookUrl = `${SUPABASE_URL}/functions/v1/mahakim-webhook`;

  const actorInput = buildApifyInput(caseNumber, appealCourt, jobId, caseId, userId, webhookUrl);

  try {
    // Use Apify's Puppeteer Scraper actor
    const actorId = 'apify~puppeteer-scraper';
    
    // Start the actor run with webhook
    const response = await fetch(
      `https://api.apify.com/v2/acts/${actorId}/runs?token=${APIFY_API_TOKEN}&waitForFinish=0`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(actorInput),
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[BaaS] Apify error:', response.status, errorText);
      return { success: false, error: `Apify error ${response.status}: ${errorText.slice(0, 200)}` };
    }

    const runData = await response.json();
    const runId = runData.data?.id;

    console.log(`[BaaS] Apify run started: ${runId} for case ${caseNumber}`);

    // Register webhook for this run to call back when finished
    await fetch(
      `https://api.apify.com/v2/acts/${actorId}/runs/${runId}/webhooks?token=${APIFY_API_TOKEN}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventTypes: ['ACTOR.RUN.SUCCEEDED', 'ACTOR.RUN.FAILED', 'ACTOR.RUN.TIMED_OUT'],
          requestUrl: webhookUrl,
          headersTemplate: JSON.stringify({
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
            'apikey': SUPABASE_ANON_KEY,
            'x-webhook-secret': Deno.env.get('MAHAKIM_WEBHOOK_SECRET') || '',
          }),
          payloadTemplate: JSON.stringify({
            jobId,
            caseId,
            userId,
            eventType: '{{eventType}}',
            runId: '{{resource.id}}',
            status: '{{resource.status}}',
            datasetId: '{{resource.defaultDatasetId}}',
          }),
        }),
      },
    );

    // Also set up a polling fallback: fetch results after run completes
    // This is handled by the webhook, but we also schedule a check
    scheduleResultsFetch(runId, jobId, caseId, userId, APIFY_API_TOKEN, webhookUrl, SUPABASE_ANON_KEY);

    return { success: true, runId };

  } catch (err) {
    console.error('[BaaS] Error triggering Apify:', err);
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

/* ── Fallback: Poll for results after delay ── */
async function scheduleResultsFetch(
  runId: string,
  jobId: string,
  caseId: string,
  userId: string,
  apiToken: string,
  webhookUrl: string,
  anonKey: string,
) {
  // Wait 3 minutes then check if results arrived
  setTimeout(async () => {
    try {
      // Check if job is already completed (webhook already processed)
      const supabase = getSupabaseAdmin();
      const { data: job } = await supabase
        .from('mahakim_sync_jobs')
        .select('status')
        .eq('id', jobId)
        .single();

      if (job && (job as any).status === 'completed') {
        console.log(`[BaaS] Job ${jobId} already completed via webhook`);
        return;
      }

      // Fetch results from Apify dataset
      const runResponse = await fetch(
        `https://api.apify.com/v2/actor-runs/${runId}?token=${apiToken}`,
      );
      const runData = await runResponse.json();
      
      if (runData.data?.status === 'SUCCEEDED') {
        const datasetId = runData.data.defaultDatasetId;
        const dataResponse = await fetch(
          `https://api.apify.com/v2/datasets/${datasetId}/items?token=${apiToken}`,
        );
        const items = await dataResponse.json();
        
        if (items && items.length > 0) {
          // POST results to webhook
          await fetch(webhookUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${anonKey}`,
              'apikey': anonKey,
              'x-webhook-secret': Deno.env.get('MAHAKIM_WEBHOOK_SECRET') || '',
            },
            body: JSON.stringify({
              jobId,
              caseId,
              userId,
              success: true,
              ...items[0],
            }),
          });
          console.log(`[BaaS] Fallback: Sent results for job ${jobId}`);
        }
      } else if (runData.data?.status === 'FAILED' || runData.data?.status === 'TIMED-OUT') {
        // Mark job as failed
        await supabase.from('mahakim_sync_jobs').update({
          status: 'failed',
          error_message: `Apify run ${runData.data.status}: ${runData.data.statusMessage || 'Unknown'}`,
          updated_at: new Date().toISOString(),
          completed_at: new Date().toISOString(),
        }).eq('id', jobId);
      }
    } catch (err) {
      console.error('[BaaS] Fallback poll error:', err);
    }
  }, 180000); // 3 minutes
}

/* ── ScrapingBee Fallback (kept for cases where Apify is not configured) ── */
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

  const jsScenario = {
    instructions: [
      { wait_for_and_click: ".p-dropdown" },
      { wait: 1500 },
      { evaluate: `(function(){var items=document.querySelectorAll('.p-dropdown-panel .p-dropdown-item,.p-dropdown-items li');if(items.length>1){items[1].click();return 'ok';}return 'no items';})()` },
      { wait: 1500 },
      { evaluate: `(function(){var inputs=document.querySelectorAll('input.p-inputtext,input[pinputtext],input[type="text"],input[type="number"]');var v=[];for(var i=0;i<inputs.length;i++){if(inputs[i].offsetParent!==null&&inputs[i].type!=='hidden')v.push(inputs[i]);}if(v.length>=3){function s(e,val){var n=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set;n.call(e,val);e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));}s(v[0],'${numero}');s(v[1],'${mark}');s(v[2],'${annee}');return 'ok';}return 'no inputs';})()` },
      { wait: 2000 },
      { evaluate: `(function(){var b=document.querySelectorAll('button.p-button,button[type="submit"]');for(var i=0;i<b.length;i++){if((b[i].textContent||'').indexOf('بحث')!==-1){b[i].click();return 'ok';}}return 'no btn';})()` },
      { wait: 8000 },
    ],
  };

  const params = new URLSearchParams({
    api_key: SCRAPINGBEE_API_KEY,
    url: 'https://www.mahakim.ma/#/suivi/dossier-suivi',
    render_js: 'true',
    js_scenario: JSON.stringify(jsScenario),
    timeout: '90000',
    block_resources: 'false',
    block_ads: 'true',
    premium_proxy: 'true',
    wait_browser: 'networkidle',
  });

  try {
    const response = await fetch(`https://app.scrapingbee.com/api/v1?${params.toString()}`, {
      method: 'GET',
      signal: AbortSignal.timeout(100000),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return { html: '', success: false, error: `ScrapingBee error ${response.status}` };
    }

    return { html: await response.text(), success: true };
  } catch (err) {
    return { html: '', success: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

/* ── Parse HTML results (for ScrapingBee fallback) ── */
function parseResults(html: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  if (!html || html.length < 100) return { error: 'لم يتم العثور على نتائج' };

  const fieldPatterns: Record<string, RegExp> = {
    court: /المحكمة[:\s]*([^\n<|]+)/,
    national_number: /الرقم الوطني[:\s]*([^\n<|]+)/,
    case_type: /نوع القضية[:\s]*([^\n<|]+)/,
    department: /الشعبة[:\s]*([^\n<|]+)/,
    judge: /القاضي المقرر[:\s]*([^\n<|]+)/,
    subject: /الموضوع[:\s]*([^\n<|]+)/,
    status: /الحالة[:\s]*([^\n<|]+)/,
  };

  for (const [key, pattern] of Object.entries(fieldPatterns)) {
    const match = html.match(pattern);
    if (match) result[key] = match[1].trim();
  }

  const sessions: Record<string, string>[] = [];
  const rowMatches = html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi);
  for (const rowMatch of rowMatches) {
    const cells: string[] = [];
    const cellMatches = rowMatch[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi);
    for (const cellMatch of cellMatches) {
      cells.push(cellMatch[1].replace(/<[^>]*>/g, '').trim());
    }
    if (cells.length >= 3 && cells[0]?.match(/\d/)) {
      sessions.push({
        action_date: cells[0],
        action_type: cells[1] || '',
        decision: cells[2] || '',
        next_session_date: cells[3] || '',
      });
    }
  }

  if (sessions.length > 0) result.sessions = sessions;
  return result;
}

/* ══════════════════════════════════════════════════════════════════
   Main Handler
   ══════════════════════════════════════════════════════════════════ */
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

      // Update job status
      await supabaseAdmin.from('mahakim_sync_jobs').update({
        status: 'scraping',
        updated_at: new Date().toISOString(),
      }).eq('id', jobId);

      // Try Apify first (async BaaS with residential proxies)
      const APIFY_API_TOKEN = Deno.env.get('APIFY_API_TOKEN');
      
      if (APIFY_API_TOKEN) {
        console.log(`[Bridge] Triggering Apify for case ${caseNumber} (async mode)`);
        const result = await triggerApifyRun(caseNumber, appealCourt, jobId, caseId, userId);
        
        if (result.success) {
          // Job is now running asynchronously — results will come via webhook
          return new Response(JSON.stringify({
            success: true,
            status: 'processing',
            message: 'تم تشغيل الجلب الآلي في الخلفية. ستظهر النتائج تلقائياً.',
            runId: result.runId,
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        
        console.warn('[Bridge] Apify failed, falling back to ScrapingBee:', result.error);
      }

      // Fallback: ScrapingBee (synchronous)
      console.log(`[Bridge] Using ScrapingBee fallback for case ${caseNumber}`);
      const { html, success, error: scrapeError } = await scrapeWithScrapingBee(caseNumber, appealCourt);

      if (!success) {
        await supabaseAdmin.from('mahakim_sync_jobs').update({
          status: 'failed',
          error_message: scrapeError || 'فشل جلب البيانات',
          updated_at: new Date().toISOString(),
          completed_at: new Date().toISOString(),
        }).eq('id', jobId);

        return new Response(JSON.stringify({ success: false, error: scrapeError }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const parsed = parseResults(html);

      // Use webhook handler logic for consistency
      const webhookUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/mahakim-webhook`;
      await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`,
          'apikey': Deno.env.get('SUPABASE_ANON_KEY')!,
        },
        body: JSON.stringify({
          jobId, caseId, userId,
          success: !parsed.error,
          caseInfo: parsed,
          procedures: parsed.sessions || [],
          nextSessionDate: parsed.next_session_date,
        }),
      });

      return new Response(JSON.stringify({
        success: true,
        status: 'processing',
        message: 'تم إرسال البيانات للمعالجة',
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

      // Check for existing active jobs
      const { data: existingJobs } = await supabaseAdmin
        .from('mahakim_sync_jobs')
        .select('id, status')
        .eq('case_id', caseId)
        .in('status', ['pending', 'scraping'])
        .limit(1);

      let jobId: string;
      if (existingJobs && existingJobs.length > 0) {
        jobId = existingJobs[0].id;
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
      }

      // Delegate to submitSyncJob logic
      const internalReq = new Request(req.url, {
        method: 'POST',
        headers: req.headers,
        body: JSON.stringify({
          action: 'submitSyncJob',
          jobId, caseId, userId, caseNumber, appealCourt,
        }),
      });

      // Process inline (reuse handler)
      const innerBody = { action: 'submitSyncJob', jobId, caseId, userId, caseNumber, appealCourt };

      await supabaseAdmin.from('mahakim_sync_jobs').update({
        status: 'scraping',
        updated_at: new Date().toISOString(),
      }).eq('id', jobId);

      const APIFY_API_TOKEN = Deno.env.get('APIFY_API_TOKEN');
      if (APIFY_API_TOKEN) {
        const result = await triggerApifyRun(caseNumber, appealCourt, jobId, caseId, userId);
        return new Response(JSON.stringify({
          success: true,
          jobId,
          status: result.success ? 'processing' : 'failed',
          message: result.success
            ? 'تم تشغيل الجلب الآلي في الخلفية'
            : result.error,
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // ScrapingBee fallback
      const { html, success } = await scrapeWithScrapingBee(caseNumber, appealCourt);
      if (success) {
        const parsed = parseResults(html);
        const webhookUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/mahakim-webhook`;
        await fetch(webhookUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`,
            'apikey': Deno.env.get('SUPABASE_ANON_KEY')!,
          },
          body: JSON.stringify({
            jobId, caseId, userId, success: true,
            caseInfo: parsed, procedures: parsed.sessions || [],
          }),
        });
      }

      return new Response(JSON.stringify({ success: true, jobId, status: 'processing' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── ACTION: bulkSync ──
    if (action === 'bulkSync') {
      const { userId } = body;

      const { data: cases } = await supabaseAdmin
        .from('cases')
        .select('id, case_number, court')
        .neq('case_number', '')
        .not('case_number', 'is', null)
        .eq('status', 'active');

      if (!cases || cases.length === 0) {
        return new Response(JSON.stringify({ success: true, message: 'لا توجد ملفات نشطة', processed: 0 }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const results = [];
      for (const c of cases) {
        const { data: existingJobs } = await supabaseAdmin
          .from('mahakim_sync_jobs')
          .select('id')
          .eq('case_id', c.id)
          .in('status', ['pending', 'scraping'])
          .limit(1);

        if (existingJobs && existingJobs.length > 0) {
          results.push({ caseId: c.id, skipped: true });
          continue;
        }

        const jobId = crypto.randomUUID();
        await supabaseAdmin.from('mahakim_sync_jobs').insert({
          id: jobId,
          case_id: c.id,
          user_id: userId || '00000000-0000-0000-0000-000000000000',
          case_number: c.case_number!,
          status: 'pending',
          request_payload: { auto_triggered: true, bulk: true },
        });

        const APIFY_API_TOKEN = Deno.env.get('APIFY_API_TOKEN');
        if (APIFY_API_TOKEN) {
          const result = await triggerApifyRun(
            c.case_number!, undefined, jobId, c.id,
            userId || '00000000-0000-0000-0000-000000000000',
          );
          results.push({ caseId: c.id, caseNumber: c.case_number, triggered: result.success, runId: result.runId });
        }

        // Stagger requests by 3 seconds
        await new Promise(r => setTimeout(r, 3000));
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
      error: 'إجراء غير معروف. المتاح: submitSyncJob, autoSyncNewCase, bulkSync, getLatestSync',
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
