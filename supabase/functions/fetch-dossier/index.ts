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
   Firecrawl Browser Sessions v2 — Full Playwright control
   
   Creates a browser session, runs Playwright code to fill the
   Angular form, extract data, and close the session.
   This is the PRIMARY path — handles Angular SPAs perfectly.
   ══════════════════════════════════════════════════════════════════ */

const FC_API = 'https://api.firecrawl.dev/v2';

async function fcRequest(apiKey: string, method: string, path: string, body?: unknown) {
  const resp = await fetch(`${FC_API}${path}`, {
    method,
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(90000),
  });
  const data = await resp.json();
  return { ok: resp.ok, status: resp.status, data };
}

function buildPlaywrightScript(
  numero: string, code: string, annee: string,
  appealCourt?: string, firstInstanceCourt?: string,
): string {
  const esc = (v?: string) => (v ?? '').replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '\\"');

  // Playwright Node.js script that runs in the Firecrawl sandbox
  // `page` is pre-loaded by Firecrawl
  return `
const L = [];
let result = { noResult: false, caseInfo: {}, procedures: [], hasData: false, bodyPreview: '' };

try {
  await page.goto('https://www.mahakim.ma/#/suivi/dossier-suivi', { waitUntil: 'domcontentloaded', timeout: 15000 });
  L.push('nav');

  await page.waitForSelector('input[formcontrolname="mark"]', { timeout: 12000 });
  L.push('form');

  async function setField(sel, val) {
    return await page.evaluate(({sel, val}) => {
      try {
        const el = document.querySelector(sel);
        if (!el) return 'miss';
        const d = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
        if (d && d.set) d.set.call(el, val); else el.value = val;
        el.dispatchEvent(new Event('input', {bubbles:true}));
        el.dispatchEvent(new Event('change', {bubbles:true}));
        el.dispatchEvent(new Event('blur', {bubbles:true}));
        return 'ok';
      } catch(e) { return 'err:'+e.message; }
    }, {sel, val});
  }

  await setField('input[formcontrolname="mark"]', '${esc(code)}');
  L.push('mark');
  await page.waitForTimeout(3500);

  await setField('input[formcontrolname="numero"]', '${esc(numero)}');
  await setField('input[formcontrolname="annee"]', '${esc(annee)}');
  L.push('fields');

${appealCourt ? `
  try {
    await page.waitForTimeout(500);
    const dd = await page.$$('p-dropdown .p-dropdown-trigger');
    if (dd.length > 0) {
      await dd[0].click();
      await page.waitForTimeout(800);
      const s = await page.evaluate((t) => {
        const items = document.querySelectorAll('.p-dropdown-panel li.p-dropdown-item, .p-dropdown-items li');
        for (const li of items) { if (li.textContent.trim().includes(t)) { li.click(); return li.textContent.trim(); } }
        return 'miss:'+items.length;
      }, '${esc(appealCourt)}');
      L.push('ac:'+s);
      await page.waitForTimeout(1000);
    } else { L.push('ac:no-dd'); }
  } catch(e) { L.push('ac-err:'+e.message); }
` : ''}

${firstInstanceCourt ? `
  try {
    const cb = await page.evaluate(() => {
      const labels = Array.from(document.querySelectorAll('label, span'));
      for (const l of labels) {
        if ((l.textContent||'').includes('الابتدائية') || (l.textContent||'').includes('البحث بالمحاكم')) {
          let c = l.querySelector('.p-checkbox-box, input[type="checkbox"]');
          if (!c) { const p = l.closest('div'); if(p) c = p.querySelector('.p-checkbox-box, input[type="checkbox"]'); }
          if (c) { c.click(); return 'ok'; }
          l.click(); return 'label';
        }
      }
      const cbs = document.querySelectorAll('.p-checkbox-box');
      if (cbs.length > 0) { cbs[0].click(); return 'fb'; }
      return 'miss';
    });
    L.push('cb:'+cb);
    await page.waitForTimeout(2500);

    const dd2 = await page.$$('p-dropdown .p-dropdown-trigger');
    if (dd2.length > 1) {
      await dd2[dd2.length-1].click();
      await page.waitForTimeout(800);
      const s2 = await page.evaluate((t) => {
        const items = document.querySelectorAll('.p-dropdown-panel li.p-dropdown-item, .p-dropdown-items li');
        for (const li of items) { if (li.textContent.trim().includes(t)) { li.click(); return li.textContent.trim(); } }
        return 'miss:'+items.length;
      }, '${esc(firstInstanceCourt)}');
      L.push('pc:'+s2);
      await page.waitForTimeout(1000);
    } else { L.push('pc:no-dd:'+dd2.length); }
  } catch(e) { L.push('pc-err:'+e.message); }
` : ''}

  const sr = await page.evaluate(() => {
    const bs = Array.from(document.querySelectorAll('button'));
    let b = bs.find(x => x.textContent.trim() === 'بحث');
    if (!b) b = bs.find(x => x.textContent.includes('بحث') && !x.textContent.includes('المحاكم'));
    if (b) { b.click(); return 'ok'; }
    return 'miss:'+bs.length;
  });
  L.push('search:'+sr);

  await page.waitForTimeout(6000);

  result = await page.evaluate(() => {
    try {
      const body = document.body.innerText;
      const html = document.body.innerHTML;
      if (body.includes('لا توجد أية نتيجة') || body.includes('لا توجد')) {
        return { noResult: true, caseInfo: {}, procedures: [], hasData: false, bodyPreview: body.substring(0,300) };
      }
      const ci = {};
      [['court',['المحكمة']],['judge',['القاضي المقرر','المستشار','القاضي']],['department',['الشعبة']],['case_type',['نوع الملف']],['status',['الحالة']],['registration_date',['تاريخ التسجيل']],['national_number',['الرقم الوطني']],['subject',['الموضوع']]].forEach(([k,ls])=>{
        for(const l of ls){const i=html.indexOf(l);if(i===-1)continue;const m=html.substring(i,i+500).match(/>([^<]{2,100})</);if(m&&m[1].trim()!==l&&m[1].trim().length>1){ci[k]=m[1].trim();break;}}
      });
      const procs=[];
      document.querySelectorAll('table tbody tr, .p-datatable-tbody tr').forEach(r=>{
        const c=r.querySelectorAll('td');
        if(c.length>=2){
          const proc={action_date:c[0]?.textContent?.trim()||'',action_type:c[1]?.textContent?.trim()||'',decision:c[2]?.textContent?.trim()||'',next_session_date:c[3]?.textContent?.trim()||'',session_time:'',court_room:''};
          // Extract time (HH:MM pattern) and room from additional columns
          for(let i=2;i<c.length;i++){
            const txt=(c[i]?.textContent||'').trim();
            if(/^\d{1,2}[h:]\d{2}$/i.test(txt)||/^\d{1,2}:\d{2}$/.test(txt)){proc.session_time=txt;}
            else if(txt&&(txt.includes('قاعة')||txt.includes('غرفة')||/^[\d\s]+$/.test(txt)&&txt.length<=5)){proc.court_room=txt;}
          }
          // Also try to find time in next_session_date field (sometimes "01/04/2026 09:00")
          if(!proc.session_time&&proc.next_session_date){
            const tm=proc.next_session_date.match(/(\d{1,2}:\d{2})/);
            if(tm){proc.session_time=tm[1];proc.next_session_date=proc.next_session_date.replace(/\s*\d{1,2}:\d{2}.*/,'').trim();}
          }
          if(!proc.session_time&&proc.action_date){
            const tm2=proc.action_date.match(/(\d{1,2}:\d{2})/);
            if(tm2){proc.session_time=tm2[1];}
          }
          procs.push(proc);
        }
      });
      return {noResult:false,caseInfo:ci,procedures:procs,hasData:Object.keys(ci).length>0||procs.length>0,bodyPreview:body.substring(0,300)};
    } catch(e) { return {noResult:false,caseInfo:{},procedures:[],hasData:false,bodyPreview:'err:'+e.message}; }
  });
  L.push('ex:'+Object.keys(result.caseInfo).length+'f,'+result.procedures.length+'p');
} catch(e) {
  L.push('FATAL:'+e.message);
}
// Return as the script's result value (Firecrawl captures this, not console.log)
const __output = JSON.stringify({log:L,result});
console.log(__output);
__output;
`;
}

/* Fetch case via Firecrawl Browser Sessions (PRIMARY PATH) */
async function fetchViaFirecrawl(
  apiKey: string,
  input: CaseInput,
  appealCourt?: string,
  firstInstanceCourt?: string,
): Promise<CaseResult | null> {
  const caseLabel = `${input.numero}/${input.code}/${input.annee}`;
  const start = Date.now();
  log(`🔥 [FC-Browser] Starting for ${caseLabel} | ac="${appealCourt}" pc="${firstInstanceCourt}"`);

  let sessionId: string | null = null;

  try {
    // 1. Create browser session
    const createResp = await fcRequest(apiKey, 'POST', '/browser', { ttl: 120, activityTtl: 90 });
    if (!createResp.ok || !createResp.data?.id) {
      log(`🔥 [FC-Browser] Failed to create session: ${createResp.status} — ${JSON.stringify(createResp.data).substring(0, 200)}`);
      return null;
    }
    sessionId = createResp.data.id;
    log(`🔥 [FC-Browser] Session created: ${sessionId} (${Date.now() - start}ms)`);

    // 2. Execute Playwright script
    const script = buildPlaywrightScript(input.numero, input.code, input.annee, appealCourt, firstInstanceCourt);
    const execResp = await fcRequest(apiKey, 'POST', `/browser/${sessionId}/execute`, {
      code: script,
      language: 'node',
      timeout: 90,
    });

    const elapsed = Date.now() - start;

    if (!execResp.ok) {
      log(`🔥 [FC-Browser] Execute failed: ${execResp.status} — ${JSON.stringify(execResp.data).substring(0, 300)}`);
      return null;
    }

    // Parse execution result — Firecrawl may return data in different fields
    const execData = execResp.data || {};
    const stdout = execData.stdout || '';
    const stderr = execData.stderr || '';
    const resultVal = execData.result;
    const output = execData.output || '';
    const returnValue = execData.returnValue || execData.return_value || '';
    const resultStr = typeof resultVal === 'string' ? resultVal : JSON.stringify(resultVal || '');
    
    // Log all available fields for debugging
    const allKeys = Object.keys(execData).join(',');
    log(`🔥 [FC-Browser] Execute done (${elapsed}ms) | keys=[${allKeys}] | stdout=${stdout.length} | stderr=${(stderr||'').substring(0, 200)} | result=${resultStr.substring(0, 300)} | output=${String(output).substring(0, 200)} | returnValue=${String(returnValue).substring(0, 200)} | exitCode=${execData.exitCode}`);

    let parsed: { log: string[]; result: { noResult: boolean; caseInfo: Record<string, string>; procedures: Array<Record<string, string>>; hasData: boolean; bodyPreview?: string } } | null = null;

    // Try all possible output sources
    const candidates = [stdout, resultStr, String(output), String(returnValue)];
    for (const candidate of candidates) {
      if (!candidate || candidate === 'null' || candidate === '""' || candidate.length < 5) continue;
      try {
        const jsonMatch = candidate.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const attempt = JSON.parse(jsonMatch[0]);
          if (attempt && (attempt.log || attempt.result)) { parsed = attempt; break; }
        }
      } catch {}
    }

    // If resultVal is already an object
    if (!parsed && resultVal && typeof resultVal === 'object') {
      if (resultVal.log || resultVal.result) parsed = resultVal as any;
    }

    if (!parsed) {
      log(`🔥 [FC-Browser] Could not parse output. Full response: ${JSON.stringify(execData).substring(0, 500)}`);
      return null;
    }

    log(`🔥 [FC-Browser] Script log: ${parsed.log?.join(' → ')}`);

    if (parsed.result.noResult) {
      log(`🔥 [FC-Browser] ${caseLabel}: portal returned no results`);
      return {
        ...input,
        status: 'no_data',
        caseInfo: {},
        procedures: [],
        nextSessionDate: null,
        error: 'لم يتم العثور على بيانات — تأكد من صحة رقم الملف واختيار المحكمة',
      };
    }

    if (!parsed.result.hasData) {
      log(`🔥 [FC-Browser] ${caseLabel}: no data extracted. Body: ${parsed.result.bodyPreview?.substring(0, 200)}`);
      return null; // Fall through to ScrapingBee
    }

    // Find next session date
    const now = new Date();
    let nextSessionDate: string | null = null;
    for (const proc of parsed.result.procedures) {
      const d = proc.next_session_date;
      if (d && /\d{2}\/\d{2}\/\d{4}/.test(d)) {
        const [day, month, year] = d.split('/');
        const dateObj = new Date(`${year}-${month}-${day}`);
        if (dateObj >= now && (!nextSessionDate || dateObj < new Date(nextSessionDate))) {
          nextSessionDate = `${year}-${month}-${day}`;
        }
      }
    }

    log(`🔥 [FC-Browser] ${caseLabel}: ✓ ${Object.keys(parsed.result.caseInfo).length} fields, ${parsed.result.procedures.length} procedures`);

    return {
      ...input,
      status: 'success',
      caseInfo: parsed.result.caseInfo,
      procedures: parsed.result.procedures,
      nextSessionDate,
    };

  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown';
    log(`🔥 [FC-Browser] ${caseLabel}: error — ${msg}`);
    return null;
  } finally {
    // 3. Always close the session
    if (sessionId) {
      try {
        await fcRequest(apiKey, 'DELETE', `/browser/${sessionId}`);
        log(`🔥 [FC-Browser] Session ${sessionId} closed`);
      } catch {}
    }
  }
}


/* ── Parse markdown results from Firecrawl ── */
function parseMarkdownResult(markdown: string): {
  caseInfo: Record<string, string>;
  procedures: Array<Record<string, string>>;
  hasData: boolean;
} {
  const caseInfo: Record<string, string> = {};
  const procedures: Array<Record<string, string>> = [];

  // Parse table-like patterns from markdown
  // Pattern: "| المحكمة | المحكمة الابتدائية بتمارة |"
  // Or: "المحكمة: المحكمة الابتدائية بتمارة"
  const fieldMap: [string, string[]][] = [
    ['court', ['المحكمة']],
    ['judge', ['القاضي المقرر', 'المستشار', 'القاضي']],
    ['department', ['الشعبة']],
    ['case_type', ['نوع الملف', 'نوع القضية']],
    ['status', ['الحالة']],
    ['registration_date', ['تاريخ التسجيل']],
    ['national_number', ['الرقم الوطني']],
    ['subject', ['الموضوع']],
    ['last_decision', ['آخر حكم', 'أخر حكم']],
  ];

  for (const [key, labels] of fieldMap) {
    for (const label of labels) {
      // Try table format: | label | value |
      const tableRegex = new RegExp(`\\|\\s*${label}\\s*\\|\\s*([^|]+)\\|`);
      const tableMatch = markdown.match(tableRegex);
      if (tableMatch) {
        const val = tableMatch[1].trim();
        if (val && val !== label && val.length > 1) {
          caseInfo[key] = val;
          break;
        }
      }
      // Try colon format: label: value or label : value
      const colonRegex = new RegExp(`${label}\\s*[:|]\\s*([^\\n|]{2,100})`);
      const colonMatch = markdown.match(colonRegex);
      if (colonMatch) {
        const val = colonMatch[1].trim();
        if (val && val !== label) {
          caseInfo[key] = val;
          break;
        }
      }
    }
  }

  // Parse procedures table
  // Look for rows with date patterns
  const procRegex = /\|\s*(\d{2}\/\d{2}\/\d{4}[\s\d:]*)\s*\|\s*([^|]+)\|\s*([^|]*)\|\s*(\d{2}\/\d{2}\/\d{4}[\s\d:]*)?/g;
  let procMatch;
  while ((procMatch = procRegex.exec(markdown)) !== null) {
    procedures.push({
      action_date: procMatch[1]?.trim().substring(0, 10) || '',
      action_type: procMatch[2]?.trim() || '',
      decision: procMatch[3]?.trim() || '',
      next_session_date: procMatch[4]?.trim().substring(0, 10) || '',
    });
  }

  return {
    caseInfo,
    procedures,
    hasData: Object.keys(caseInfo).length > 0,
  };
}

/* ══════════════════════════════════════════════════════════════════
   Build ScrapingBee js_scenario for form filling (FALLBACK PATH)
   ══════════════════════════════════════════════════════════════════ */
function buildJsScenario(numero: string, code: string, annee: string, appealCourt?: string, firstInstanceCourt?: string) {
  const esc = (value?: string) => (value ?? '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");

  // Flow for primary court search:
  // 1. Fill mark (code) → triggers appeal court dropdown load
  // 2. Wait & select appeal court from dropdown
  // 3. Fill numero + annee
  // 4. Click "البحث في المحاكم الابتدائية" button to load primary courts dropdown
  // 5. Wait & select primary court from the new dropdown
  // 6. Click main search button (the one that says just "بحث", not "المحاكم")
  const megaScript = `(()=>{
window.__L=[];
var set=function(q,v){var e=document.querySelector(q);if(!e){window.__L.push('miss:'+q);return 0}var d=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value');d&&d.set?d.set.call(e,v):e.value=v;e.dispatchEvent(new Event('input',{bubbles:1}));e.dispatchEvent(new Event('change',{bubbles:1}));return 1};
var ac='${esc(appealCourt||'')}';
var pc='${esc(firstInstanceCourt||'')}';
var num='${esc(numero)}';
var ann='${esc(annee)}';
var code='${esc(code)}';
function waitForForm(cb){
  var a=0;
  function poll(){
    var m=document.querySelector('input[formcontrolname="mark"]');
    if(m){window.__L.push('form-ready');cb();return}
    if(++a<30){setTimeout(poll,300);return}
    window.__L.push('form-timeout');
  }
  poll();
}
waitForForm(function(){
  set('input[formcontrolname="mark"]',code);
  window.__L.push('mark-set');
function selectDD(idx,target,cb){
  var a=0;
  function poll(){
    var dds=document.querySelectorAll('p-dropdown .p-dropdown-trigger');
    if(dds.length<=idx){if(++a<40){setTimeout(poll,400);return}window.__L.push('dd'+idx+'-timeout:found='+dds.length);cb();return}
    dds[idx].click();
    setTimeout(function(){
      var panel=document.querySelector('.p-dropdown-panel');
      var li=panel?panel.querySelectorAll('li.p-dropdown-item,.p-dropdown-items li'):document.querySelectorAll('li.p-dropdown-item');
      if(li.length<2&&a<40){a++;setTimeout(poll,400);return}
      var f=[];
      for(var i=0;i<li.length;i++){var x=li[i].textContent.trim();f.push(x);if(x.indexOf(target)>=0){li[i].click();window.__L.push('dd'+idx+'-ok:'+x);setTimeout(cb,600);return}}
      window.__L.push('dd'+idx+'-miss:'+li.length+':'+f.slice(0,5).join(','));
      cb();
    },600);
  }
  poll();
}
function clickPrimaryCheckbox(cb){
  var a=0;
  function poll(){
    var cbs=[].slice.call(document.querySelectorAll('p-checkbox,input[type="checkbox"],.p-checkbox'));
    var labels=[].slice.call(document.querySelectorAll('label,span'));
    var found=null;
    for(var i=0;i<labels.length;i++){
      var t=labels[i].textContent||'';
      if(t.indexOf('الابتدائية')>=0||t.indexOf('الإبتدائية')>=0||t.indexOf('البحث بالمحاكم')>=0){
        var cb2=labels[i].querySelector('input[type="checkbox"],.p-checkbox-box');
        if(!cb2){var p=labels[i].closest('.p-field-checkbox,div');if(p)cb2=p.querySelector('input[type="checkbox"],.p-checkbox-box')}
        if(!cb2){cb2=labels[i].previousElementSibling||labels[i].parentElement.querySelector('input[type="checkbox"],.p-checkbox-box,.p-checkbox')}
        if(cb2){found=cb2;break}
        found=labels[i];break;
      }
    }
    if(!found&&cbs.length>0){found=cbs[0]}
    if(found){found.click();window.__L.push('checkbox-clicked:'+found.tagName+':'+found.className);setTimeout(cb,2000);return}
    if(++a<15){setTimeout(poll,400);return}
    window.__L.push('checkbox-miss');cb();
  }
  poll();
}
function finalSearch(){
  window.__L.push('fields-done');
  setTimeout(function(){
    var btns=[].slice.call(document.querySelectorAll('button'));
    var b=btns.find(function(x){var t=x.textContent.trim();return t==='بحث'||t==='بحث '});
    if(!b){b=btns.find(function(x){return x.textContent.indexOf('بحث')>=0&&x.textContent.indexOf('المحاكم')<0})}
    if(b){b.click();window.__L.push('search-clicked')}else{window.__L.push('search-miss')}
  },500);
}
function fillFields(){
  set('input[formcontrolname="numero"]',num);
  set('input[formcontrolname="annee"]',ann);
}
function step2(){
  fillFields();
  if(pc){
    clickPrimaryCheckbox(function(){
      var dds=document.querySelectorAll('p-dropdown .p-dropdown-trigger');
      if(dds.length>1){selectDD(1,pc,finalSearch)}else{window.__L.push('no-dd1-direct-search');finalSearch()}
    });
  }else{
    finalSearch();
  }
}
  if(ac){selectDD(0,ac,step2)}else{fillFields();finalSearch()}
});
return 1;
})()`;

  const instructions: Array<Record<string, unknown>> = [
    { wait: 4000 },
    { evaluate: megaScript.replace(/\n/g, '') },
    { wait: 25000 }, // Wait for all async operations to complete
    {
      evaluate: `(()=>{var v={};document.querySelectorAll('input[formcontrolname]').forEach(function(i){v[i.getAttribute('formcontrolname')]=i.value});var dd=[];document.querySelectorAll('.p-dropdown-label').forEach(function(d){dd.push(d.textContent.trim())});var d=document.createElement('div');d.id='__debug__';d.style.display='none';d.setAttribute('data-debug',JSON.stringify({s:window.__L||[],i:v,d:dd,t:!!document.querySelector('table,.p-datatable'),n:document.body.innerText.includes('لا توجد'),b:document.body.innerText.substring(0,250)}));document.body.appendChild(d);return 1})()`
    },
  ];

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

  const scenarioJson = JSON.stringify(scenario);
  const params = new URLSearchParams({
    api_key: apiKey,
    url: 'https://www.mahakim.ma/#/suivi/dossier-suivi',
    render_js: 'true',
    premium_proxy: 'true',
    country_code: 'ma',
    timeout: '60000',
    js_scenario: scenarioJson,
  });

  const fullUrl = `https://app.scrapingbee.com/api/v1/?${params.toString()}`;
  log(`🌐 Request URL length: ${fullUrl.length} chars (js_scenario as URL param)`);

  try {
    const resp = await fetch(fullUrl, {
      signal: AbortSignal.timeout(70000),
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

  // Schedule ALL future court sessions from procedures
  if (userId && result.procedures.length > 0) {
    const now = new Date();
    const futureDates = new Set<string>();

    // Collect all future session dates from procedures
    for (const proc of result.procedures) {
      const d = proc.next_session_date;
      if (d && /\d{2}\/\d{2}\/\d{4}/.test(d)) {
        const [day, month, year] = d.split('/');
        const dateObj = new Date(`${year}-${month}-${day}`);
        if (dateObj >= now) {
          futureDates.add(`${year}-${month}-${day}`);
        }
      }
      // Also check action_date for future dates (some procedures list the session date here)
      const ad = proc.action_date;
      if (ad && /\d{2}\/\d{2}\/\d{4}/.test(ad)) {
        const [day, month, year] = ad.split('/');
        const dateObj = new Date(`${year}-${month}-${day}`);
        if (dateObj >= now) {
          futureDates.add(`${year}-${month}-${day}`);
        }
      }
    }

    // Also add the computed nextSessionDate if present
    if (result.nextSessionDate) {
      futureDates.add(result.nextSessionDate.substring(0, 10));
    }

    if (futureDates.size > 0) {
      // Fetch existing sessions for this case to avoid duplicates
      const { data: existingSessions } = await supabase
        .from('court_sessions')
        .select('session_date')
        .eq('case_id', caseId);

      const existingDates = new Set(
        (existingSessions || []).map((s: any) => s.session_date)
      );

      const newSessions = [...futureDates]
        .filter(d => !existingDates.has(d))
        .map(d => ({
          case_id: caseId,
          session_date: d,
          user_id: userId,
          required_action: '',
          notes: 'تم الجلب تلقائياً من بوابة محاكم',
          status: 'scheduled',
        }));

      if (newSessions.length > 0) {
        await supabase.from('court_sessions').insert(newSessions);
        persistLog.push(`تم إنشاء ${newSessions.length} جلسة مقبلة: ${newSessions.map(s => s.session_date).join(', ')}`);
      }
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
    const FIRECRAWL_API_KEY = Deno.env.get('FIRECRAWL_API_KEY');
    if (!SCRAPINGBEE_API_KEY && !FIRECRAWL_API_KEY) {
      return new Response(JSON.stringify({
        status: 'error',
        error: 'لم يتم تعيين أي مفتاح للجلب (Firecrawl أو ScrapingBee)',
      }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    /** Unified fetch: Firecrawl first, ScrapingBee fallback */
    async function fetchCase(input: CaseInput, ac?: string, pc?: string): Promise<CaseResult> {
      // 1. Try Firecrawl (primary — no monthly limits)
      if (FIRECRAWL_API_KEY) {
        log('🔀 Trying Firecrawl (primary path)...');
        const fcResult = await fetchViaFirecrawl(FIRECRAWL_API_KEY, input, ac, pc);
        if (fcResult) return fcResult;
        log('🔀 Firecrawl returned null — falling back to ScrapingBee');
      }
      // 2. Fallback to ScrapingBee
      if (SCRAPINGBEE_API_KEY) {
        log('🔀 Using ScrapingBee (fallback path)...');
        return await fetchSingleCase(SCRAPINGBEE_API_KEY, input, ac, pc);
      }
      return { ...input, status: 'error', caseInfo: {}, procedures: [], nextSessionDate: null, error: 'لا يوجد مفتاح متاح للجلب' };
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
          
          const result = await fetchCase(input, appealCourt, firstInstanceCourt);
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
        
        const result = await fetchCase(input, appealCourt, firstInstanceCourt);
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
      
      const result = await fetchCase(batch[i], appealCourt, primaryCourt);
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
