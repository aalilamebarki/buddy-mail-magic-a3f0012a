import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

/* ══════════════════════════════════════════════════════════════════
   fetch-dossier v3 — Production Court Data Bridge
   
   Uses ScrapingBee with Moroccan residential proxies to bypass
   mahakim.ma's TCP-level cloud IP blocking.
   
   Tested flow: ~22 seconds per case (well within 120s edge limit)
   ══════════════════════════════════════════════════════════════════ */

interface CaseInput {
  numero: string;
  annee: string;
  code: string;
  courtType?: string; // CA, TPI, TC, TA, etc.
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

const logs: string[] = [];
function log(msg: string) {
  const entry = `[${new Date().toISOString()}] ${msg}`;
  logs.push(entry);
  console.log(entry);
}

/* ── Randomized delay for throttling ── */
function randomDelay(minMs = 2000, maxMs = 4000): Promise<void> {
  return new Promise(r => setTimeout(r, minMs + Math.random() * (maxMs - minMs)));
}

/* ══════════════════════════════════════════════════════════════════
   Court hierarchy auto-resolution
   Maps primary court names to their portal labels
   ══════════════════════════════════════════════════════════════════ */
interface CourtMapping {
  appealPortal: string;
  primaries: { name: string; portal: string }[];
}

const CIVIL_COURTS: CourtMapping[] = [
  { appealPortal: 'الرباط', primaries: [
    { name: 'الرباط', portal: 'الرباط' }, { name: 'تمارة', portal: 'تمارة' },
    { name: 'سلا', portal: 'سلا' }, { name: 'الخميسات', portal: 'الخميسات' },
    { name: 'تيفلت', portal: 'تيفلت' }, { name: 'الرماني', portal: 'الرماني' },
    { name: 'قسم قضاء الأسرة بالرباط', portal: 'قسم قضاء الأسرة بالرباط' },
    { name: 'قسم قضاء الأسرة بسلا', portal: 'قسم قضاء الأسرة بسلا' },
  ]},
  { appealPortal: 'القنيطرة', primaries: [
    { name: 'القنيطرة', portal: 'القنيطرة' }, { name: 'سيدي قاسم', portal: 'سيدي قاسم' },
    { name: 'مشرع بلقصيري', portal: 'مشرع بلقصيري' }, { name: 'سيدي سليمان', portal: 'سيدي سليمان' },
    { name: 'سوق أربعاء الغرب', portal: 'سوق أربعاء الغرب' },
  ]},
  { appealPortal: 'الدار البيضاء', primaries: [
    { name: 'المدنية بالدار البيضاء', portal: 'المدنية بالدار البيضاء' },
    { name: 'الزجرية بالدار البيضاء', portal: 'الزجرية بالدار البيضاء' },
    { name: 'الاجتماعية بالدار البيضاء', portal: 'الاجتماعية بالدار البيضاء' },
    { name: 'المحمدية', portal: 'المحمدية' }, { name: 'بنسليمان', portal: 'بنسليمان' },
    { name: 'بوزنيقة', portal: 'بوزنيقة' },
  ]},
  { appealPortal: 'الجديدة', primaries: [
    { name: 'الجديدة', portal: 'الجديدة' }, { name: 'سيدي بنور', portal: 'سيدي بنور' },
  ]},
  { appealPortal: 'فاس', primaries: [
    { name: 'فاس', portal: 'فاس' }, { name: 'تاونات', portal: 'تاونات' },
    { name: 'صفرو', portal: 'صفرو' }, { name: 'بولمان', portal: 'بولمان' },
  ]},
  { appealPortal: 'تازة', primaries: [
    { name: 'تازة', portal: 'تازة' }, { name: 'جرسيف', portal: 'جرسيف' },
  ]},
  { appealPortal: 'مراكش', primaries: [
    { name: 'مراكش', portal: 'مراكش' }, { name: 'تحناوت', portal: 'تحناوت' },
    { name: 'شيشاوة', portal: 'شيشاوة' }, { name: 'امنتانوت', portal: 'امنتانوت' },
    { name: 'قلعة السراغنة', portal: 'قلعة السراغنة' }, { name: 'ابن جرير', portal: 'ابن جرير' },
  ]},
  { appealPortal: 'ورزازات', primaries: [
    { name: 'ورزازات', portal: 'ورزازات' }, { name: 'زاكورة', portal: 'زاكورة' },
    { name: 'تنغير', portal: 'تنغير' },
  ]},
  { appealPortal: 'آسفي', primaries: [
    { name: 'آسفي', portal: 'آسفي' }, { name: 'اليوسفية', portal: 'اليوسفية' },
    { name: 'الصويرة', portal: 'الصويرة' },
  ]},
  { appealPortal: 'مكناس', primaries: [
    { name: 'مكناس', portal: 'مكناس' }, { name: 'أزرو', portal: 'أزرو' },
    { name: 'الحاجب', portal: 'الحاجب' }, { name: 'إفران', portal: 'إفران' },
  ]},
  { appealPortal: 'طنجة', primaries: [
    { name: 'طنجة', portal: 'طنجة' }, { name: 'أصيلة', portal: 'أصيلة' },
    { name: 'العرائش', portal: 'العرائش' }, { name: 'القصر الكبير', portal: 'القصر الكبير' },
  ]},
  { appealPortal: 'تطوان', primaries: [
    { name: 'تطوان', portal: 'تطوان' }, { name: 'شفشاون', portal: 'شفشاون' },
    { name: 'الحسيمة', portal: 'الحسيمة' },
  ]},
  { appealPortal: 'وجدة', primaries: [
    { name: 'وجدة', portal: 'وجدة' }, { name: 'الناظور', portal: 'الناظور' },
    { name: 'بركان', portal: 'بركان' }, { name: 'فجيج', portal: 'فجيج' },
    { name: 'تاوريرت', portal: 'تاوريرت' }, { name: 'الدريوش', portal: 'الدريوش' },
  ]},
  { appealPortal: 'بني ملال', primaries: [
    { name: 'بني ملال', portal: 'بني ملال' }, { name: 'الفقيه بن صالح', portal: 'الفقيه بن صالح' },
    { name: 'أزيلال', portal: 'أزيلال' }, { name: 'خريبكة', portal: 'خريبكة' },
    { name: 'واد زم', portal: 'واد زم' },
  ]},
  { appealPortal: 'سطات', primaries: [
    { name: 'سطات', portal: 'سطات' }, { name: 'برشيد', portal: 'برشيد' },
    { name: 'بن أحمد', portal: 'بن أحمد' },
  ]},
  { appealPortal: 'أكادير', primaries: [
    { name: 'أكادير', portal: 'أكادير' }, { name: 'إنزكان', portal: 'إنزكان' },
    { name: 'تارودانت', portal: 'تارودانت' }, { name: 'تيزنيت', portal: 'تيزنيت' },
  ]},
  { appealPortal: 'العيون', primaries: [
    { name: 'العيون', portal: 'العيون' }, { name: 'السمارة', portal: 'السمارة' },
    { name: 'بوجدور', portal: 'بوجدور' },
  ]},
  { appealPortal: 'الراشيدية', primaries: [
    { name: 'الراشيدية', portal: 'الراشيدية' }, { name: 'ميدلت', portal: 'ميدلت' },
    { name: 'كلميمة', portal: 'كلميمة' },
  ]},
  { appealPortal: 'خنيفرة', primaries: [
    { name: 'خنيفرة', portal: 'خنيفرة' }, { name: 'مريرت', portal: 'مريرت' },
  ]},
  { appealPortal: 'الحسيمة', primaries: [
    { name: 'الحسيمة', portal: 'الحسيمة' },
  ]},
  { appealPortal: 'كلميم', primaries: [
    { name: 'كلميم', portal: 'كلميم' }, { name: 'طانطان', portal: 'طانطان' },
    { name: 'أسا الزاك', portal: 'أسا الزاك' },
  ]},
  { appealPortal: 'الداخلة', primaries: [
    { name: 'الداخلة', portal: 'الداخلة' },
  ]},
];

const COMMERCIAL_COURTS: CourtMapping[] = [
  { appealPortal: 'الدار البيضاء', primaries: [
    { name: 'الدار البيضاء', portal: 'الدار البيضاء' },
  ]},
  { appealPortal: 'فاس', primaries: [
    { name: 'فاس', portal: 'فاس' },
  ]},
  { appealPortal: 'مراكش', primaries: [
    { name: 'مراكش', portal: 'مراكش' }, { name: 'أكادير', portal: 'أكادير' },
  ]},
  { appealPortal: 'طنجة', primaries: [
    { name: 'طنجة', portal: 'طنجة' },
  ]},
  { appealPortal: 'وجدة', primaries: [
    { name: 'وجدة', portal: 'وجدة' },
  ]},
];

const ADMIN_COURTS: CourtMapping[] = [
  { appealPortal: 'الرباط', primaries: [
    { name: 'الرباط', portal: 'الرباط' }, { name: 'الدار البيضاء', portal: 'الدار البيضاء' },
    { name: 'مكناس', portal: 'مكناس' },
  ]},
  { appealPortal: 'فاس', primaries: [
    { name: 'فاس', portal: 'فاس' }, { name: 'وجدة', portal: 'وجدة' },
  ]},
  { appealPortal: 'مراكش', primaries: [
    { name: 'مراكش', portal: 'مراكش' }, { name: 'أكادير', portal: 'أكادير' },
  ]},
  { appealPortal: 'طنجة', primaries: [
    { name: 'طنجة', portal: 'طنجة' },
  ]},
  { appealPortal: 'أكادير', primaries: [
    { name: 'أكادير', portal: 'أكادير' },
  ]},
];

type CourtCategory = 'civil' | 'commercial' | 'administrative';

function getCategoryFromCode(code: string): CourtCategory {
  if (!code || code.length < 2) return 'civil';
  const prefix = code.substring(0, 2);
  if (['81','82','83','84','85'].includes(prefix)) return 'commercial';
  if (['71','72','73','74','75','76'].includes(prefix)) return 'administrative';
  return 'civil';
}

function resolveCourtFromName(courtName: string | null, code: string): { appeal: string | null; primary: string | null } {
  if (!courtName) return { appeal: null, primary: null };
  
  const category = getCategoryFromCode(code);
  const hierarchy = category === 'commercial' ? COMMERCIAL_COURTS
    : category === 'administrative' ? ADMIN_COURTS
    : CIVIL_COURTS;
  
  const normalized = courtName.trim();
  
  for (const ac of hierarchy) {
    for (const pc of ac.primaries) {
      if (normalized.includes(pc.name) || pc.name.includes(normalized.replace(/المحكمة الابتدائية ب/g, '').replace(/محكمة الاستئناف /g, ''))) {
        return { appeal: ac.appealPortal, primary: pc.portal };
      }
    }
    // Check if the court name matches the appeal court itself
    if (normalized.includes(ac.appealPortal) || normalized.includes('الاستئناف')) {
      const cityMatch = normalized.match(/ب([^\s]+)/);
      if (cityMatch && ac.appealPortal.includes(cityMatch[1])) {
        return { appeal: ac.appealPortal, primary: null };
      }
      if (normalized.includes(ac.appealPortal)) {
        return { appeal: ac.appealPortal, primary: null };
      }
    }
  }
  
  return { appeal: null, primary: null };
}

/**
 * Auto-resolve court from DB case record
 */
async function resolveCourtForCase(
  supabase: ReturnType<typeof createClient>,
  caseId: string,
  code: string,
): Promise<{ appeal: string | null; primary: string | null }> {
  const { data } = await supabase
    .from('cases')
    .select('court')
    .eq('id', caseId)
    .limit(1)
    .single();
  
  if (!data?.court) return { appeal: null, primary: null };
  
  const resolved = resolveCourtFromName(data.court, code);
  log(`⚖ Court auto-resolved: "${data.court}" → appeal="${resolved.appeal}", primary="${resolved.primary}"`);
  return resolved;
}

/* ══════════════════════════════════════════════════════════════════
   Build ScrapingBee js_scenario for form filling
   
   TESTED format — uses only valid ScrapingBee instructions:
   - { wait: ms }
   - { click: "selector" }
   - { evaluate: "js expression" }
   ══════════════════════════════════════════════════════════════════ */
function buildJsScenario(numero: string, code: string, annee: string, appealCourt?: string, firstInstanceCourt?: string) {
  const esc = (value?: string) => (value ?? '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  const instructions: Array<Record<string, unknown>> = [{ wait: 3500 }];

  if (appealCourt) {
    instructions.push(
      // Use ScrapingBee native click (real browser click, not DOM event)
      { click: 'p-dropdown:first-of-type' },
      { wait: 2500 },
      // Now try to find and click the item in the overlay panel
      {
        evaluate: `(()=>{var t='${esc(appealCourt)}';var items=document.querySelectorAll('li.p-dropdown-item,.p-dropdown-item,p-dropdownitem li');var found=[];for(var i=0;i<items.length;i++){var txt=(items[i].textContent||'').trim();found.push(txt);if(txt===t||txt.includes(t)){items[i].click();return 'selected:'+txt}}var overlays=document.querySelectorAll('.p-overlay,.p-connected-overlay,.cdk-overlay-pane');return 'miss:items='+items.length+',overlays='+overlays.length+',found='+found.slice(0,10).join('|')})()`
      },
      { wait: 2500 },
    );
  }

  if (firstInstanceCourt) {
    instructions.push(
      // Click the second dropdown
      {
        evaluate: `(()=>{var dds=document.querySelectorAll('p-dropdown');if(dds.length>=2){dds[1].click();return 'fic-clicked:'+dds.length}return 'no-2nd:'+dds.length})()`
      },
      { wait: 2500 },
      {
        evaluate: `(()=>{var t='${esc(firstInstanceCourt)}';var items=document.querySelectorAll('li.p-dropdown-item,.p-dropdown-item');for(var i=0;i<items.length;i++){var txt=(items[i].textContent||'').trim();if(txt===t||txt.includes(t)){items[i].click();return 'fic-selected:'+txt}}return 'fic-miss:'+items.length})()`
      },
      { wait: 2500 },
    );
  }

  // Fill inputs — use "mark" not "code" (actual formcontrolname on mahakim.ma)
  instructions.push(
    {
      evaluate: `(()=>{const set=(s,v)=>{const e=document.querySelector(s);if(!e)return 'miss:'+s;const d=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value');d&&d.set?d.set.call(e,v):e.value=v;e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));return 'ok:'+s+'='+e.value};var r1=set('input[formcontrolname="numero"]','${esc(numero)}');var r2=set('input[formcontrolname="mark"]','${esc(code)}');var r3=set('input[formcontrolname="annee"]','${esc(annee)}');return JSON.stringify({r1:r1,r2:r2,r3:r3})})()`
    },
    { wait: 1000 },
    {
      evaluate: `(()=>{const b=[...document.querySelectorAll('button,p-button button')].find(x=>/بحث/.test((x.textContent||'').trim()));if(b){b.click();return 'submitted:'+b.textContent.trim()}return 'no-btn:'+[...document.querySelectorAll('button')].map(x=>x.textContent.trim()).join('|')})()`
    },
    { wait: 12000 },
    // Final diagnostic: inject debug data INTO the page HTML so we can read it
    {
      evaluate: `(()=>{var inputs=document.querySelectorAll('input[formcontrolname]');var vals={};inputs.forEach(function(i){vals[i.getAttribute('formcontrolname')]=i.value});var dropdowns=document.querySelectorAll('.p-dropdown-label');var ddVals=[];dropdowns.forEach(function(d){ddVals.push(d.textContent.trim())});var hasTable=!!document.querySelector('.p-datatable,.p-table,table.p-datatable-table');var noResultEl=document.querySelector('.p-datatable-emptymessage,.empty-message');var noResultVisible=noResultEl?noResultEl.offsetParent!==null:false;var allBtns=[...document.querySelectorAll('button')].map(function(b){return b.textContent.trim()}).filter(Boolean);var bodyText=document.body.innerText.substring(0,1000);var div=document.createElement('div');div.id='__debug__';div.style.display='none';div.setAttribute('data-debug',JSON.stringify({inputValues:vals,dropdownValues:ddVals,hasTable:hasTable,noResultVisible:noResultVisible,buttons:allBtns.slice(0,10),bodySnippet:bodyText.substring(0,400)}));document.body.appendChild(div);return 'injected'})()`
    },
  );

  return { instructions };
}

/* ══════════════════════════════════════════════════════════════════
   Core: Fetch single case via ScrapingBee
   ══════════════════════════════════════════════════════════════════ */
async function fetchSingleCase(apiKey: string, input: CaseInput, appealCourt?: string, firstInstanceCourt?: string): Promise<CaseResult> {
  const caseLabel = `${input.numero}/${input.code}/${input.annee}`;
  const start = Date.now();

  log(`🚀 Starting fetch for ${caseLabel} | appealCourt="${appealCourt}" | firstInstanceCourt="${firstInstanceCourt}"`);

  const scenario = buildJsScenario(input.numero, input.code, input.annee, appealCourt, firstInstanceCourt);
  log(`📋 Scenario steps: ${scenario.instructions.length} | Total JSON length: ${JSON.stringify(scenario).length}`);
  log(`📋 Scenario detail: ${JSON.stringify(scenario).substring(0, 600)}`);

  const params = new URLSearchParams({
    api_key: apiKey,
    url: 'https://www.mahakim.ma/#/suivi/dossier-suivi',
    render_js: 'true',
    premium_proxy: 'true',
    country_code: 'ma',
    js_scenario: JSON.stringify(scenario),
    timeout: '60000',
  });

  const fullUrl = `https://app.scrapingbee.com/api/v1/?${params.toString()}`;
  log(`🌐 Request URL length: ${fullUrl.length} chars`);

  try {
    const resp = await fetch(fullUrl, {
      signal: AbortSignal.timeout(65000),
    });

    const elapsed = Date.now() - start;
    log(`📡 ScrapingBee response: status=${resp.status} (${elapsed}ms)`);

    if (!resp.ok) {
      const errText = await resp.text();
      log(`✗ ${caseLabel}: ScrapingBee ${resp.status} (${elapsed}ms) — ${errText.substring(0, 200)}`);
      return {
        ...input,
        status: 'error',
        caseInfo: {},
        procedures: [],
        nextSessionDate: null,
        error: `خطأ في الاتصال: ${resp.status}`,
      };
    }

    const html = await resp.text();
    log(`✓ ${caseLabel}: got ${html.length} chars (${elapsed}ms)`);

    // ── DEBUG: Save first 5000 chars of HTML + key indicators ──
    const debugSnippet = html.substring(0, 5000);
    const hasDropdown = html.includes('p-dropdown');
    const hasNoResult = html.includes('لا توجد أية نتيجة');
    const hasTable = html.includes('<table') || html.includes('p-table');
    const hasFormControl = html.includes('formcontrolname');
    const hasCaseData = html.includes('القاضي') || html.includes('الشعبة') || html.includes('المحكمة');
    const hasSearchBtn = html.includes('بحث') || html.includes('عرض') || html.includes('تتبع');
    const hasResultSection = html.includes('app-dossier-detail') || html.includes('app-procedure') || html.includes('نتيجة');
    
    log(`🔍 DEBUG HTML indicators: dropdown=${hasDropdown}, noResult=${hasNoResult}, table=${hasTable}, formControl=${hasFormControl}, caseData=${hasCaseData}, searchBtn=${hasSearchBtn}, resultSection=${hasResultSection}`);
    
    // Extract injected debug data from the page
    const debugMatch = html.match(/data-debug="([^"]*)"/);
    if (debugMatch) {
      try {
        const debugData = JSON.parse(debugMatch[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&'));
        log(`🔍 DEBUG INJECTED: ${JSON.stringify(debugData)}`);
      } catch (e) {
        log(`🔍 DEBUG INJECTED raw: ${debugMatch[1].substring(0, 500)}`);
      }
    } else {
      log(`🔍 DEBUG: No injected debug div found — scenario may not have executed`);
    }
    
    // Log ScrapingBee headers for scenario execution info
    const scenarioResult = resp.headers.get('Spb-Js-Scenario-Result');
    const resolvedUrl = resp.headers.get('Spb-Resolved-Url');
    log(`🔍 DEBUG ScrapingBee headers: scenario-result=${scenarioResult?.substring(0, 500)}, resolved-url=${resolvedUrl}`);

    // Check for anti-bot
    const lower = html.toLowerCase();
    if ((lower.includes('captcha') || lower.includes('challenge-platform') || lower.includes('access denied')) && !lower.includes('p-dropdown')) {
      log(`✗ ${caseLabel}: anti-bot page detected`);
      return {
        ...input,
        status: 'error',
        caseInfo: {},
        procedures: [],
        nextSessionDate: null,
        error: 'تم حظر الطلب — يُرجى المحاولة لاحقاً',
      };
    }

    // Try to get the evaluate result from the last js_scenario step
    const jsResult = resp.headers.get('Spb-Js-Scenario-Result');
    
    // Parse extracted data from the evaluate step
    let parsed = { caseInfo: {} as Record<string, string>, procedures: [] as Array<Record<string, string>>, hasData: false, noResult: false };
    
    if (jsResult) {
      log(`🔍 DEBUG jsResult raw: ${jsResult.substring(0, 500)}`);
      try {
        parsed = JSON.parse(jsResult);
        log(`🔍 DEBUG jsResult parsed: hasData=${parsed.hasData}, caseInfo keys=${Object.keys(parsed.caseInfo).join(',')}, procedures=${parsed.procedures?.length}`);
      } catch { /* fallback to HTML parsing */ }
    }

    // Fallback: parse HTML directly if evaluate didn't return clean data
    if (!parsed.hasData && !parsed.noResult) {
      log(`🔍 DEBUG: falling back to HTML parsing`);
      parsed = parseHtmlFallback(html);
      log(`🔍 DEBUG HTML parse result: hasData=${parsed.hasData}, noResult=${parsed.noResult}, caseInfo=${JSON.stringify(parsed.caseInfo)}`);
    }

    if (parsed.noResult) {
      log(`○ ${caseLabel}: لا توجد نتيجة`);
      return {
        ...input,
        status: 'no_data',
        caseInfo: {},
        procedures: [],
        nextSessionDate: null,
        error: 'لم يتم العثور على بيانات — تأكد من صحة رقم الملف واختيار المحكمة',
      };
    }

    if (!parsed.hasData) {
      log(`○ ${caseLabel}: no data extracted from ${html.length} chars`);
      // Save debug HTML to storage for analysis
      try {
        const debugBlob = new Blob([html], { type: 'text/html' });
        // Store in a temporary debug field in the sync job
        log(`🔍 Full HTML body keywords: ${[...html.matchAll(/[\u0600-\u06FF]+/g)].slice(0, 50).map(m => m[0]).join(', ')}`);
      } catch {}
      return {
        ...input,
        status: 'no_data',
        caseInfo: {},
        procedures: [],
        nextSessionDate: null,
        error: 'لم يتم استخراج بيانات — قد يكون رقم الملف غير صحيح أو المحكمة غير مطابقة',
      };
    }

    // Find next future session date
    const now = new Date();
    let nextSessionDate: string | null = null;
    for (const proc of parsed.procedures) {
      const d = proc.next_session_date;
      if (d && /\d{2}\/\d{2}\/\d{4}/.test(d)) {
        const [day, month, year] = d.split('/');
        const dateObj = new Date(`${year}-${month}-${day}`);
        if (dateObj >= now && (!nextSessionDate || dateObj < new Date(nextSessionDate))) {
          nextSessionDate = `${year}-${month}-${day}`;
        }
      }
    }

    log(`✓ ${caseLabel}: ${Object.keys(parsed.caseInfo).length} fields, ${parsed.procedures.length} procedures`);

    return {
      ...input,
      status: 'success',
      caseInfo: parsed.caseInfo,
      procedures: parsed.procedures,
      nextSessionDate,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown';
    log(`✗ ${caseLabel}: ${msg} (${Date.now() - start}ms)`);
    return {
      ...input,
      status: 'error',
      caseInfo: {},
      procedures: [],
      nextSessionDate: null,
      error: msg.includes('timeout') ? 'انتهت مهلة الاتصال — البوابة بطيئة حالياً' : msg,
    };
  }
}

/* ── HTML fallback parser ── */
function parseHtmlFallback(html: string): {
  caseInfo: Record<string, string>;
  procedures: Array<Record<string, string>>;
  hasData: boolean;
  noResult: boolean;
} {
  if (html.includes('لا توجد أية نتيجة')) {
    return { caseInfo: {}, procedures: [], hasData: false, noResult: true };
  }

  const caseInfo: Record<string, string> = {};
  const procedures: Array<Record<string, string>> = [];

  // Simple text extraction using patterns
  const patterns: [string, string[]][] = [
    ['court', ['المحكمة']],
    ['judge', ['القاضي المقرر', 'القاضي']],
    ['department', ['الشعبة']],
    ['case_type', ['نوع القضية']],
    ['status', ['الحالة']],
  ];

  for (const [key, labels] of patterns) {
    for (const label of labels) {
      const idx = html.indexOf(label);
      if (idx === -1) continue;
      // Look for value after the label in nearby HTML
      const after = html.substring(idx, idx + 500);
      const valueMatch = after.match(/>([^<]{2,100})</);
      if (valueMatch && valueMatch[1].trim() !== label) {
        caseInfo[key] = valueMatch[1].trim();
        break;
      }
    }
  }

  return {
    caseInfo,
    procedures,
    hasData: Object.keys(caseInfo).length > 0,
    noResult: false,
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
      const { data: pendingJobs } = await supabase
        .from('mahakim_sync_jobs')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: true })
        .limit(3);

      if (!pendingJobs || pendingJobs.length === 0) {
        return new Response(JSON.stringify({ status: 'success', processed: 0 }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      let processed = 0;
      for (let i = 0; i < pendingJobs.length; i++) {
        const job = pendingJobs[i];
        if (i > 0) await randomDelay();

        await supabase.from('mahakim_sync_jobs').update({
          status: 'scraping', updated_at: new Date().toISOString(),
        }).eq('id', job.id);

        const parts = job.case_number.split('/');
        const input: CaseInput = { numero: parts[0] || '', code: parts[1] || '', annee: parts[2] || '' };

        try {
          const payload = job.request_payload as Record<string, unknown> || {};
          let appealCourt = payload.appealCourt as string | undefined;
          let firstInstanceCourt = payload.firstInstanceCourt as string | undefined;
          
          // Auto-resolve courts from case record if not provided
          if (!appealCourt) {
            const resolved = await resolveCourtForCase(supabase, job.case_id, input.code);
            appealCourt = resolved.appeal || undefined;
            firstInstanceCourt = firstInstanceCourt || resolved.primary || undefined;
          }
          
          const result = await fetchSingleCase(SCRAPINGBEE_API_KEY, input, appealCourt, firstInstanceCourt);
          await persistResults(supabase, job.case_id, job.user_id, result);

          await supabase.from('mahakim_sync_jobs').update({
            status: result.status === 'success' ? 'completed' : 'failed',
            result_data: result.caseInfo,
            error_message: result.error || null,
            next_session_date: result.nextSessionDate,
            completed_at: new Date().toISOString(),
          }).eq('id', job.id);
          processed++;
        } catch (err) {
          await supabase.from('mahakim_sync_jobs').update({
            status: 'failed',
            error_message: err instanceof Error ? err.message : 'Unknown',
            retry_count: (job.retry_count || 0) + 1,
            completed_at: new Date().toISOString(),
          }).eq('id', job.id);
        }
      }

      return new Response(JSON.stringify({ status: 'success', processed, logs }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── ACTION: submitSyncJob — triggered by DB trigger or orchestrator ──
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
        let appealCourt = body.appealCourt as string | undefined;
        let firstInstanceCourt = body.firstInstanceCourt as string | undefined;
        
        // Auto-resolve courts from case record if not provided
        if (!appealCourt) {
          const resolved = await resolveCourtForCase(supabase, jCaseId, input.code);
          appealCourt = resolved.appeal || undefined;
          firstInstanceCourt = firstInstanceCourt || resolved.primary || undefined;
        }
        
        const result = await fetchSingleCase(SCRAPINGBEE_API_KEY, input, appealCourt, firstInstanceCourt);
        const persistLog = await persistResults(supabase, jCaseId, body.userId, result);

        await supabase.from('mahakim_sync_jobs').update({
          status: result.status === 'success' ? 'completed' : 'failed',
          result_data: result.caseInfo,
          error_message: result.error || null,
          next_session_date: result.nextSessionDate,
          completed_at: new Date().toISOString(),
        }).eq('id', jobId);

        return new Response(JSON.stringify({
          success: result.status === 'success',
          status: result.status,
          mapping_log: persistLog,
          next_session_date: result.nextSessionDate,
          logs,
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : 'Unknown';
        await supabase.from('mahakim_sync_jobs').update({
          status: 'failed', error_message: errMsg,
          completed_at: new Date().toISOString(),
        }).eq('id', jobId);

        return new Response(JSON.stringify({ success: false, error: errMsg, logs }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // ── Default: Direct case fetch (POST /fetch-dossier with cases array) ──
    if (!cases || !Array.isArray(cases) || cases.length === 0) {
      return new Response(JSON.stringify({
        status: 'error',
        error: 'يجب توفير action أو مصفوفة cases [{numero, annee, code}]',
      }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    for (const c of cases) {
      if (!c.numero || !c.annee || !c.code) {
        return new Response(JSON.stringify({
          status: 'error',
          error: 'كل كائن يجب أن يحتوي على numero, annee, code',
        }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }

    // Process max 2 cases per request (each takes ~22s)
    const batch = cases.slice(0, 2);
    const results: CaseResult[] = [];

    for (let i = 0; i < batch.length; i++) {
      if (i > 0) await randomDelay();
      
      // Auto-resolve courts if caseId is provided
      let appealCourt = batch[i].courtType === 'appeal' ? undefined : undefined;
      let primaryCourt: string | undefined;
      if (caseId) {
        const resolved = await resolveCourtForCase(supabase, caseId, batch[i].code);
        appealCourt = resolved.appeal || undefined;
        primaryCourt = resolved.primary || undefined;
      }
      
      const result = await fetchSingleCase(SCRAPINGBEE_API_KEY, batch[i], appealCourt, primaryCourt);
      results.push(result);
      if (caseId || userId) {
        await persistResults(supabase, caseId, userId, result);
      }
    }

    return new Response(JSON.stringify({
      status: 'success',
      processed: results.length,
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
