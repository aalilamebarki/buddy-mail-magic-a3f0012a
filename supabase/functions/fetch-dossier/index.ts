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
  const instructions: Array<Record<string, unknown>> = [
    // Wait for Angular SPA to render
    { wait: 5000 },
  ];

  // ── Step 1: Select appeal court from first dropdown ──
  if (appealCourt) {
    instructions.push(
      // Open the appeal court dropdown (first p-dropdown on page)
      { click: 'p-dropdown:first-of-type .p-dropdown-trigger, .p-dropdown:first-of-type' },
      { wait: 1500 },
      // Search and select the matching court by text
      {
        evaluate: `(function(){
          var target = '${appealCourt}';
          var items = document.querySelectorAll('li.p-dropdown-item, .p-dropdown-item');
          for (var i = 0; i < items.length; i++) {
            var t = (items[i].textContent || '').trim();
            if (t.indexOf(target) > -1) { items[i].click(); return 'appeal:' + t.substring(0,60); }
          }
          // Fuzzy: try partial match
          for (var i = 0; i < items.length; i++) {
            var t = (items[i].textContent || '').trim();
            var parts = target.split(' ');
            var match = parts.every(function(p) { return t.indexOf(p) > -1; });
            if (match) { items[i].click(); return 'appeal-fuzzy:' + t.substring(0,60); }
          }
          return 'appeal-miss:' + items.length + ':' + target;
        })()`
      },
      { wait: 2000 },
    );
  } else {
    // Fallback: select first court
    instructions.push(
      { click: '.p-dropdown' },
      { wait: 1500 },
      {
        evaluate: `(function(){
          var items = document.querySelectorAll('li.p-dropdown-item, .p-dropdown-item');
          if (items.length > 1) { items[1].click(); return 'selected:' + items[1].textContent.trim().substring(0,50); }
          if (items.length === 1) { items[0].click(); return 'selected-only:' + items[0].textContent.trim().substring(0,50); }
          return 'no-items:' + items.length;
        })()`
      },
      { wait: 2000 },
    );
  }

  // ── Step 2: If first-instance court provided, select from second dropdown ──
  if (firstInstanceCourt) {
    instructions.push(
      // Wait for second dropdown to appear after appeal court selection
      { wait: 1500 },
      // Click the second p-dropdown (first-instance courts)
      {
        evaluate: `(function(){
          var dropdowns = document.querySelectorAll('p-dropdown .p-dropdown-trigger, .p-dropdown');
          if (dropdowns.length >= 2) { dropdowns[1].click(); return 'opened-fic-dropdown'; }
          // Try clicking any dropdown that's not already selected
          var all = document.querySelectorAll('p-dropdown');
          if (all.length >= 2) { all[1].querySelector('.p-dropdown-trigger')?.click(); return 'opened-fic-alt'; }
          return 'fic-dropdown-miss:' + dropdowns.length;
        })()`
      },
      { wait: 1500 },
      // Select the matching first-instance court
      {
        evaluate: `(function(){
          var target = '${firstInstanceCourt}';
          var items = document.querySelectorAll('li.p-dropdown-item, .p-dropdown-item');
          for (var i = 0; i < items.length; i++) {
            var t = (items[i].textContent || '').trim();
            if (t.indexOf(target) > -1) { items[i].click(); return 'fic:' + t.substring(0,60); }
          }
          return 'fic-miss:' + items.length + ':' + target;
        })()`
      },
      { wait: 2000 },
    );
  }

  // ── Step 3: Fill form fields ──
  instructions.push(
    {
      evaluate: `(function(){
        var r = [];
        function sv(sel, val, nm) {
          var el = document.querySelector(sel);
          if (!el) { r.push(nm + ':miss'); return; }
          var s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
          s.call(el, val);
          el.dispatchEvent(new Event('input', {bubbles: true}));
          el.dispatchEvent(new Event('change', {bubbles: true}));
          r.push(nm + ':ok');
        }
        sv('input[formcontrolname="numero"]', '${numero}', 'num');
        sv('input[formcontrolname="code"]', '${code}', 'code');
        sv('input[formcontrolname="annee"]', '${annee}', 'year');
        return r.join(',');
      })()`
    },
    { wait: 1000 },
    // Click search button
    {
      evaluate: `(function(){
        var btn = document.querySelector('button[type="submit"]');
        if (btn) { btn.click(); return 'submit'; }
        var btns = document.querySelectorAll('button.p-button, p-button button, button');
        for (var i = 0; i < btns.length; i++) {
          var t = (btns[i].textContent || '').trim();
          if (t.indexOf('بحث') > -1 || t.indexOf('عرض') > -1 || t.indexOf('تتبع') > -1) {
            btns[i].click();
            return 'clicked:' + t.substring(0, 30);
          }
        }
        return 'no-btn:' + document.querySelectorAll('button').length;
      })()`
    },
    // Wait for results
    { wait: 10000 },
    // Extract data
    {
      evaluate: `(function(){
        var result = { caseInfo: {}, procedures: [], hasData: false, noResult: false };
        var body = document.body.innerText || '';
        
        if (body.indexOf('لا توجد أية نتيجة') > -1 || body.indexOf('لا توجد أية نتيجة للبحث') > -1) {
          result.noResult = true;
          return JSON.stringify(result);
        }
        
        var fieldMap = {
          court: ['المحكمة'],
          national_number: ['الرقم الوطني'],
          case_type: ['نوع القضية', 'نوع الملف'],
          department: ['الشعبة'],
          judge: ['القاضي المقرر', 'القاضي'],
          subject: ['الموضوع'],
          status: ['الحالة'],
          registration_date: ['تاريخ التسجيل']
        };
        
        var allEls = document.querySelectorAll('span, div, td, th, label, p, strong, h3, h4');
        for (var i = 0; i < allEls.length; i++) {
          var text = (allEls[i].textContent || '').trim();
          for (var key in fieldMap) {
            if (result.caseInfo[key]) continue;
            var labels = fieldMap[key];
            for (var j = 0; j < labels.length; j++) {
              if (text.includes(labels[j])) {
                var next = allEls[i].nextElementSibling;
                if (next) {
                  var val = (next.textContent || '').trim();
                  if (val && val.length < 200 && val !== labels[j]) {
                    result.caseInfo[key] = val;
                    break;
                  }
                }
                var colonIdx = text.indexOf(':');
                if (colonIdx > -1) {
                  var val2 = text.substring(colonIdx + 1).trim();
                  if (val2 && val2.length < 200) {
                    result.caseInfo[key] = val2;
                    break;
                  }
                }
              }
            }
          }
        }
        
        var tables = document.querySelectorAll('table');
        for (var t = 0; t < tables.length; t++) {
          var rows = tables[t].querySelectorAll('tr');
          for (var r = 0; r < rows.length; r++) {
            var cells = rows[r].querySelectorAll('td');
            if (cells.length < 3) continue;
            var c0 = (cells[0].textContent || '').trim();
            if (c0 && /\\d/.test(c0)) {
              result.procedures.push({
                action_date: c0,
                action_type: (cells[1].textContent || '').trim(),
                decision: (cells[2].textContent || '').trim(),
                next_session_date: cells.length > 3 ? (cells[3].textContent || '').trim() : ''
              });
            }
          }
        }
        
        result.hasData = Object.keys(result.caseInfo).length > 0 || result.procedures.length > 0;
        return JSON.stringify(result);
      })()`
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

  const scenario = buildJsScenario(input.numero, input.code, input.annee, appealCourt, firstInstanceCourt);

  const params = new URLSearchParams({
    api_key: apiKey,
    url: 'https://www.mahakim.ma/#/suivi/dossier-suivi',
    render_js: 'true',
    premium_proxy: 'true',
    country_code: 'ma',
    js_scenario: JSON.stringify(scenario),
    timeout: '60000',
  });

  try {
    const resp = await fetch(`https://app.scrapingbee.com/api/v1/?${params.toString()}`, {
      signal: AbortSignal.timeout(65000),
    });

    const elapsed = Date.now() - start;

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
    
    // Look for the JSON result in the HTML (last evaluate dumps it)
    // ScrapingBee evaluate results may be in response headers or embedded
    if (jsResult) {
      try {
        parsed = JSON.parse(jsResult);
      } catch { /* fallback to HTML parsing */ }
    }

    // Fallback: parse HTML directly if evaluate didn't return clean data
    if (!parsed.hasData && !parsed.noResult) {
      parsed = parseHtmlFallback(html);
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
          const result = await fetchSingleCase(SCRAPINGBEE_API_KEY, input, payload.appealCourt as string | undefined, payload.firstInstanceCourt as string | undefined);
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
        const result = await fetchSingleCase(SCRAPINGBEE_API_KEY, input, body.appealCourt, body.firstInstanceCourt);
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
      const result = await fetchSingleCase(SCRAPINGBEE_API_KEY, batch[i]);
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
