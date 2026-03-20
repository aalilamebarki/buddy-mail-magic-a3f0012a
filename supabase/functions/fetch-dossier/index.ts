import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

/* ══════════════════════════════════════════════════════════════════
   fetch-dossier — Production Court Data Bridge
   
   POST /fetch-dossier
   Body: { cases: [{ numero, annee, code }], userId?, caseId? }
   
   Uses ScrapingBee with Moroccan residential proxies + stealth mode
   to bypass Mahakim.ma cloud IP blocking.
   ══════════════════════════════════════════════════════════════════ */

interface CaseInput {
  numero: string;
  annee: string;
  code: string;
}

interface CaseResult {
  numero: string;
  annee: string;
  code: string;
  status: 'success' | 'error' | 'no_data';
  caseInfo: Record<string, string>;
  procedures: Array<Record<string, string>>;
  nextSessionDate: string | null;
  error?: string;
}

/* ── Build JS scenario for Mahakim SPA interaction ── */
function buildJsScenario(numero: string, code: string, annee: string) {
  return {
    instructions: [
      // Wait for Angular SPA to render
      { wait_for: '.p-dropdown', timeout: 30000 },
      // Open court dropdown and select first real option
      { click: '.p-dropdown' },
      { wait: 2000 },
      {
        evaluate: `(function(){
          var items = document.querySelectorAll('.p-dropdown-panel .p-dropdown-item, .p-dropdown-items li');
          if(items.length > 1) { items[1].click(); return 'selected'; }
          return 'no items';
        })()`
      },
      { wait: 2000 },
      // Fill in case number fields using React-compatible setter
      {
        evaluate: `(function(){
          var inputs = document.querySelectorAll('input.p-inputtext, input[pinputtext], input[type="text"], input[type="number"]');
          var visible = [];
          for(var i = 0; i < inputs.length; i++){
            if(inputs[i].offsetParent !== null && inputs[i].type !== 'hidden') visible.push(inputs[i]);
          }
          function setVal(el, val){
            var setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
            setter.call(el, val);
            el.dispatchEvent(new Event('input', {bubbles:true}));
            el.dispatchEvent(new Event('change', {bubbles:true}));
          }
          if(visible.length >= 3){
            setVal(visible[0], '${numero}');
            setVal(visible[1], '${code}');
            setVal(visible[2], '${annee}');
            return 'filled-3-fields';
          } else if(visible.length >= 1){
            setVal(visible[0], '${numero}/${code}/${annee}');
            return 'filled-combined';
          }
          return 'no-inputs-found';
        })()`
      },
      { wait: 2000 },
      // Click search button
      {
        evaluate: `(function(){
          var buttons = document.querySelectorAll('button.p-button, button[type="submit"]');
          for(var i = 0; i < buttons.length; i++){
            var t = buttons[i].textContent || '';
            if(t.indexOf('بحث') !== -1 || t.indexOf('عرض') !== -1){
              buttons[i].click();
              return 'clicked-search';
            }
          }
          return 'no-search-button';
        })()`
      },
      // Wait for results to render (Angular SPA needs time)
      { wait: 12000 },
    ],
  };
}

/* ── Scrape a single case via ScrapingBee ── */
async function scrapeSingleCase(
  apiKey: string,
  input: CaseInput,
): Promise<{ html: string; success: boolean; error?: string }> {
  const scenario = buildJsScenario(input.numero, input.code, input.annee);

  const params = new URLSearchParams({
    api_key: apiKey,
    url: 'https://www.mahakim.ma/#/suivi/dossier-suivi',
    render_js: 'true',
    js_scenario: JSON.stringify(scenario),
    timeout: '120000',
    block_resources: 'false',
    block_ads: 'true',
    premium_proxy: 'true',
    country_code: 'ma',
    wait_browser: 'networkidle2',
    stealth_proxy: 'true',
  });

  try {
    console.log(`[fetch-dossier] Scraping ${input.numero}/${input.code}/${input.annee}...`);
    const resp = await fetch(`https://app.scrapingbee.com/api/v1?${params.toString()}`, {
      method: 'GET',
      signal: AbortSignal.timeout(115000),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      console.error(`[fetch-dossier] ScrapingBee ${resp.status}:`, errText.slice(0, 300));
      return { html: '', success: false, error: `ScrapingBee error ${resp.status}` };
    }

    const html = await resp.text();
    console.log(`[fetch-dossier] Got ${html.length} chars`);
    return { html, success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error('[fetch-dossier] Fetch error:', msg);
    return { html: '', success: false, error: msg };
  }
}

/* ── Parse HTML DOM to structured data ── */
function parseHtml(html: string): {
  caseInfo: Record<string, string>;
  procedures: Array<Record<string, string>>;
  nextSessionDate: string | null;
  hasData: boolean;
} {
  const caseInfo: Record<string, string> = {};

  const patterns: Record<string, RegExp> = {
    court: /المحكمة[:\s]*([^\n<|]+)/,
    national_number: /الرقم الوطني[:\s]*([^\n<|]+)/,
    case_type: /نوع القضية[:\s]*([^\n<|]+)/,
    department: /الشعبة[:\s]*([^\n<|]+)/,
    judge: /القاضي المقرر[:\s]*([^\n<|]+)/,
    subject: /الموضوع[:\s]*([^\n<|]+)/,
    status: /الحالة[:\s]*([^\n<|]+)/,
    registration_date: /تاريخ التسجيل[:\s]*([^\n<|]+)/,
  };

  for (const [key, pattern] of Object.entries(patterns)) {
    const match = html.match(pattern);
    if (match) caseInfo[key] = match[1].trim();
  }

  // Extract procedures from table rows
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
      const parsed = new Date(`${year}-${month}-${day}`);
      if (parsed >= now && (!nextSessionDate || parsed < new Date(nextSessionDate))) {
        nextSessionDate = `${year}-${month}-${day}`;
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

/* ── Persist results to database ── */
async function persistResults(
  supabase: ReturnType<typeof createClient>,
  caseId: string | undefined,
  userId: string | undefined,
  result: CaseResult,
): Promise<string[]> {
  const log: string[] = [];
  if (!caseId) return log;

  // Update case metadata
  const updates: Record<string, unknown> = {
    last_synced_at: new Date().toISOString(),
    last_sync_result: {
      caseInfo: result.caseInfo,
      procedures: result.procedures,
      synced_via: 'fetch-dossier',
    },
  };
  if (result.caseInfo.judge) updates.mahakim_judge = result.caseInfo.judge;
  if (result.caseInfo.department) updates.mahakim_department = result.caseInfo.department;
  if (result.caseInfo.status) updates.mahakim_status = result.caseInfo.status;
  if (result.caseInfo.court) updates.court = result.caseInfo.court;

  await supabase.from('cases').update(updates).eq('id', caseId);
  log.push('تم تحديث بيانات الملف');

  // Insert new procedures (deduplicate)
  if (result.procedures.length > 0) {
    const { data: existing } = await supabase
      .from('case_procedures')
      .select('action_date, action_type')
      .eq('case_id', caseId)
      .eq('source', 'mahakim');

    const existingKeys = new Set(
      (existing || []).map((p: any) => `${p.action_date}|${p.action_type}`)
    );

    const newProcs = result.procedures
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

  // Create next court session if found
  if (result.nextSessionDate && userId) {
    const dateISO = result.nextSessionDate.substring(0, 10);
    const { data: existingSession } = await supabase
      .from('court_sessions')
      .select('id')
      .eq('case_id', caseId)
      .eq('session_date', dateISO)
      .limit(1);

    if (!existingSession || existingSession.length === 0) {
      await supabase.from('court_sessions').insert({
        case_id: caseId,
        session_date: dateISO,
        user_id: userId,
        notes: 'تم الجلب تلقائياً من بوابة محاكم',
        status: 'scheduled',
      });
      log.push(`تم إنشاء جلسة مقبلة: ${dateISO}`);
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
    const { cases, userId, caseId } = body as {
      cases: CaseInput[];
      userId?: string;
      caseId?: string; // optional: link results to a specific case record
    };

    if (!cases || !Array.isArray(cases) || cases.length === 0) {
      return new Response(JSON.stringify({
        status: 'error',
        error: 'يجب توفير مصفوفة cases تحتوي على كائنات {numero, annee, code}',
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Validate inputs
    for (const c of cases) {
      if (!c.numero || !c.annee || !c.code) {
        return new Response(JSON.stringify({
          status: 'error',
          error: `بيانات ناقصة: كل كائن يجب أن يحتوي على numero, annee, code`,
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    const SCRAPINGBEE_API_KEY = Deno.env.get('SCRAPINGBEE_API_KEY');
    if (!SCRAPINGBEE_API_KEY) {
      return new Response(JSON.stringify({
        status: 'error',
        error: 'مفتاح ScrapingBee غير مُعدّ في إعدادات النظام',
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Cap at 5 cases per request to avoid timeout
    const batch = cases.slice(0, 5);
    const results: CaseResult[] = [];

    for (let i = 0; i < batch.length; i++) {
      const input = batch[i];

      // Add delay between requests to avoid aggressive scraping
      if (i > 0) {
        await new Promise(r => setTimeout(r, 3000));
      }

      const { html, success, error: scrapeErr } = await scrapeSingleCase(SCRAPINGBEE_API_KEY, input);

      if (!success || !html) {
        results.push({
          ...input,
          status: 'error',
          caseInfo: {},
          procedures: [],
          nextSessionDate: null,
          error: scrapeErr || 'فشل جلب البيانات',
        });
        continue;
      }

      const parsed = parseHtml(html);

      if (!parsed.hasData) {
        results.push({
          ...input,
          status: 'no_data',
          caseInfo: {},
          procedures: [],
          nextSessionDate: null,
          error: 'لم يتم العثور على بيانات — تأكد من صحة رقم الملف',
        });
        continue;
      }

      const result: CaseResult = {
        ...input,
        status: 'success',
        caseInfo: parsed.caseInfo,
        procedures: parsed.procedures,
        nextSessionDate: parsed.nextSessionDate,
      };

      results.push(result);

      // Persist to DB if caseId provided
      if (caseId || userId) {
        try {
          const log = await persistResults(supabase, caseId, userId, result);
          console.log(`[fetch-dossier] Persisted: ${log.join(', ')}`);
        } catch (e) {
          console.error('[fetch-dossier] Persist error:', e);
        }
      }
    }

    const response = {
      status: 'success' as const,
      processed: results.length,
      total_submitted: cases.length,
      results: results.map(r => ({
        numero: r.numero,
        annee: r.annee,
        code: r.code,
        status: r.status,
        date: r.caseInfo.registration_date || null,
        court: r.caseInfo.court || null,
        judge: r.caseInfo.judge || null,
        department: r.caseInfo.department || null,
        case_type: r.caseInfo.case_type || null,
        case_status: r.caseInfo.status || null,
        next_session_date: r.nextSessionDate,
        procedures_count: r.procedures.length,
        procedures: r.procedures,
        details: r.caseInfo,
        error: r.error || null,
      })),
    };

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[fetch-dossier] Error:', error);
    return new Response(JSON.stringify({
      status: 'error',
      error: error instanceof Error ? error.message : 'خطأ غير معروف',
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
