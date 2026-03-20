import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

/* ══════════════════════════════════════════════════════════════════
   Court Data Bridge — ScrapingBee + Residential Proxies
   
   Uses ONLY ScrapingBee (already configured) with premium_proxy
   to bypass Mahakim.ma cloud IP blocking.
   No external services or API keys needed beyond SCRAPINGBEE_API_KEY.
   ══════════════════════════════════════════════════════════════════ */

function getSupabaseAdmin() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );
}

/* ── Scrape via ScrapingBee with Residential Proxy ── */
async function scrapeCase(
  caseNumber: string,
  appealCourt?: string,
): Promise<{ html: string; success: boolean; error?: string }> {
  const SCRAPINGBEE_API_KEY = Deno.env.get('SCRAPINGBEE_API_KEY');
  if (!SCRAPINGBEE_API_KEY) {
    return { html: '', success: false, error: 'مفتاح ScrapingBee غير مُعدّ' };
  }

  const parts = caseNumber.split('/');
  const numero = parts[0] || '';
  const mark = parts[1] || '';
  const annee = parts[2] || '';

  const jsScenario = {
    instructions: [
      { wait_for: ".p-dropdown", timeout: 30000 },
      { click: ".p-dropdown" },
      { wait: 2000 },
      { evaluate: `(function(){var items=document.querySelectorAll('.p-dropdown-panel .p-dropdown-item,.p-dropdown-items li');if(items.length>1){items[1].click();return 'selected';}return 'no items';})()` },
      { wait: 2000 },
      { evaluate: `(function(){var inputs=document.querySelectorAll('input.p-inputtext,input[pinputtext],input[type="text"],input[type="number"]');var v=[];for(var i=0;i<inputs.length;i++){if(inputs[i].offsetParent!==null&&inputs[i].type!=='hidden')v.push(inputs[i]);}if(v.length>=3){function s(e,val){var n=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set;n.call(e,val);e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));}s(v[0],'${numero}');s(v[1],'${mark}');s(v[2],'${annee}');return 'filled';}else if(v.length>=1){var n=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set;n.call(v[0],'${numero}/${mark}/${annee}');v[0].dispatchEvent(new Event('input',{bubbles:true}));v[0].dispatchEvent(new Event('change',{bubbles:true}));return 'filled-combined';}return 'no inputs';})()` },
      { wait: 2000 },
      { evaluate: `(function(){var b=document.querySelectorAll('button.p-button,button[type="submit"]');for(var i=0;i<b.length;i++){var t=b[i].textContent||'';if(t.indexOf('بحث')!==-1||t.indexOf('عرض')!==-1){b[i].click();return 'clicked';}}return 'no btn';})()` },
      { wait: 12000 },
    ],
  };

  const params = new URLSearchParams({
    api_key: SCRAPINGBEE_API_KEY,
    url: 'https://www.mahakim.ma/#/suivi/dossier-suivi',
    render_js: 'true',
    js_scenario: JSON.stringify(jsScenario),
    timeout: '120000',
    block_resources: 'false',
    block_ads: 'true',
    premium_proxy: 'true',    // ← Residential proxy (bypasses cloud IP blocks)
    country_code: 'ma',       // ← Moroccan IP
    wait_browser: 'networkidle2',
    stealth_proxy: 'true',
  });

  try {
    console.log(`[ScrapingBee] Fetching case ${caseNumber} with residential proxy...`);
    const response = await fetch(`https://app.scrapingbee.com/api/v1?${params.toString()}`, {
      method: 'GET',
      signal: AbortSignal.timeout(115000),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[ScrapingBee] Error ${response.status}:`, errorText.slice(0, 300));
      return { html: '', success: false, error: `خطأ ScrapingBee: ${response.status}` };
    }

    const html = await response.text();
    console.log(`[ScrapingBee] Got ${html.length} chars for case ${caseNumber}`);
    return { html, success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error('[ScrapingBee] Fetch error:', msg);
    return { html: '', success: false, error: `خطأ في الاتصال: ${msg}` };
  }
}

/* ── Parse HTML to extract case data ── */
function parseResults(html: string): {
  caseInfo: Record<string, string>;
  procedures: Array<Record<string, string>>;
  nextSessionDate: string | null;
  hasData: boolean;
} {
  const caseInfo: Record<string, string> = {};

  const fieldPatterns: Record<string, RegExp> = {
    court: /المحكمة[:\s]*([^\n<|]+)/,
    national_number: /الرقم الوطني[:\s]*([^\n<|]+)/,
    case_type: /نوع القضية[:\s]*([^\n<|]+)/,
    department: /الشعبة[:\s]*([^\n<|]+)/,
    judge: /القاضي المقرر[:\s]*([^\n<|]+)/,
    subject: /الموضوع[:\s]*([^\n<|]+)/,
    status: /الحالة[:\s]*([^\n<|]+)/,
    registration_date: /تاريخ التسجيل[:\s]*([^\n<|]+)/,
  };

  for (const [key, pattern] of Object.entries(fieldPatterns)) {
    const match = html.match(pattern);
    if (match) caseInfo[key] = match[1].trim();
  }

  // Extract procedures table
  const procedures: Array<Record<string, string>> = [];
  const rowMatches = html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi);
  for (const rowMatch of rowMatches) {
    const cells: string[] = [];
    const cellMatches = rowMatch[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi);
    for (const cellMatch of cellMatches) {
      cells.push(cellMatch[1].replace(/<[^>]*>/g, '').trim());
    }
    if (cells.length >= 3 && cells[0]?.match(/\d/)) {
      procedures.push({
        action_date: cells[0],
        action_type: cells[1] || '',
        decision: cells[2] || '',
        next_session_date: cells[3] || '',
      });
    }
  }

  // Find next future session
  const now = new Date();
  let nextSessionDate: string | null = null;
  for (const proc of procedures) {
    const d = proc.next_session_date;
    if (d && d.match(/\d{2}\/\d{2}\/\d{4}/)) {
      const [day, month, year] = d.split('/');
      const date = new Date(`${year}-${month}-${day}`);
      if (date >= now && (!nextSessionDate || date < new Date(nextSessionDate))) {
        nextSessionDate = d;
      }
    }
  }

  return {
    caseInfo,
    procedures,
    nextSessionDate,
    hasData: Object.keys(caseInfo).length > 0 || procedures.length > 0,
  };
}

/* ── Process scraped data and save to DB ── */
async function processAndSave(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  jobId: string,
  caseId: string,
  userId: string,
  caseInfo: Record<string, string>,
  procedures: Array<Record<string, string>>,
  nextSessionDateStr: string | null,
): Promise<string[]> {
  const log: string[] = [];

  // 1. Update case metadata
  const caseUpdates: Record<string, unknown> = {
    last_synced_at: new Date().toISOString(),
    last_sync_result: { caseInfo, procedures, synced_via: 'scrapingbee_residential' },
  };
  if (caseInfo.judge) caseUpdates.mahakim_judge = caseInfo.judge;
  if (caseInfo.department) caseUpdates.mahakim_department = caseInfo.department;
  if (caseInfo.status) caseUpdates.mahakim_status = caseInfo.status;
  if (caseInfo.court) caseUpdates.court = caseInfo.court;

  await supabase.from('cases').update(caseUpdates).eq('id', caseId);
  log.push('تم تحديث بيانات الملف');

  // 2. Insert new procedures (deduplicate)
  if (procedures.length > 0) {
    const { data: existingProcs } = await supabase
      .from('case_procedures')
      .select('action_date, action_type')
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
        action_type: p.action_type || '',
        decision: p.decision || null,
        next_session_date: p.next_session_date || null,
        source: 'mahakim',
        is_manual: false,
      }));

    if (newProcs.length > 0) {
      await supabase.from('case_procedures').insert(newProcs);
      log.push(`تم إضافة ${newProcs.length} إجراء جديد`);
    }
  }

  // 3. Create next court session if found
  if (nextSessionDateStr) {
    let nextDateISO: string | null = null;
    if (nextSessionDateStr.match(/^\d{2}\/\d{2}\/\d{4}$/)) {
      const [d, m, y] = nextSessionDateStr.split('/');
      nextDateISO = `${y}-${m}-${d}`;
    } else if (nextSessionDateStr.match(/^\d{4}-\d{2}-\d{2}/)) {
      nextDateISO = nextSessionDateStr.substring(0, 10);
    }

    if (nextDateISO) {
      const { data: existing } = await supabase
        .from('court_sessions')
        .select('id')
        .eq('case_id', caseId)
        .eq('session_date', nextDateISO)
        .limit(1);

      if (!existing || existing.length === 0) {
        await supabase.from('court_sessions').insert({
          case_id: caseId,
          session_date: nextDateISO,
          user_id: userId,
          notes: 'تم الجلب تلقائياً من بوابة محاكم',
          status: 'scheduled',
        });
        log.push(`تم إنشاء جلسة مقبلة: ${nextDateISO}`);
      }

      // Update sync job with next session date
      await supabase.from('mahakim_sync_jobs').update({
        next_session_date: nextDateISO,
      }).eq('id', jobId);
    }
  }

  return log;
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
    const supabase = getSupabaseAdmin();

    // ── ACTION: submitSyncJob ──
    if (action === 'submitSyncJob') {
      const { jobId, caseId, userId, caseNumber, appealCourt } = body;

      if (!jobId || !caseId || !caseNumber) {
        return new Response(JSON.stringify({ success: false, error: 'بيانات ناقصة' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Update job status to scraping
      await supabase.from('mahakim_sync_jobs').update({
        status: 'scraping',
        updated_at: new Date().toISOString(),
      }).eq('id', jobId);

      // Scrape with ScrapingBee + residential proxy
      const { html, success, error: scrapeError } = await scrapeCase(caseNumber, appealCourt);

      if (!success || !html) {
        await supabase.from('mahakim_sync_jobs').update({
          status: 'failed',
          error_message: scrapeError || 'فشل جلب البيانات من بوابة محاكم',
          updated_at: new Date().toISOString(),
          completed_at: new Date().toISOString(),
        }).eq('id', jobId);

        return new Response(JSON.stringify({ success: false, error: scrapeError, status: 'failed' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Parse and save results
      const { caseInfo, procedures, nextSessionDate, hasData } = parseResults(html);

      if (!hasData) {
        await supabase.from('mahakim_sync_jobs').update({
          status: 'failed',
          error_message: 'لم يتم العثور على بيانات للملف. تأكد من صحة رقم الملف.',
          result_data: { htmlLength: html.length },
          updated_at: new Date().toISOString(),
          completed_at: new Date().toISOString(),
        }).eq('id', jobId);

        return new Response(JSON.stringify({ success: false, status: 'failed', error: 'لم يتم العثور على بيانات' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const log = await processAndSave(supabase, jobId, caseId, userId, caseInfo, procedures, nextSessionDate);

      // Mark job completed
      await supabase.from('mahakim_sync_jobs').update({
        status: 'completed',
        result_data: { caseInfo, procedures, mapping_log: log },
        updated_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
      }).eq('id', jobId);

      console.log(`[Bridge] Case ${caseNumber} synced: ${log.join(', ')}`);

      return new Response(JSON.stringify({
        success: true,
        status: 'completed',
        mapping_log: log,
        next_session_date: nextSessionDate,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── ACTION: getLatestSync ──
    if (action === 'getLatestSync') {
      const { caseId } = body;
      const { data } = await supabase
        .from('mahakim_sync_jobs')
        .select('*')
        .eq('case_id', caseId)
        .order('created_at', { ascending: false })
        .limit(1);

      return new Response(JSON.stringify({ success: true, data: data?.[0] || null }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── ACTION: bulkSync ──
    if (action === 'bulkSync') {
      const { userId } = body;
      const { data: cases } = await supabase
        .from('cases')
        .select('id, case_number')
        .neq('case_number', '')
        .not('case_number', 'is', null)
        .eq('status', 'active');

      if (!cases || cases.length === 0) {
        return new Response(JSON.stringify({ success: true, message: 'لا توجد ملفات نشطة', processed: 0 }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      let triggered = 0;
      for (const c of cases) {
        const { data: existing } = await supabase
          .from('mahakim_sync_jobs')
          .select('id')
          .eq('case_id', c.id)
          .in('status', ['pending', 'scraping'])
          .limit(1);

        if (existing && existing.length > 0) continue;

        const jobId = crypto.randomUUID();
        await supabase.from('mahakim_sync_jobs').insert({
          id: jobId,
          case_id: c.id,
          user_id: userId || '00000000-0000-0000-0000-000000000000',
          case_number: c.case_number!,
          status: 'pending',
          request_payload: { auto_triggered: true, bulk: true },
        });
        triggered++;
      }

      return new Response(JSON.stringify({ success: true, triggered, total: cases.length }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({
      success: false,
      error: 'إجراء غير معروف',
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
