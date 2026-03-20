import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { DOMParser } from 'https://esm.sh/linkedom@0.16.11';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

/* ══════════════════════════════════════════════════════════════════
   fetch-dossier v2 — Production Court Data Bridge
   
   Architecture:
     1. Primary: Direct API call (reverse-engineered REST endpoint)
     2. Fallback: ScrapingBee headless browser with residential proxies
   
   Features:
     - DOM parsing via linkedom (no regex)
     - Exponential backoff retry
     - Request throttling with randomized delays
     - Anti-bot detection
     - Database queue integration
     - Full logging
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
  source: 'api' | 'scraper';
}

interface ScrapeLog {
  timestamp: string;
  case: string;
  method: string;
  success: boolean;
  duration_ms: number;
  error?: string;
  html_length?: number;
}

const logs: ScrapeLog[] = [];

function log(entry: Omit<ScrapeLog, 'timestamp'>) {
  const full = { ...entry, timestamp: new Date().toISOString() };
  logs.push(full);
  console.log(`[fetch-dossier] ${entry.method} ${entry.case}: ${entry.success ? '✓' : '✗'} (${entry.duration_ms}ms)${entry.error ? ' — ' + entry.error : ''}`);
}

/* ── Randomized delay for throttling ── */
function randomDelay(minMs = 2000, maxMs = 5000): Promise<void> {
  const ms = minMs + Math.random() * (maxMs - minMs);
  return new Promise(r => setTimeout(r, ms));
}

/* ── Exponential backoff ── */
async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  baseDelay = 2000,
): Promise<T> {
  let lastError: Error | undefined;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < maxRetries) {
        const delay = baseDelay * Math.pow(2, attempt) + Math.random() * 1000;
        console.log(`[retry] Attempt ${attempt + 1}/${maxRetries} failed, retrying in ${Math.round(delay)}ms...`);
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }
  throw lastError;
}

/* ══════════════════════════════════════════════════════════════════
   STRATEGY 1: Direct API Call (reverse-engineered)
   Base: https://www.mahakim.ma/Ar/Services/SuiviAffaires_new/JFunctions/fn.aspx
   ══════════════════════════════════════════════════════════════════ */
async function tryDirectApi(
  input: CaseInput,
): Promise<{ data: any; success: boolean; error?: string }> {
  const API_BASE = 'https://www.mahakim.ma/Ar/Services/SuiviAffaires_new/JFunctions/fn.aspx';
  const start = Date.now();

  try {
    // Try fetching case details via the old ASPX API
    const searchPayload = {
      idJuridiction: '',
      numero: input.numero,
      code: input.code,
      annee: input.annee,
    };

    // Attempt multiple known endpoints
    const endpoints = [
      '/getSuiviDossier',
      '/RechercherDossier',
      '/getDetailDossier',
      '/GetInfoDossier',
    ];

    for (const endpoint of endpoints) {
      try {
        const resp = await fetch(`${API_BASE}${endpoint}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Origin': 'https://www.mahakim.ma',
            'Referer': 'https://www.mahakim.ma/',
          },
          body: JSON.stringify(searchPayload),
          signal: AbortSignal.timeout(15000),
        });

        if (resp.ok) {
          const text = await resp.text();
          try {
            const json = JSON.parse(text);
            if (json.d || json.data || json.result) {
              log({ case: `${input.numero}/${input.code}/${input.annee}`, method: `api:${endpoint}`, success: true, duration_ms: Date.now() - start });
              return { data: json.d || json.data || json.result || json, success: true };
            }
          } catch {
            // Not JSON, skip
          }
        }
      } catch {
        // Endpoint doesn't exist or timed out, try next
      }
    }

    log({ case: `${input.numero}/${input.code}/${input.annee}`, method: 'api:all', success: false, duration_ms: Date.now() - start, error: 'No working API endpoint found' });
    return { data: null, success: false, error: 'API endpoints not available' };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown';
    log({ case: `${input.numero}/${input.code}/${input.annee}`, method: 'api', success: false, duration_ms: Date.now() - start, error: msg });
    return { data: null, success: false, error: msg };
  }
}

/* ══════════════════════════════════════════════════════════════════
   STRATEGY 2: ScrapingBee Headless Browser (fallback)
   Uses residential Moroccan proxies + stealth mode
   ══════════════════════════════════════════════════════════════════ */
function buildJsScenario(numero: string, code: string, annee: string) {
  return {
    instructions: [
      // Wait for Angular SPA PrimeNG dropdown to render
      { wait_for: '.p-dropdown', timeout: 30000 },
      // Open court dropdown and select first real option
      {
        evaluate: `(function(){
          var dd = document.querySelector('.p-dropdown');
          if (!dd) return 'no-dropdown';
          dd.click();
          return 'opened';
        })()`
      },
      { wait: 2000 },
      // Select first court option using semantic selectors
      {
        evaluate: `(function(){
          var items = document.querySelectorAll('.p-dropdown-panel .p-dropdown-item, .p-dropdown-items li.p-dropdown-item');
          if(items.length > 1) { items[1].click(); return 'selected:' + items[1].textContent.trim().substring(0,30); }
          if(items.length === 1) { items[0].click(); return 'selected-only:' + items[0].textContent.trim().substring(0,30); }
          return 'no-items:' + items.length;
        })()`
      },
      { wait: 2000 },
      // Fill form using formcontrolname attributes (semantic, not positional)
      {
        evaluate: `(function(){
          var results = [];
          // Try semantic selectors first
          var numero = document.querySelector('input[formcontrolname="numero"]');
          var annee = document.querySelector('input[formcontrolname="annee"]');
          var code = document.querySelector('input[formcontrolname="code"]');

          function setVal(el, val, name){
            if(!el) { results.push(name+':not-found'); return false; }
            var setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
            setter.call(el, val);
            el.dispatchEvent(new Event('input', {bubbles:true}));
            el.dispatchEvent(new Event('change', {bubbles:true}));
            el.dispatchEvent(new Event('blur', {bubbles:true}));
            results.push(name+':ok');
            return true;
          }

          if (numero || annee) {
            setVal(numero, '${numero}', 'numero');
            if (code) setVal(code, '${code}', 'code');
            setVal(annee, '${annee}', 'annee');
            return 'semantic:' + results.join(',');
          }

          // Fallback: visible inputs by position
          var inputs = document.querySelectorAll('input.p-inputtext, input[pinputtext], input[type="text"], input[type="number"]');
          var visible = [];
          for(var i=0; i<inputs.length; i++){
            if(inputs[i].offsetParent !== null && inputs[i].type !== 'hidden') visible.push(inputs[i]);
          }
          if(visible.length >= 3){
            setVal(visible[0], '${numero}', 'pos0');
            setVal(visible[1], '${code}', 'pos1');
            setVal(visible[2], '${annee}', 'pos2');
            return 'positional:' + results.join(',');
          } else if(visible.length >= 1){
            setVal(visible[0], '${numero}/${code}/${annee}', 'combined');
            return 'combined:' + results.join(',');
          }
          return 'no-inputs';
        })()`
      },
      { wait: 2000 },
      // Click search button using semantic matching
      {
        evaluate: `(function(){
          // Try formcontrolname submit first
          var submit = document.querySelector('button[type="submit"]');
          if (submit) { submit.click(); return 'clicked-submit'; }
          // Try PrimeNG button with search text
          var buttons = document.querySelectorAll('button.p-button, p-button button');
          for(var i=0; i<buttons.length; i++){
            var t = (buttons[i].textContent || '').trim();
            if(t.indexOf('بحث') !== -1 || t.indexOf('عرض') !== -1 || t.indexOf('search') !== -1){
              buttons[i].click();
              return 'clicked:' + t.substring(0,20);
            }
          }
          // Last resort: Enter key on last input
          var last = document.querySelector('input[formcontrolname="annee"]');
          if(last) {
            last.dispatchEvent(new KeyboardEvent('keydown', {key:'Enter', code:'Enter', bubbles:true}));
            return 'enter-key';
          }
          return 'no-trigger';
        })()`
      },
      // Wait for dynamic results (longer timeout for SPA)
      { wait: 15000 },
    ],
  };
}

async function scrapeViaScrapingBee(
  apiKey: string,
  input: CaseInput,
): Promise<{ html: string; success: boolean; error?: string }> {
  const start = Date.now();
  const scenario = buildJsScenario(input.numero, input.code, input.annee);
  const caseLabel = `${input.numero}/${input.code}/${input.annee}`;

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
    const resp = await fetch(`https://app.scrapingbee.com/api/v1?${params.toString()}`, {
      method: 'GET',
      signal: AbortSignal.timeout(115000),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      const error = `ScrapingBee ${resp.status}: ${errText.slice(0, 200)}`;
      log({ case: caseLabel, method: 'scrapingbee', success: false, duration_ms: Date.now() - start, error });
      return { html: '', success: false, error };
    }

    const html = await resp.text();

    // Anti-bot detection
    if (detectAntiBot(html)) {
      log({ case: caseLabel, method: 'scrapingbee', success: false, duration_ms: Date.now() - start, error: 'Anti-bot page detected', html_length: html.length });
      return { html: '', success: false, error: 'تم اكتشاف صفحة حماية ضد الروبوتات — يُرجى المحاولة لاحقاً' };
    }

    log({ case: caseLabel, method: 'scrapingbee', success: true, duration_ms: Date.now() - start, html_length: html.length });
    return { html, success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown';
    log({ case: caseLabel, method: 'scrapingbee', success: false, duration_ms: Date.now() - start, error: msg });
    return { html: '', success: false, error: msg };
  }
}

/* ── Anti-bot detection ── */
function detectAntiBot(html: string): boolean {
  const botSignals = [
    'captcha',
    'challenge-platform',
    'cf-browser-verification',
    'ray id',
    'access denied',
    'blocked',
    'please verify',
    'cloudflare',
    'just a moment',
  ];
  const lower = html.toLowerCase();
  return botSignals.some(sig => lower.includes(sig)) && !lower.includes('p-dropdown');
}

/* ══════════════════════════════════════════════════════════════════
   DOM Parsing with linkedom (replaces all regex)
   ══════════════════════════════════════════════════════════════════ */
function parseWithDom(html: string): {
  caseInfo: Record<string, string>;
  procedures: Array<Record<string, string>>;
  nextSessionDate: string | null;
  hasData: boolean;
} {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const caseInfo: Record<string, string> = {};

  // Extract labeled fields using semantic DOM traversal
  const fieldMap: Record<string, string[]> = {
    court: ['المحكمة'],
    national_number: ['الرقم الوطني'],
    case_type: ['نوع القضية', 'نوع الملف'],
    department: ['الشعبة'],
    judge: ['القاضي المقرر', 'القاضي'],
    subject: ['الموضوع'],
    status: ['الحالة'],
    registration_date: ['تاريخ التسجيل'],
  };

  // Strategy 1: Find label-value pairs in the DOM
  const allElements = doc.querySelectorAll('span, div, td, th, label, p, strong');
  for (const el of allElements) {
    const text = (el.textContent || '').trim();
    for (const [key, labels] of Object.entries(fieldMap)) {
      if (caseInfo[key]) continue;
      for (const label of labels) {
        if (text.includes(label)) {
          // Value is either in the next sibling or in a child element
          const nextSibling = el.nextElementSibling;
          if (nextSibling) {
            const val = (nextSibling.textContent || '').trim();
            if (val && val.length < 200 && val !== label) {
              caseInfo[key] = val;
              break;
            }
          }
          // Try extracting value after the colon
          const colonIdx = text.indexOf(':');
          if (colonIdx > -1) {
            const val = text.substring(colonIdx + 1).trim();
            if (val && val.length < 200) {
              caseInfo[key] = val;
              break;
            }
          }
        }
      }
    }
  }

  // Strategy 2: Parse table rows for procedures
  const procedures: Array<Record<string, string>> = [];
  const tables = doc.querySelectorAll('table');

  for (const table of tables) {
    const rows = table.querySelectorAll('tr');
    for (const row of rows) {
      const cells = row.querySelectorAll('td');
      if (cells.length < 3) continue;

      const cellTexts = Array.from(cells).map(c => (c.textContent || '').trim());
      
      // A procedure row typically has a date-like value in the first cell
      if (cellTexts[0] && /\d/.test(cellTexts[0])) {
        procedures.push({
          action_date: cellTexts[0],
          action_type: cellTexts[1] || '',
          decision: cellTexts[2] || '',
          next_session_date: cellTexts[3] || '',
        });
      }
    }
  }

  // Strategy 3: Check for "no results" message
  const noResultsEl = doc.querySelector('p');
  const bodyText = doc.body?.textContent || '';
  if (bodyText.includes('لا توجد أية نتيجة للبحث')) {
    return { caseInfo: {}, procedures: [], nextSessionDate: null, hasData: false };
  }

  // Find next future session
  const now = new Date();
  let nextSessionDate: string | null = null;
  for (const proc of procedures) {
    const d = proc.next_session_date;
    if (d && /\d{2}\/\d{2}\/\d{4}/.test(d)) {
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

/* ── Parse API response (if direct API works) ── */
function parseApiResponse(data: any): {
  caseInfo: Record<string, string>;
  procedures: Array<Record<string, string>>;
  nextSessionDate: string | null;
  hasData: boolean;
} {
  const caseInfo: Record<string, string> = {};
  const procedures: Array<Record<string, string>> = [];

  if (Array.isArray(data)) {
    // API returns array of items
    for (const item of data) {
      if (item.nomJuridiction) caseInfo.court = item.nomJuridiction;
      if (item.nomJuge) caseInfo.judge = item.nomJuge;
      if (item.etatDossier) caseInfo.status = item.etatDossier;
      if (item.typeDossier) caseInfo.case_type = item.typeDossier;
      if (item.chambre) caseInfo.department = item.chambre;
      if (item.dateEnregistrement) caseInfo.registration_date = item.dateEnregistrement;
      if (item.objet) caseInfo.subject = item.objet;

      // Procedures
      if (item.procedures && Array.isArray(item.procedures)) {
        for (const proc of item.procedures) {
          procedures.push({
            action_date: proc.dateAction || proc.date || '',
            action_type: proc.typeAction || proc.action || '',
            decision: proc.decision || '',
            next_session_date: proc.dateProchaine || '',
          });
        }
      }
    }
  } else if (typeof data === 'object' && data !== null) {
    // Map common field names
    const fieldMappings: Record<string, string[]> = {
      court: ['nomJuridiction', 'juridiction', 'tribunal'],
      judge: ['nomJuge', 'juge', 'magistrat'],
      status: ['etatDossier', 'etat', 'statut'],
      case_type: ['typeDossier', 'type'],
      department: ['chambre', 'section'],
      registration_date: ['dateEnregistrement', 'dateCreation'],
      subject: ['objet', 'sujet'],
    };
    for (const [key, aliases] of Object.entries(fieldMappings)) {
      for (const alias of aliases) {
        if (data[alias]) { caseInfo[key] = String(data[alias]); break; }
      }
    }
  }

  // Find next session
  const now = new Date();
  let nextSessionDate: string | null = null;
  for (const proc of procedures) {
    const d = proc.next_session_date;
    if (d) {
      const parsed = new Date(d);
      if (!isNaN(parsed.getTime()) && parsed >= now) {
        if (!nextSessionDate || parsed < new Date(nextSessionDate)) {
          nextSessionDate = parsed.toISOString().substring(0, 10);
        }
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
  const persistLog: string[] = [];
  if (!caseId) return persistLog;

  const updates: Record<string, unknown> = {
    last_synced_at: new Date().toISOString(),
    last_sync_result: {
      caseInfo: result.caseInfo,
      procedures: result.procedures,
      synced_via: result.source,
    },
  };
  if (result.caseInfo.judge) updates.mahakim_judge = result.caseInfo.judge;
  if (result.caseInfo.department) updates.mahakim_department = result.caseInfo.department;
  if (result.caseInfo.status) updates.mahakim_status = result.caseInfo.status;
  if (result.caseInfo.court) updates.court = result.caseInfo.court;

  await supabase.from('cases').update(updates).eq('id', caseId);
  persistLog.push('تم تحديث بيانات الملف');

  // Deduplicate and insert procedures
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
      persistLog.push(`تم إضافة ${newProcs.length} إجراء جديد`);
    }
  }

  // Schedule next court session
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
      persistLog.push(`تم إنشاء جلسة مقبلة: ${dateISO}`);
    }
  }

  return persistLog;
}

/* ══════════════════════════════════════════════════════════════════
   Queue Processing — processes pending jobs from mahakim_sync_jobs
   ══════════════════════════════════════════════════════════════════ */
async function processQueue(
  supabase: ReturnType<typeof createClient>,
  apiKey: string,
  limit = 5,
): Promise<{ processed: number; results: CaseResult[] }> {
  const { data: pendingJobs } = await supabase
    .from('mahakim_sync_jobs')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(limit);

  if (!pendingJobs || pendingJobs.length === 0) {
    return { processed: 0, results: [] };
  }

  const results: CaseResult[] = [];

  for (let i = 0; i < pendingJobs.length; i++) {
    const job = pendingJobs[i];
    
    // Throttle between requests
    if (i > 0) await randomDelay(2000, 5000);

    // Mark as scraping
    await supabase.from('mahakim_sync_jobs').update({
      status: 'scraping',
      updated_at: new Date().toISOString(),
    }).eq('id', job.id);

    // Parse case number
    const parts = job.case_number.split('/');
    const input: CaseInput = {
      numero: parts[0] || '',
      code: parts[1] || '',
      annee: parts[2] || '',
    };

    try {
      const result = await withRetry(
        () => fetchSingleCase(apiKey, input),
        job.max_retries || 2,
      );

      results.push(result);

      // Persist to DB
      const persistLog = await persistResults(supabase, job.case_id, job.user_id, result);

      // Update job
      await supabase.from('mahakim_sync_jobs').update({
        status: result.status === 'success' ? 'completed' : 'failed',
        result_data: result.caseInfo,
        error_message: result.error || null,
        next_session_date: result.nextSessionDate,
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq('id', job.id);

    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Unknown error';
      await supabase.from('mahakim_sync_jobs').update({
        status: 'failed',
        error_message: errMsg,
        retry_count: (job.retry_count || 0) + 1,
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq('id', job.id);
    }
  }

  return { processed: results.length, results };
}

/* ── Core: fetch single case (API-first, ScrapingBee fallback) ── */
async function fetchSingleCase(apiKey: string, input: CaseInput): Promise<CaseResult> {
  const caseLabel = `${input.numero}/${input.code}/${input.annee}`;

  // Strategy 1: Direct API
  const apiResult = await tryDirectApi(input);
  if (apiResult.success && apiResult.data) {
    const parsed = parseApiResponse(apiResult.data);
    if (parsed.hasData) {
      return {
        ...input,
        status: 'success',
        caseInfo: parsed.caseInfo,
        procedures: parsed.procedures,
        nextSessionDate: parsed.nextSessionDate,
        source: 'api',
      };
    }
  }

  // Strategy 2: ScrapingBee fallback
  const { html, success, error: scrapeErr } = await scrapeViaScrapingBee(apiKey, input);

  if (!success || !html) {
    return {
      ...input,
      status: 'error',
      caseInfo: {},
      procedures: [],
      nextSessionDate: null,
      error: scrapeErr || 'فشل جلب البيانات',
      source: 'scraper',
    };
  }

  const parsed = parseWithDom(html);

  if (!parsed.hasData) {
    return {
      ...input,
      status: 'no_data',
      caseInfo: {},
      procedures: [],
      nextSessionDate: null,
      error: 'لم يتم العثور على بيانات — تأكد من صحة رقم الملف',
      source: 'scraper',
    };
  }

  return {
    ...input,
    status: 'success',
    caseInfo: parsed.caseInfo,
    procedures: parsed.procedures,
    nextSessionDate: parsed.nextSessionDate,
    source: 'scraper',
  };
}

/* ══════════════════════════════════════════════════════════════════
   Main HTTP Handler
   ══════════════════════════════════════════════════════════════════ */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { action, cases, userId, caseId } = body as {
      action?: string;
      cases?: CaseInput[];
      userId?: string;
      caseId?: string;
    };

    const SCRAPINGBEE_API_KEY = Deno.env.get('SCRAPINGBEE_API_KEY');
    if (!SCRAPINGBEE_API_KEY) {
      return new Response(JSON.stringify({
        status: 'error',
        error: 'مفتاح ScrapingBee غير مُعدّ',
      }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // ── ACTION: processQueue — process pending jobs from DB ──
    if (action === 'processQueue') {
      const { processed, results } = await processQueue(supabase, SCRAPINGBEE_API_KEY, 5);
      return new Response(JSON.stringify({
        status: 'success',
        processed,
        results: results.map(r => ({
          numero: r.numero, status: r.status, source: r.source,
          procedures_count: r.procedures.length,
          next_session_date: r.nextSessionDate,
        })),
        logs,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ── ACTION: submitSyncJob — for compatibility with auto-trigger ──
    if (action === 'submitSyncJob') {
      const { jobId, caseId: jCaseId, caseNumber } = body;
      if (!jobId || !jCaseId || !caseNumber) {
        return new Response(JSON.stringify({ success: false, error: 'بيانات ناقصة' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      await supabase.from('mahakim_sync_jobs').update({
        status: 'scraping', updated_at: new Date().toISOString(),
      }).eq('id', jobId);

      const parts = caseNumber.split('/');
      const input: CaseInput = { numero: parts[0] || '', code: parts[1] || '', annee: parts[2] || '' };

      try {
        const result = await withRetry(() => fetchSingleCase(SCRAPINGBEE_API_KEY, input), 2);
        const persistLog = await persistResults(supabase, jCaseId, body.userId, result);

        await supabase.from('mahakim_sync_jobs').update({
          status: result.status === 'success' ? 'completed' : 'failed',
          result_data: result.caseInfo,
          error_message: result.error || null,
          next_session_date: result.nextSessionDate,
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }).eq('id', jobId);

        return new Response(JSON.stringify({
          success: result.status === 'success',
          status: result.status === 'success' ? 'completed' : 'failed',
          mapping_log: persistLog,
          next_session_date: result.nextSessionDate,
          source: result.source,
          logs,
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

      } catch (err) {
        const errMsg = err instanceof Error ? err.message : 'Unknown';
        await supabase.from('mahakim_sync_jobs').update({
          status: 'failed', error_message: errMsg,
          completed_at: new Date().toISOString(),
        }).eq('id', jobId);

        return new Response(JSON.stringify({
          success: false, status: 'failed', error: errMsg, logs,
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }

    // ── Default: Direct case fetch (POST /fetch-dossier with cases array) ──
    if (!cases || !Array.isArray(cases) || cases.length === 0) {
      return new Response(JSON.stringify({
        status: 'error',
        error: 'يجب توفير action أو مصفوفة cases [{numero, annee, code}]',
      }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Validate
    for (const c of cases) {
      if (!c.numero || !c.annee || !c.code) {
        return new Response(JSON.stringify({
          status: 'error',
          error: 'كل كائن يجب أن يحتوي على numero, annee, code',
        }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }

    // Cap batch
    const batch = cases.slice(0, 5);
    const results: CaseResult[] = [];

    for (let i = 0; i < batch.length; i++) {
      if (i > 0) await randomDelay(2000, 5000);

      try {
        const result = await withRetry(
          () => fetchSingleCase(SCRAPINGBEE_API_KEY, batch[i]),
          2,
        );
        results.push(result);

        if (caseId || userId) {
          await persistResults(supabase, caseId, userId, result);
        }
      } catch (err) {
        results.push({
          ...batch[i],
          status: 'error',
          caseInfo: {},
          procedures: [],
          nextSessionDate: null,
          error: err instanceof Error ? err.message : 'Unknown',
          source: 'scraper',
        });
      }
    }

    return new Response(JSON.stringify({
      status: 'success',
      processed: results.length,
      total_submitted: cases.length,
      results: results.map(r => ({
        numero: r.numero,
        annee: r.annee,
        code: r.code,
        status: r.status,
        source: r.source,
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
      logs,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error('[fetch-dossier] Fatal:', error);
    return new Response(JSON.stringify({
      status: 'error',
      error: error instanceof Error ? error.message : 'خطأ غير معروف',
      logs,
    }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
