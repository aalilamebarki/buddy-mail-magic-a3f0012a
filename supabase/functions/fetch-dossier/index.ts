import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

/* ══════════════════════════════════════════════════════════════════════
   fetch-dossier v6 — نظام جلب بيانات الملفات من بوابة محاكم
   Smart Dual-Provider Court Data Bridge

   ─── الهيكل / Structure ───────────────────────────────────────────
   1. الأنواع والثوابت (Types & Constants)
   2. خريطة المحاكم (Court Hierarchy Mapping)
   3. Firecrawl Browser Sessions — المسار الأساسي (Primary)
   4. ScrapingBee — المسار البديل (Fallback)
   5. تحليل HTML/Markdown (Parsing Helpers)
   6. حفظ النتائج (Persist Results to DB)
   7. المعالج الرئيسي (HTTP Handler)

   ─── المنطق الذكي / Smart Logic ──────────────────────────────────
   • الوضع التلقائي: Firecrawl أولاً (أسرع/أرخص) ← ScrapingBee (أكثر استقراراً)
   • المستخدم يختار المزود مباشرة أو يترك النظام يختار
   • عند الفشل المتكرر: إشعار تلقائي عبر جدول notifications
   • رسائل خطأ واضحة مع اقتراحات (402=رصيد، 429=حد الطلبات، إلخ)
   ══════════════════════════════════════════════════════════════════════ */

type ScrapeProvider = 'firecrawl' | 'scrapingbee' | 'apify' | 'auto';

/* ── Apify configuration ── */
const APIFY_API_BASE = 'https://api.apify.com/v2';

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

function normalizeCourtName(courtName: string | null): string {
  return (courtName || '')
    .trim()
    .replace(/^المحكمة\s+/g, '')
    .replace(/^محكمة\s+/g, '')
    .replace(/^الابتدائية\s+/g, '')
    .replace(/^الابتدائية\s+ب/g, '')
    .replace(/^الابتدائية\s+بال/g, '')
    .replace(/^الاستئناف\s+/g, '')
    .replace(/^الاستئناف\s+ب/g, '')
    .replace(/^الاستئناف\s+بال/g, '')
    .replace(/^قسم\s+قضاء\s+الأسرة\s+ب/g, 'قسم قضاء الأسرة ')
    .replace(/^قسم\s+قضاء\s+الأسرة\s+بال/g, 'قسم قضاء الأسرة ')
    .replace(/^ب/g, '')
    .replace(/^بال/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function resolveCourtFromName(courtName: string | null, code: string): { appeal: string | null; primary: string | null } {
  if (!courtName) return { appeal: null, primary: null };

  const category = getCategoryFromCode(code);
  const hierarchy = category === 'commercial' ? COMMERCIAL_COURTS
    : category === 'administrative' ? ADMIN_COURTS
    : CIVIL_COURTS;

  const normalized = normalizeCourtName(courtName);

  for (const ac of hierarchy) {
    const normalizedAppeal = normalizeCourtName(ac.appealPortal);
    for (const pc of ac.primaries) {
      const normalizedPrimary = normalizeCourtName(pc.name);
      const normalizedPortalPrimary = normalizeCourtName(pc.portal);
      if (
        normalized === normalizedPrimary
        || normalized === normalizedPortalPrimary
        || normalized.includes(normalizedPrimary)
        || normalizedPrimary.includes(normalized)
      ) {
        return { appeal: ac.appealPortal, primary: pc.portal };
      }
    }

    if (
      normalized.includes('استئناف')
      || normalized === normalizedAppeal
      || normalized.includes(normalizedAppeal)
    ) {
      return { appeal: ac.appealPortal, primary: null };
    }
  }

  return { appeal: null, primary: null };
}

function doesResultMatchExpectedCourt(
  expectedCourt: string | null | undefined,
  actualCourt: string | null | undefined,
  fallbackTexts: Array<string | null | undefined> = [],
): boolean {
  if (!expectedCourt) return true;
  const expected = normalizeCourtName(expectedCourt);
  if (!expected) return true;

  const candidates = [actualCourt, ...fallbackTexts]
    .filter((value): value is string => Boolean(value && value.trim()))
    .map((value) => normalizeCourtName(value));

  if (candidates.length === 0) return true;

  return candidates.some((candidate) =>
    candidate === expected
    || candidate.includes(expected)
    || expected.includes(candidate)
  );
}

/**
 * Auto-resolve court from DB case record
 */
async function resolveCourtForCase(
  supabase: ReturnType<typeof createClient>,
  caseId: string,
  code: string,
): Promise<{ appeal: string | null; primary: string | null; expectedCourt: string | null; courtLevel: string | null }> {
  const { data } = await supabase
    .from('cases')
    .select('court, court_level')
    .eq('id', caseId)
    .limit(1)
    .single();

  if (!data?.court) return { appeal: null, primary: null, expectedCourt: null, courtLevel: data?.court_level || null };

  const resolved = resolveCourtFromName(data.court, code);

  if (data.court_level === 'استئناف') {
    log(`⚖ Appeal court retained as search target: "${data.court}" → appeal="${resolved.appeal}", expected="${data.court}"`);
    return {
      appeal: resolved.appeal,
      primary: null,
      expectedCourt: data.court,
      courtLevel: data.court_level,
    };
  }

  log(`⚖ Primary court retained as search target: "${data.court}" → appeal="${resolved.appeal}", primary="${resolved.primary}"`);
  return {
    appeal: resolved.appeal,
    primary: resolved.primary,
    expectedCourt: data.court,
    courtLevel: data.court_level,
  };
}

/* ══════════════════════════════════════════════════════════════════
   Firecrawl Scrape API with Actions — بروكسي مغربي
   
   يستخدم Scrape API v1 مع:
   - location: { country: 'MA' } لتوجيه الطلب عبر بروكسي مغربي
   - actions: تفاعل مع نموذج Angular (ملء الحقول، الضغط على بحث)
   - executeJavascript: لاستخراج البيانات بعد ظهور النتائج
   ══════════════════════════════════════════════════════════════════ */

const FC_API_V1 = 'https://api.firecrawl.dev/v1';

async function fcRequest(apiKey: string, method: string, path: string, body?: unknown, apiBase?: string) {
  const base = apiBase || FC_API_V1;
  const resp = await fetch(`${base}${path}`, {
    method,
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(120000),
  });
  const data = await resp.json();
  return { ok: resp.ok, status: resp.status, data };
}

/**
 * بناء سكريبت JS لملء نموذج بوابة محاكم
 * يعمل في بيئة executeJavascript داخل Firecrawl Scrape API
 */
function buildFormFillerScript(
  numero: string, code: string, annee: string,
  appealCourt?: string, firstInstanceCourt?: string,
): string {
  const esc = (v?: string) => (v ?? '').replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '\\"');
  
  return `(function(){
window.__mahakimLog=[];
var L=window.__mahakimLog;

function setField(sel,val){
  var el=document.querySelector(sel);
  if(!el){L.push('miss:'+sel);return false}
  var d=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value');
  if(d&&d.set)d.set.call(el,val);else el.value=val;
  el.dispatchEvent(new Event('input',{bubbles:true}));
  el.dispatchEvent(new Event('change',{bubbles:true}));
  el.dispatchEvent(new Event('blur',{bubbles:true}));
  L.push('set:'+sel);
  return true;
}

var form=document.querySelector('input[formcontrolname="mark"]');
if(!form){L.push('no-form');return JSON.stringify({log:L,ready:false})}
L.push('form-found');

setField('input[formcontrolname="mark"]','${esc(code)}');
setField('input[formcontrolname="numero"]','${esc(numero)}');
setField('input[formcontrolname="annee"]','${esc(annee)}');

${appealCourt ? `
try{
  var dds=document.querySelectorAll('p-dropdown .p-dropdown-trigger');
  if(dds.length>0){
    dds[0].click();
    L.push('ac-dd-clicked');
  }
}catch(e){L.push('ac-err:'+e.message)}
` : ''}

return JSON.stringify({log:L,ready:true});
})()`;
}

/**
 * سكريبت اختيار محكمة الاستئناف من القائمة المنسدلة
 */
function buildSelectAppealScript(appealCourt: string): string {
  const esc = (v?: string) => (v ?? '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  return `(function(){
var L=window.__mahakimLog||[];
try{
  var items=document.querySelectorAll('.p-dropdown-panel li.p-dropdown-item,.p-dropdown-items li');
  for(var i=0;i<items.length;i++){
    if(items[i].textContent.trim().indexOf('${esc(appealCourt)}')>=0){
      items[i].click();
      L.push('ac-selected:'+items[i].textContent.trim());
      return JSON.stringify({log:L,selected:true});
    }
  }
  L.push('ac-miss:'+items.length);
}catch(e){L.push('ac-sel-err:'+e.message)}
return JSON.stringify({log:L,selected:false});
})()`;
}

/**
 * سكريبت تفعيل البحث في المحكمة الابتدائية
 */
function buildPrimaryCourtScript(firstInstanceCourt: string): string {
  const esc = (v?: string) => (v ?? '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  return `(function(){
var L=window.__mahakimLog||[];
try{
  var labels=document.querySelectorAll('label,span');
  for(var i=0;i<labels.length;i++){
    var t=labels[i].textContent||'';
    if(t.indexOf('الابتدائية')>=0||t.indexOf('البحث بالمحاكم')>=0){
      var cb=labels[i].querySelector('.p-checkbox-box,input[type="checkbox"]');
      if(!cb){var p=labels[i].closest('div');if(p)cb=p.querySelector('.p-checkbox-box,input[type="checkbox"]')}
      if(cb){cb.click();L.push('cb-clicked');break}
      labels[i].click();L.push('label-clicked');break;
    }
  }
}catch(e){L.push('cb-err:'+e.message)}
return JSON.stringify({log:L});
})()`;
}

function buildSelectPrimaryScript(court: string): string {
  const esc = (v?: string) => (v ?? '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  return `(function(){
var L=window.__mahakimLog||[];
try{
  var dds=document.querySelectorAll('p-dropdown .p-dropdown-trigger');
  if(dds.length>1){dds[dds.length-1].click();L.push('pc-dd-clicked')}
  else L.push('pc-no-dd:'+dds.length);
}catch(e){L.push('pc-err:'+e.message)}
return JSON.stringify({log:L});
})()`;
}

function buildSelectPrimaryItemScript(court: string): string {
  const esc = (v?: string) => (v ?? '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  return `(function(){
var L=window.__mahakimLog||[];
try{
  var items=document.querySelectorAll('.p-dropdown-panel li.p-dropdown-item,.p-dropdown-items li');
  for(var i=0;i<items.length;i++){
    if(items[i].textContent.trim().indexOf('${esc(court)}')>=0){
      items[i].click();L.push('pc-selected:'+items[i].textContent.trim());
      return JSON.stringify({log:L,selected:true});
    }
  }
  L.push('pc-miss:'+items.length);
}catch(e){L.push('pc-sel-err:'+e.message)}
return JSON.stringify({log:L,selected:false});
})()`;
}

/**
 * سكريبت الضغط على زر البحث
 */
function buildSearchClickScript(): string {
  return `(function(){
var L=window.__mahakimLog||[];
var bs=document.querySelectorAll('button');
for(var i=0;i<bs.length;i++){
  var t=bs[i].textContent.trim();
  if(t==='بحث'||(t.indexOf('بحث')>=0&&t.indexOf('المحاكم')<0)){
    bs[i].click();L.push('search-clicked');
    return JSON.stringify({log:L,clicked:true});
  }
}
L.push('search-miss:'+bs.length);
return JSON.stringify({log:L,clicked:false});
})()`;
}

/**
 * سكريبت استخراج النتائج بعد البحث
 */
function buildExtractResultsScript(): string {
  return `(function(){
var L=window.__mahakimLog||[];
try{
  var body=document.body.innerText;
  var html=document.body.innerHTML;
  
  if(body.indexOf('لا توجد أية نتيجة')>=0||body.indexOf('لا توجد')>=0){
    return JSON.stringify({log:L,noResult:true,caseInfo:{},procedures:[],hasData:false});
  }
  
  var ci={};
  var fields=[['court','المحكمة'],['judge','القاضي المقرر'],['judge','القاضي'],['department','الشعبة'],['case_type','نوع الملف'],['status','الحالة'],['registration_date','تاريخ التسجيل'],['national_number','الرقم الوطني'],['subject','الموضوع']];
  for(var f=0;f<fields.length;f++){
    var k=fields[f][0],label=fields[f][1];
    if(ci[k])continue;
    var idx=html.indexOf(label);
    if(idx===-1)continue;
    var after=html.substring(idx,idx+500);
    var m=after.match(/>([^<]{2,100})</);
    if(m&&m[1].trim()!==label&&m[1].trim().length>1)ci[k]=m[1].trim();
  }
  
  var procs=[];
  var rows=document.querySelectorAll('table tbody tr,.p-datatable-tbody tr');
  rows.forEach(function(r){
    var c=r.querySelectorAll('td');
    if(c.length>=2){
      var rawAd=(c[0]&&c[0].textContent)?c[0].textContent.trim():'';
      var rawNsd=(c[3]&&c[3].textContent)?c[3].textContent.trim():'';
      var dateRe=/(\\d{2}\\/\\d{2}\\/\\d{4})/;
      var timeRe=/(?:\\u0627\\u0644\\u0633\\u0627\\u0639\\u0629\\s*)?(\\d{1,2}:\\d{2})/;
      var adM=rawAd.match(dateRe);
      var nsdM=rawNsd.match(dateRe);
      var nsdT=rawNsd.match(timeRe);
      procs.push({
        action_date:adM?adM[1]:rawAd,
        action_type:(c[1]&&c[1].textContent)?c[1].textContent.trim():'',
        decision:(c[2]&&c[2].textContent)?c[2].textContent.trim():'',
        next_session_date:nsdM?nsdM[1]:'',
        session_time:nsdT?nsdT[1]:'',
        court_room:''
      });
    }
  });
  
  L.push('extracted:'+Object.keys(ci).length+'f,'+procs.length+'p');
  return JSON.stringify({log:L,noResult:false,caseInfo:ci,procedures:procs,hasData:Object.keys(ci).length>0||procs.length>0,bodyPreview:body.substring(0,300)});
}catch(e){
  L.push('extract-err:'+e.message);
  return JSON.stringify({log:L,noResult:false,caseInfo:{},procedures:[],hasData:false,error:e.message});
}
})()`;
}


/* ══════════════════════════════════════════════════════════════════
   Fetch case via Firecrawl Scrape API with Actions (PRIMARY PATH)
   
   يستخدم بروكسي مغربي مع تفاعل مباشر مع النموذج
   ══════════════════════════════════════════════════════════════════ */
async function fetchViaFirecrawl(
  apiKey: string,
  input: CaseInput,
  appealCourt?: string,
  firstInstanceCourt?: string,
): Promise<CaseResult | null> {
  const caseLabel = `${input.numero}/${input.code}/${input.annee}`;
  const start = Date.now();
  log(`🔥 [FC-Scrape] Starting for ${caseLabel} | ac="${appealCourt}" pc="${firstInstanceCourt}"`);

  // بناء سلسلة الأوامر (actions) للتفاعل مع النموذج
  const actions: Array<Record<string, unknown>> = [
    // 1. انتظار تحميل الصفحة
    { type: 'wait', milliseconds: 5000 },
    // 2. ملء حقول النموذج
    { type: 'executeJavascript', script: buildFormFillerScript(input.numero, input.code, input.annee, appealCourt, firstInstanceCourt) },
    { type: 'wait', milliseconds: 1500 },
  ];

  // 3. اختيار محكمة الاستئناف إن وُجدت
  if (appealCourt) {
    actions.push({ type: 'wait', milliseconds: 1000 });
    actions.push({ type: 'executeJavascript', script: buildSelectAppealScript(appealCourt) });
    actions.push({ type: 'wait', milliseconds: 1500 });
  }

  // 4. تفعيل واختيار المحكمة الابتدائية إن وُجدت
  if (firstInstanceCourt) {
    actions.push({ type: 'executeJavascript', script: buildPrimaryCourtScript(firstInstanceCourt) });
    actions.push({ type: 'wait', milliseconds: 2500 });
    actions.push({ type: 'executeJavascript', script: buildSelectPrimaryScript(firstInstanceCourt) });
    actions.push({ type: 'wait', milliseconds: 1000 });
    actions.push({ type: 'executeJavascript', script: buildSelectPrimaryItemScript(firstInstanceCourt) });
    actions.push({ type: 'wait', milliseconds: 1500 });
  }

  // 5. الضغط على زر البحث
  actions.push({ type: 'executeJavascript', script: buildSearchClickScript() });
  // 6. انتظار ظهور النتائج
  actions.push({ type: 'wait', milliseconds: 8000 });
  // 7. استخراج البيانات
  actions.push({ type: 'executeJavascript', script: buildExtractResultsScript() });
  // 8. لقطة شاشة للتشخيص (اختياري)
  actions.push({ type: 'screenshot', fullPage: false });

  // تكوينات مختلفة للمحاولة
  const configs = [
    { name: 'ma-proxy', location: { country: 'MA', languages: ['ar'] } },
    { name: 'default', location: undefined },
  ];

  for (const config of configs) {
    try {
      log(`🔥 [FC-Scrape:${config.name}] Attempting scrape with actions...`);

      const scrapeBody: Record<string, unknown> = {
        url: 'https://www.mahakim.ma/#/suivi/dossier-suivi',
        formats: ['html'],
        actions,
        waitFor: 5000,
        timeout: 90000,
      };
      if (config.location) {
        scrapeBody.location = config.location;
      }

      const resp = await fcRequest(apiKey, 'POST', '/scrape', scrapeBody);
      const elapsed = Date.now() - start;

      if (!resp.ok) {
        const errDetail = JSON.stringify(resp.data).substring(0, 300);
        log(`🔥 [FC-Scrape:${config.name}] Failed: ${resp.status} — ${errDetail}`);
        
        if (resp.status === 402) {
          return { ...input, status: 'error' as const, caseInfo: {}, procedures: [], nextSessionDate: null, error: 'رصيد Firecrawl غير كافٍ — يُرجى ترقية الخطة أو استخدام كوبون LOVABLE50' };
        }
        if (resp.status === 401 || resp.status === 403) {
          return { ...input, status: 'error' as const, caseInfo: {}, procedures: [], nextSessionDate: null, error: 'مفتاح Firecrawl غير صالح — تحقق من إعدادات الربط' };
        }
        if (resp.status === 429) {
          return { ...input, status: 'error' as const, caseInfo: {}, procedures: [], nextSessionDate: null, error: 'تم تجاوز حد طلبات Firecrawl — أعد المحاولة بعد قليل' };
        }
        continue;
      }

      log(`🔥 [FC-Scrape:${config.name}] Response OK (${elapsed}ms)`);

      // استخراج نتائج الـ actions
      const scrapeData = resp.data?.data || resp.data;
      const actionsResults = scrapeData?.actions?.results || scrapeData?.actions || [];
      const html = scrapeData?.html || '';
      const screenshot = scrapeData?.actions?.screenshots?.[0] || scrapeData?.screenshot || '';
      
      log(`🔥 [FC-Scrape:${config.name}] HTML length: ${html.length} | Actions results: ${actionsResults.length} | Screenshot: ${screenshot ? 'yes' : 'no'}`);

      // البحث عن نتيجة استخراج البيانات من آخر executeJavascript
      let extractedData: any = null;
      
      // Try to find the extraction result from actions
      for (let i = actionsResults.length - 1; i >= 0; i--) {
        const r = actionsResults[i];
        const resultStr = typeof r === 'string' ? r : (r?.result || r?.output || JSON.stringify(r));
        if (!resultStr || resultStr.length < 10) continue;
        try {
          const jsonMatch = String(resultStr).match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            if (parsed.caseInfo || parsed.procedures || parsed.hasData !== undefined) {
              extractedData = parsed;
              log(`🔥 [FC-Scrape:${config.name}] Found extracted data from action #${i}`);
              break;
            }
          }
        } catch {}
      }

      // إن لم نجد من الـ actions، نحلل الـ HTML مباشرة
      if (!extractedData && html.length > 500) {
        log(`🔥 [FC-Scrape:${config.name}] Parsing HTML fallback (${html.length} chars)...`);
        const parsed = parseHtmlFallback(html);
        if (parsed.hasData || parsed.noResult) {
          extractedData = parsed;
        }
      }

      if (!extractedData) {
        log(`🔥 [FC-Scrape:${config.name}] No data extracted. Trying next config...`);
        continue;
      }

      // تحقق من عدم وجود نتائج
      if (extractedData.noResult) {
        log(`🔥 [FC-Scrape:${config.name}] Portal returned: لا توجد نتيجة`);
        return {
          ...input, status: 'no_data', caseInfo: {}, procedures: [], nextSessionDate: null,
          error: 'لم يتم العثور على بيانات — تأكد من صحة رقم الملف واختيار المحكمة',
        };
      }

      if (!extractedData.hasData && !extractedData.caseInfo) {
        log(`🔥 [FC-Scrape:${config.name}] No useful data. Body preview: ${extractedData.bodyPreview?.substring(0, 200)}`);
        continue;
      }

      // استخراج تاريخ الجلسة القادمة
      const now = new Date();
      let nextSessionDate: string | null = null;
      for (const proc of (extractedData.procedures || [])) {
        const d = proc.next_session_date;
        if (d) {
          const dm = d.match(/(\d{2})\/(\d{2})\/(\d{4})/);
          if (dm) {
            const [, day, month, year] = dm;
            const dateObj = new Date(`${year}-${month}-${day}`);
            if (dateObj >= now && (!nextSessionDate || dateObj < new Date(nextSessionDate))) {
              nextSessionDate = `${year}-${month}-${day}`;
            }
          }
        }
      }

      const fieldCount = Object.keys(extractedData.caseInfo || {}).length;
      const procCount = (extractedData.procedures || []).length;
      log(`🔥 [FC-Scrape:${config.name}] ✓ Success: ${fieldCount} fields, ${procCount} procedures (${elapsed}ms)`);

      return {
        ...input,
        status: 'success',
        caseInfo: extractedData.caseInfo || {},
        procedures: extractedData.procedures || [],
        nextSessionDate,
      };

    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown';
      log(`🔥 [FC-Scrape:${config.name}] Error: ${msg}`);
      if (msg.includes('timeout') || msg.includes('AbortError')) continue;
    }
  }

  return {
    ...input,
    status: 'error' as const,
    caseInfo: {},
    procedures: [],
    nextSessionDate: null,
    error: 'تعذر على Firecrawl الوصول لبوابة محاكم — قد تكون البوابة تحظر الاتصال من خارج المغرب',
  };
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
   ScrapingBee — Fallback scraper with Moroccan proxies
   ══════════════════════════════════════════════════════════════════ */
function buildJsScenario(numero: string, code: string, annee: string, appealCourt?: string, firstInstanceCourt?: string) {
  const esc = (value?: string) => (value ?? '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
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
    { wait: 25000 },
    {
      evaluate: `(()=>{var v={};document.querySelectorAll('input[formcontrolname]').forEach(function(i){v[i.getAttribute('formcontrolname')]=i.value});var dd=[];document.querySelectorAll('.p-dropdown-label').forEach(function(d){dd.push(d.textContent.trim())});var d=document.createElement('div');d.id='__debug__';d.style.display='none';d.setAttribute('data-debug',JSON.stringify({s:window.__L||[],i:v,d:dd,t:!!document.querySelector('table,.p-datatable'),n:document.body.innerText.includes('لا توجد'),b:document.body.innerText.substring(0,250)}));document.body.appendChild(d);return 1})()`
    },
  ];
  return { instructions };
}

async function fetchViaScrapingBee(apiKey: string, input: CaseInput, appealCourt?: string, firstInstanceCourt?: string): Promise<CaseResult> {
  const caseLabel = `${input.numero}/${input.code}/${input.annee}`;
  const start = Date.now();
  log(`🐝 [ScrapingBee] Starting for ${caseLabel}`);

  const scenario = buildJsScenario(input.numero, input.code, input.annee, appealCourt, firstInstanceCourt);
  const scenarioJson = JSON.stringify(scenario);
  const params = new URLSearchParams({
    api_key: apiKey,
    url: 'https://www.mahakim.ma/#/suivi/dossier-suivi',
    render_js: 'true',
    premium_proxy: 'true',
    country_code: 'ma',
    js_scenario: scenarioJson,
    wait: '35000',
    timeout: '90000',
    block_resources: 'false',
  });

  try {
    const resp = await fetch(`https://app.scrapingbee.com/api/v1/?${params}`, {
      signal: AbortSignal.timeout(100000),
    });
    const elapsed = Date.now() - start;
    log(`🐝 [ScrapingBee] Response: status=${resp.status} (${elapsed}ms)`);

    if (!resp.ok) {
      const errText = await resp.text();
      log(`✗ [ScrapingBee] ${caseLabel}: ${resp.status} — ${errText.substring(0, 200)}`);
      let userError = `خطأ ScrapingBee: ${resp.status}`;
      if (resp.status === 401) userError = 'مفتاح ScrapingBee غير صالح — تحقق من الإعدادات';
      else if (resp.status === 402 || errText.includes('credit')) userError = 'رصيد ScrapingBee منتهي — أعد شحن حسابك أو استخدم Firecrawl';
      else if (resp.status === 429) userError = 'تجاوزت حد طلبات ScrapingBee — انتظر دقيقة ثم أعد المحاولة';
      else if (resp.status === 500) userError = 'خطأ داخلي في ScrapingBee — جرّب Firecrawl بدلاً منه';
      return {
        ...input, status: 'error', caseInfo: {}, procedures: [], nextSessionDate: null,
        error: userError,
      };
    }

    const html = await resp.text();
    log(`✓ [ScrapingBee] ${caseLabel}: ${html.length} chars (${elapsed}ms)`);

    const lower = html.toLowerCase();
    if ((lower.includes('captcha') || lower.includes('access denied')) && !lower.includes('p-dropdown')) {
      return { ...input, status: 'error', caseInfo: {}, procedures: [], nextSessionDate: null, error: 'تم حظر الطلب — يُرجى المحاولة لاحقاً' };
    }

    const parsed = parseHtmlFallback(html);

    if (parsed.noResult) {
      return { ...input, status: 'no_data', caseInfo: {}, procedures: [], nextSessionDate: null, error: 'لم يتم العثور على بيانات' };
    }

    if (!parsed.hasData) {
      return { ...input, status: 'no_data', caseInfo: {}, procedures: [], nextSessionDate: null, error: 'لم يتم استخراج بيانات' };
    }

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

    return { ...input, status: 'success', caseInfo: parsed.caseInfo, procedures: parsed.procedures, nextSessionDate };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown';
    log(`✗ [ScrapingBee] ${caseLabel}: ${msg}`);
    let userError = msg;
    if (msg.includes('timeout') || msg.includes('AbortError')) userError = 'انتهت مهلة ScrapingBee (100 ثانية) — البوابة بطيئة، جرّب Firecrawl أو أعد المحاولة لاحقاً';
    else if (msg.includes('fetch')) userError = 'تعذر الاتصال بخدمة ScrapingBee — تحقق من اتصال الإنترنت';
    return { ...input, status: 'error', caseInfo: {}, procedures: [], nextSessionDate: null, error: userError };
  }
}

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
  const patterns: [string, string[]][] = [
    ['court', ['المحكمة']], ['judge', ['القاضي المقرر', 'القاضي']],
    ['department', ['الشعبة']], ['case_type', ['نوع القضية']], ['status', ['الحالة']],
  ];
  for (const [key, labels] of patterns) {
    for (const label of labels) {
      const idx = html.indexOf(label);
      if (idx === -1) continue;
      const after = html.substring(idx, idx + 500);
      const valueMatch = after.match(/>([^<]{2,100})</);
      if (valueMatch && valueMatch[1].trim() !== label) {
        caseInfo[key] = valueMatch[1].trim();
        break;
      }
    }
  }
  return { caseInfo, procedures, hasData: Object.keys(caseInfo).length > 0, noResult: false };
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

  // Schedule ALL future court sessions from procedures with time & room
  if (userId && result.procedures.length > 0) {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const futureSessionMap = new Map<string, { time: string; room: string }>();

    /** Parse composite field like "dd/mm/yyyy على الساعة HH:MM بالقاعة ..." */
    function parseDateField(raw: string | undefined): { dateKey: string; time: string; room: string } | null {
      if (!raw) return null;
      const m = raw.match(/(\d{2})\/(\d{2})\/(\d{4})/);
      if (!m) return null;
      const [, day, month, year] = m;
      const dateObj = new Date(`${year}-${month}-${day}`);
      if (isNaN(dateObj.getTime()) || dateObj < now) return null;
      // Extract time
      const tm = raw.match(/(?:الساعة\s*)?(\d{1,2}:\d{2})/);
      const time = tm ? tm[1] : '';
      // Extract room
      const rm = raw.match(/(?:بالقاعة|القاعة|غرفة)\s*(.+?)$/);
      const room = rm ? rm[1].trim() : '';
      return { dateKey: `${year}-${month}-${day}`, time, room };
    }

    for (const proc of result.procedures) {
      // Extract from next_session_date
      const nsd = parseDateField(proc.next_session_date);
      if (nsd) {
        const sessionTime = proc.session_time || nsd.time || '';
        const sessionRoom = proc.court_room || nsd.room || '';
        if (!futureSessionMap.has(nsd.dateKey)) {
          futureSessionMap.set(nsd.dateKey, { time: sessionTime, room: sessionRoom });
        }
      }
    }

    if (result.nextSessionDate) {
      const key = result.nextSessionDate.substring(0, 10);
      if (!futureSessionMap.has(key)) futureSessionMap.set(key, { time: '', room: '' });
    }

    if (futureSessionMap.size > 0) {
      const { data: existingSessions } = await supabase
        .from('court_sessions')
        .select('id, session_date, session_time, court_room, notes')
        .eq('case_id', caseId);

      const existingByDate = new Map(
        (existingSessions || []).map((s: any) => [s.session_date, s])
      );

      const newSessions: any[] = [];
      const updatedSessions: string[] = [];

      for (const [d, info] of futureSessionMap.entries()) {
        const existing = existingByDate.get(d);
        if (existing) {
          // Update existing session with new time/room if changed
          const needsUpdate = 
            (info.time && info.time !== existing.session_time) ||
            (info.room && info.room !== existing.court_room);
          if (needsUpdate) {
            const upd: Record<string, unknown> = {};
            if (info.time) upd.session_time = info.time;
            if (info.room) upd.court_room = info.room;
            await supabase.from('court_sessions').update(upd).eq('id', existing.id);
            updatedSessions.push(d);
          }
        } else {
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
        }
      }

      if (newSessions.length > 0) {
        await supabase.from('court_sessions').insert(newSessions);
        persistLog.push(`تم إنشاء ${newSessions.length} جلسة مقبلة: ${newSessions.map(s => `${s.session_date}${s.session_time ? ' ' + s.session_time : ''}`).join(', ')}`);
      }
      if (updatedSessions.length > 0) {
        persistLog.push(`تم تحديث ${updatedSessions.length} جلسة: ${updatedSessions.join(', ')}`);
      }
    }
  }

  return persistLog;
}

/* ══════════════════════════════════════════════════════════════════
   Apify Actor — Residential proxy scraping (Primary Provider)
   
   يشغل Actor يتفاعل مع بوابة محاكم عبر بروكسي سكني مغربي
   ويرسل النتائج عبر Webhook لتحديث قاعدة البيانات بشكل غير متزامن
   ══════════════════════════════════════════════════════════════════ */

function buildApifyPageFunction(input: CaseInput, ac?: string, pc?: string): string {
  const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/'/g, "\\'");
  const numero = esc(input.numero);
  const code = esc(input.code);
  const annee = esc(input.annee);
  const acEsc = ac ? esc(ac) : '';
  const pcEsc = pc ? esc(pc) : '';

  return `async function pageFunction(context) {
  const { page, log, request } = context;
  const rndDelay = (min, max) => new Promise(r => setTimeout(r, min + Math.random() * (max - min)));

  // ══════════════════════════════════════════════════════════════
  // Solution #1: API Interception — capture XHR/Fetch responses
  // ══════════════════════════════════════════════════════════════
  const interceptedResponses = [];
  const interceptedRequests = [];
  
  page.on('response', async (response) => {
    try {
      const url = response.url();
      const status = response.status();
      // Capture any API calls the Angular app makes
      if ((url.includes('/api/') || url.includes('/dossier') || url.includes('/search') 
           || url.includes('/suivi') || url.includes('/procedure') || url.includes('/affaire')
           || url.includes('mahakim') || url.includes('/jugement'))
          && status === 200 && response.headers()['content-type']?.includes('json')) {
        try {
          const body = await response.json();
          interceptedResponses.push({ url, status, body, timestamp: Date.now() });
          log.info("API Intercepted: " + url.substring(0, 120) + " — keys: " + Object.keys(body || {}).join(','));
        } catch(e) {}
      }
    } catch(e) {}
  });

  page.on('request', (req) => {
    const url = req.url();
    if (url.includes('/api/') || url.includes('/dossier') || url.includes('/suivi') || url.includes('/procedure')) {
      interceptedRequests.push({ url, method: req.method(), timestamp: Date.now() });
    }
  });

  // ══════════════════════════════════════════════════════════════
  // Solution #7: Slow Stealth — visit homepage first
  // ══════════════════════════════════════════════════════════════
  log.info("Step 0: Slow stealth — landing on homepage first...");
  
  // Wait for page to load (we're already on the target URL from startUrls)
  // But first let's wait for any challenge to clear
  await rndDelay(8000, 12000);

  // Check if we hit an anti-bot challenge
  const pageTitle = await page.title();
  const isChallenge = await page.evaluate(() => {
    const body = document.body?.textContent || '';
    const html = document.body?.innerHTML || '';
    return {
      hasForm: !!document.querySelector('input[formcontrolname]'),
      hasChallenge: /window\\.[A-Za-z0-9_$]{3,}\\s*=!!window\\./.test(html) || html.includes('RegExp'),
      bodyLen: body.length,
      title: document.title,
    };
  });
  log.info("Page check: " + JSON.stringify(isChallenge));

  // If challenge detected, wait longer
  if (isChallenge.hasChallenge || !isChallenge.hasForm) {
    log.info("Anti-bot challenge detected or form not ready — waiting 15s more...");
    await rndDelay(12000, 18000);
  }

  // ══════════════════════════════════════════════════════════════
  // Solution #3: Human-like delays with random mouse movements
  // ══════════════════════════════════════════════════════════════
  
  // Simulate human behavior: random mouse movements
  try {
    await page.mouse.move(200 + Math.random() * 400, 300 + Math.random() * 200);
    await rndDelay(500, 1500);
    await page.mouse.move(100 + Math.random() * 300, 200 + Math.random() * 300);
    await rndDelay(300, 800);
  } catch(e) {}

  // Step 1: Wait for Angular form
  log.info("Waiting for Angular form...");
  try {
    await page.waitForSelector('input[formcontrolname="mark"]', { timeout: 90000 });
    log.info("Angular form found ✓");
  } catch(e) {
    // If form not found, try navigating via hash
    log.warning("Form not found on initial load, trying hash navigation...");
    try {
      await page.evaluate(() => { window.location.hash = '/suivi/dossier-suivi'; });
      await rndDelay(5000, 8000);
      await page.waitForSelector('input[formcontrolname="mark"]', { timeout: 30000 });
      log.info("Form found after hash navigation ✓");
    } catch(e2) {
      var ss = '';
      try { ss = await page.screenshot({ encoding: 'base64', fullPage: false }); } catch(e3) {}
      return { error: "form_not_found", screenshot: ss ? ss.substring(0, 5000) : null, pageTitle: await page.title(), rawText: await page.evaluate(() => document.body.textContent.substring(0, 2000)) };
    }
  }

  // Extra random wait to seem human
  await rndDelay(2000, 4000);

  // Step 2: Fill form fields with human-like typing
  log.info("Filling form fields with human-like delays...");
  
  // Fill code field first (type character by character for stealth)
  await page.click('input[formcontrolname="mark"]');
  await rndDelay(300, 700);
  await page.evaluate((val) => {
    var el = document.querySelector('input[formcontrolname="mark"]');
    if (!el) return;
    var nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    nativeSetter.call(el, val);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    el.dispatchEvent(new Event('blur', { bubbles: true }));
    el.dispatchEvent(new Event('keyup', { bubbles: true }));
  }, "${code}");
  await rndDelay(800, 1500);

  // Fill numero
  await page.click('input[formcontrolname="numero"]');
  await rndDelay(200, 500);
  await page.evaluate((val) => {
    var el = document.querySelector('input[formcontrolname="numero"]');
    if (!el) return;
    var nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    nativeSetter.call(el, val);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    el.dispatchEvent(new Event('blur', { bubbles: true }));
    el.dispatchEvent(new Event('keyup', { bubbles: true }));
  }, "${numero}");
  await rndDelay(800, 1500);

  // Fill annee
  await page.click('input[formcontrolname="annee"]');
  await rndDelay(200, 500);
  await page.evaluate((val) => {
    var el = document.querySelector('input[formcontrolname="annee"]');
    if (!el) return;
    var nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    nativeSetter.call(el, val);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    el.dispatchEvent(new Event('blur', { bubbles: true }));
    el.dispatchEvent(new Event('keyup', { bubbles: true }));
  }, "${annee}");
  
  log.info("Form fields filled ✓");
  await rndDelay(1500, 3000);

${ac ? `
  // Step 3a: Select Appeal Court with human-like interaction
  try {
    log.info("Selecting appeal court: ${acEsc}...");
    
    // Click on the dropdown trigger with mouse movement first
    var triggers = await page.$$('.p-dropdown-trigger, p-dropdown');
    if (triggers.length > 0) {
      var box = await triggers[0].boundingBox();
      if (box) {
        await page.mouse.move(box.x + box.width/2 + Math.random()*5, box.y + box.height/2 + Math.random()*3);
        await rndDelay(300, 600);
      }
      await triggers[0].click();
      await rndDelay(1500, 3000);

      // Wait for dropdown items
      try {
        await page.waitForSelector('.p-dropdown-panel .p-dropdown-item, .p-dropdown-panel li, .p-dropdown-items li', { timeout: 5000 });
      } catch(e) {
        log.warning("Dropdown panel delay, retrying click...");
        await triggers[0].click();
        await rndDelay(2000, 3000);
      }

      var selected = await page.evaluate(function(courtName) {
        var selectors = ['.p-dropdown-panel .p-dropdown-item', '.p-dropdown-panel li.p-element', '.p-dropdown-items-wrapper li', '.p-dropdown-items li', '.p-dropdown-panel li', 'p-dropdownitem li'];
        for (var s = 0; s < selectors.length; s++) {
          var items = document.querySelectorAll(selectors[s]);
          for (var i = 0; i < items.length; i++) {
            if ((items[i].textContent || '').trim().indexOf(courtName) >= 0) {
              items[i].click();
              return { found: true, text: (items[i].textContent || '').trim() };
            }
          }
          if (items.length > 0) return { found: false, count: items.length, first: (items[0].textContent || '').trim() };
        }
        return { found: false, noItems: true };
      }, "${acEsc}");
      log.info("Appeal court: " + JSON.stringify(selected));
      await rndDelay(1500, 3000);
    }
  } catch(e) { log.warning("AC error: " + e.message); }
` : ''}

${pc ? `
  // Step 3b: Enable primary court checkbox
  try {
    log.info("Enabling primary court: ${pcEsc}...");
    var cbResult = await page.evaluate(function() {
      var checkboxes = document.querySelectorAll('.p-checkbox, .p-checkbox-box, input[type="checkbox"]');
      for (var i = 0; i < checkboxes.length; i++) {
        var parent = checkboxes[i].closest('.p-field-checkbox, div');
        var label = parent ? parent.textContent || '' : '';
        if (label.indexOf('الابتدائية') >= 0 || label.indexOf('البحث بالمحاكم') >= 0) {
          checkboxes[i].click();
          return { clicked: true, label: label.trim().substring(0, 80) };
        }
      }
      if (checkboxes.length > 0) { checkboxes[0].click(); return { clicked: true, fallback: true }; }
      return { clicked: false };
    });
    log.info("Checkbox: " + JSON.stringify(cbResult));
    await rndDelay(2500, 4000);

    // Select primary court dropdown
    var dropdowns2 = await page.$$('p-dropdown, .p-dropdown');
    if (dropdowns2.length > 1) {
      var ddIdx = dropdowns2.length > 2 ? 2 : 1;
      await dropdowns2[ddIdx].click();
      await rndDelay(1500, 2500);
      try {
        await page.waitForSelector('.p-dropdown-panel li', { timeout: 5000 });
      } catch(e) {
        var t2 = await page.$$('.p-dropdown-trigger');
        if (t2.length > ddIdx) { await t2[ddIdx].click(); await rndDelay(2000, 3000); }
      }
      var sel2 = await page.evaluate(function(cn) {
        var items = document.querySelectorAll('.p-dropdown-panel li');
        for (var i = 0; i < items.length; i++) {
          if ((items[i].textContent || '').trim().indexOf(cn) >= 0) { items[i].click(); return { found: true }; }
        }
        return { found: false };
      }, "${pcEsc}");
      log.info("Primary court: " + JSON.stringify(sel2));
      await rndDelay(1500, 2500);
    }
  } catch(e) { log.warning("PC error: " + e.message); }
` : ''}

  // Step 4: Click search button with human-like behavior
  await rndDelay(1000, 2000);
  var searchClicked = await page.evaluate(function() {
    var btns = document.querySelectorAll('button');
    for (var i = 0; i < btns.length; i++) {
      var t = (btns[i].textContent || '').trim();
      if (t === 'بحث' || (t.indexOf('بحث') >= 0 && t.length < 15 && t.indexOf('المحاكم') < 0)) {
        btns[i].click();
        return { clicked: true, text: t };
      }
    }
    var sb = document.querySelector('button[type="submit"]');
    if (sb) { sb.click(); return { clicked: true, type: 'submit' }; }
    return { clicked: false };
  });
  log.info("Search: " + JSON.stringify(searchClicked));

  if (!searchClicked || !searchClicked.clicked) {
    var ss2 = '';
    try { ss2 = await page.screenshot({ encoding: 'base64', fullPage: false }); } catch(e) {}
    return { error: "search_btn_not_found", screenshot: ss2 ? ss2.substring(0, 5000) : null };
  }

  // ══════════════════════════════════════════════════════════════
  // Step 5: Wait for results — up to 60s with smart detection
  // Solution #1 continues: also wait for intercepted API responses
  // ══════════════════════════════════════════════════════════════
  log.info("Waiting for results (up to 60s)...");
  var resultFound = false;
  for (var attempt = 0; attempt < 30; attempt++) {
    await rndDelay(1800, 2200);
    
    // Check intercepted API responses first (Solution #1)
    if (interceptedResponses.length > 0) {
      log.info("API responses intercepted: " + interceptedResponses.length);
      resultFound = true;
      await rndDelay(2000, 3000);
      break;
    }
    
    var check = await page.evaluate(function() {
      var body = document.body.textContent || '';
      return {
        hasTables: !!(document.querySelector('table tbody tr td') || document.querySelector('.p-datatable-tbody tr')),
        hasNoData: body.indexOf('لا توجد') >= 0,
        hasJudge: body.indexOf('القاضي المقرر') >= 0 || body.indexOf('القاضي') >= 0,
        hasCaseInfo: body.indexOf('الشعبة') >= 0 || body.indexOf('الحالة') >= 0,
        hasLoading: !!document.querySelector('.p-progressbar, .loading, .spinner, .p-progress-spinner'),
      };
    });
    
    if (check.hasTables || check.hasNoData || check.hasJudge || check.hasCaseInfo) {
      log.info("Results detected at attempt " + attempt + ": " + JSON.stringify(check));
      resultFound = true;
      await rndDelay(2000, 4000);
      break;
    }
    
    // If still loading, keep waiting
    if (check.hasLoading && attempt < 25) {
      log.info("Still loading at attempt " + attempt + "...");
      continue;
    }
  }

  if (!resultFound) {
    log.warning("No results after 60s — will still try extraction");
    await rndDelay(3000, 5000);
  }

  // ══════════════════════════════════════════════════════════════
  // Step 6: Extract ALL data — multiple methods
  // ══════════════════════════════════════════════════════════════
  var data = await page.evaluate(function() {
    var ci = {}, procs = [], allLabels = {}, dropdowns = [], tables = [];
    var body = document.body.textContent || '';
    var html = document.body.innerHTML;
    var noData = body.indexOf('لا توجد أية نتيجة') >= 0;

    // Extract case info
    var fields = [
      ['court','المحكمة'],['judge','القاضي المقرر'],['judge','القاضي'],
      ['department','الشعبة'],['status','الحالة'],['case_type','نوع الملف'],
      ['registration_date','تاريخ التسجيل'],['national_number','الرقم الوطني'],
      ['subject','الموضوع'],['parties','الأطراف'],['plaintiff','المدعي'],
      ['defendant','المدعى عليه'],['section','القسم'],['hearing_room','القاعة'],
      ['next_hearing','الجلسة المقبلة']
    ];
    for (var i = 0; i < fields.length; i++) {
      if (ci[fields[i][0]]) continue;
      var idx = html.indexOf(fields[i][1]);
      if (idx === -1) continue;
      var chunk = html.substring(idx, idx + 500);
      var m = chunk.match(/>([^<]{2,200})</);
      if (m && m[1].trim() !== fields[i][1] && m[1].trim().length > 1) {
        var val = m[1].trim();
        if (val.indexOf('اختيار') < 0 && val.indexOf('formcontrol') < 0) ci[fields[i][0]] = val;
      }
    }

    // Label-value pairs
    document.querySelectorAll('label, .p-field label, th, dt, strong, .label').forEach(function(el) {
      var lbl = (el.textContent || '').trim();
      if (lbl.length < 2 || lbl.length > 60) return;
      var next = el.nextElementSibling;
      if (!next && el.parentElement) next = el.parentElement.querySelector('span, div, td, dd, p');
      if (next) {
        var val = (next.textContent || '').trim();
        if (val && val !== lbl && val.length > 0 && val.length < 500 && val.indexOf('اختيار') < 0) allLabels[lbl] = val;
      }
    });

    // Dropdowns
    document.querySelectorAll('.p-dropdown-label, select').forEach(function(d) {
      var v = (d.textContent || d.value || '').trim();
      if (v && v.length > 1) dropdowns.push(v);
    });

    // ALL tables
    document.querySelectorAll('table, .p-datatable').forEach(function(tbl, tIdx) {
      var headers = [], rows = [];
      tbl.querySelectorAll('thead th, .p-datatable-thead th').forEach(function(th) { headers.push((th.textContent || '').trim()); });
      tbl.querySelectorAll('tbody tr, .p-datatable-tbody tr').forEach(function(tr) {
        var cells = [];
        tr.querySelectorAll('td').forEach(function(td) { cells.push((td.textContent || '').trim()); });
        if (cells.length > 0) rows.push(cells);
      });
      tables.push({ index: tIdx, headers: headers, rows: rows });
    });

    // Procedures from tables
    var allRows = document.querySelectorAll('table tbody tr, .p-datatable-tbody tr');
    for (var j = 0; j < allRows.length; j++) {
      var c = allRows[j].querySelectorAll('td');
      if (c.length >= 2) {
        var ad = c[0] ? c[0].textContent.trim() : '';
        if (ad && ad.indexOf('تاريخ') < 0 && ad.length < 60 && ad.length > 0) {
          procs.push({
            action_date: ad,
            action_type: c[1] ? c[1].textContent.trim() : '',
            decision: c.length > 2 && c[2] ? c[2].textContent.trim() : '',
            next_session_date: c.length > 3 && c[3] ? c[3].textContent.trim() : '',
            col5: c.length > 4 && c[4] ? c[4].textContent.trim() : '',
            col6: c.length > 5 && c[5] ? c[5].textContent.trim() : '',
          });
        }
      }
    }

    return {
      caseInfo: ci, procedures: procs, noData: noData,
      allLabels: allLabels, dropdowns: dropdowns, tables: tables,
      rawText: body.substring(0, 8000), pageTitle: document.title, url: window.location.href,
      _debug: {
        totalTables: document.querySelectorAll('table, .p-datatable').length,
        totalRows: allRows.length,
        totalDropdowns: document.querySelectorAll('p-dropdown, .p-dropdown').length,
        totalButtons: document.querySelectorAll('button').length,
        bodyLength: body.length,
      }
    };
  });

  // ══════════════════════════════════════════════════════════════
  // Solution #1 continued: Merge intercepted API data
  // ══════════════════════════════════════════════════════════════
  if (interceptedResponses.length > 0) {
    data._interceptedAPIs = interceptedResponses.map(r => ({
      url: r.url,
      keys: Object.keys(r.body || {}),
      bodyPreview: JSON.stringify(r.body).substring(0, 2000),
    }));
    
    // Try to extract case data from intercepted responses
    for (var ir of interceptedResponses) {
      var apiBody = ir.body;
      if (!apiBody) continue;
      
      // If the API returns case info directly
      if (apiBody.judge || apiBody.juge || apiBody.magistrat) {
        data.caseInfo.judge = data.caseInfo.judge || apiBody.judge || apiBody.juge || apiBody.magistrat;
      }
      if (apiBody.department || apiBody.chambre) {
        data.caseInfo.department = data.caseInfo.department || apiBody.department || apiBody.chambre;
      }
      if (apiBody.status || apiBody.statut || apiBody.etat) {
        data.caseInfo.status = data.caseInfo.status || apiBody.status || apiBody.statut || apiBody.etat;
      }
      
      // If API returns procedures array
      if (Array.isArray(apiBody.procedures || apiBody.demarches || apiBody.data)) {
        var apiProcs = apiBody.procedures || apiBody.demarches || apiBody.data;
        if (apiProcs.length > 0 && data.procedures.length === 0) {
          log.info("Using procedures from intercepted API: " + apiProcs.length);
          data.procedures = apiProcs.map(function(p) {
            return {
              action_date: p.action_date || p.date || p.dateAction || '',
              action_type: p.action_type || p.type || p.typeAction || p.nature || '',
              decision: p.decision || p.resultat || '',
              next_session_date: p.next_session_date || p.prochaine || p.dateProchaine || '',
            };
          });
          data._source = 'api_interception';
        }
      }
    }
  }
  data._interceptedRequestCount = interceptedRequests.length;
  data._interceptedResponseCount = interceptedResponses.length;

  // Screenshot if no useful data (for debugging)
  if (data.procedures.length === 0 && !data.noData) {
    try {
      var debugSS = await page.screenshot({ encoding: 'base64', fullPage: false });
      data._screenshot = debugSS ? debugSS.substring(0, 50000) : null;
    } catch(e3) {}
  }

  log.info("Done: " + Object.keys(data.caseInfo).length + " fields, " + data.procedures.length + " procs, APIs intercepted: " + interceptedResponses.length);
  return data;
}`;
}

async function launchApifyActor(
  apiToken: string,
  input: CaseInput,
  jobId: string,
  caseId: string,
  userId: string,
  caseNumber: string,
  appealCourt?: string,
  firstInstanceCourt?: string,
): Promise<{ launched: boolean; runId?: string; error?: string }> {
  const webhookUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/apify-mahakim-webhook`;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';

  const pf = buildApifyPageFunction(input, appealCourt, firstInstanceCourt);

  // Build the request with enhanced stealth configuration
  const actorInput = {
    startUrls: [{ url: 'https://www.mahakim.ma/#/suivi/dossier-suivi' }],
    proxyConfiguration: {
      useApifyProxy: true,
      apifyProxyGroups: ['RESIDENTIAL'],
      apifyProxyCountry: 'MA',
    },
    maxRequestRetries: 3,
    requestHandlerTimeoutSecs: 300,  // 5 minutes for slow portal
    navigationTimeoutSecs: 120,
    useChrome: true,
    headless: true,
    // Solution #6: Fingerprint rotation & stealth
    preNavigationHooks: `[
      async ({ page }, goToOptions) => {
        // Comprehensive anti-detection
        await page.evaluateOnNewDocument(() => {
          // Hide webdriver
          Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
          
          // Fake plugins
          Object.defineProperty(navigator, 'plugins', {
            get: () => {
              var arr = [
                { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer' },
                { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai' },
                { name: 'Native Client', filename: 'internal-nacl-plugin' },
              ];
              arr.length = 3;
              return arr;
            }
          });
          
          // Languages
          Object.defineProperty(navigator, 'languages', { get: () => ['ar', 'fr', 'en-US', 'en'] });
          Object.defineProperty(navigator, 'language', { get: () => 'ar' });
          
          // Chrome runtime
          window.chrome = { runtime: {}, loadTimes: function(){}, csi: function(){} };
          
          // Permissions
          const originalQuery = window.navigator.permissions.query;
          window.navigator.permissions.query = (parameters) =>
            parameters.name === 'notifications'
              ? Promise.resolve({ state: Notification.permission })
              : originalQuery(parameters);
          
          // Canvas fingerprint noise
          const origToDataURL = HTMLCanvasElement.prototype.toDataURL;
          HTMLCanvasElement.prototype.toDataURL = function(type) {
            if (type === 'image/png' && this.width > 0) {
              const ctx = this.getContext('2d');
              if (ctx) {
                const imageData = ctx.getImageData(0, 0, this.width, this.height);
                for (let i = 0; i < imageData.data.length; i += 100) {
                  imageData.data[i] = imageData.data[i] ^ (Math.random() * 2 | 0);
                }
                ctx.putImageData(imageData, 0, 0);
              }
            }
            return origToDataURL.apply(this, arguments);
          };
          
          // WebGL vendor/renderer
          const getParameter = WebGLRenderingContext.prototype.getParameter;
          WebGLRenderingContext.prototype.getParameter = function(parameter) {
            if (parameter === 37445) return 'Intel Inc.';
            if (parameter === 37446) return 'Intel Iris OpenGL Engine';
            return getParameter.apply(this, arguments);
          };
        });
        
        // Set realistic viewport
        await page.setViewport({ width: 1366, height: 768, deviceScaleFactor: 1 });
        
        // Set extra headers to look like a real Moroccan browser
        await page.setExtraHTTPHeaders({
          'Accept-Language': 'ar,fr;q=0.9,en-US;q=0.8,en;q=0.7',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        });
      }
    ]`,
    pageFunction: pf,
  };
  try {
    // Build webhook config — Apify expects base64-encoded JSON in the query param
    const webhookConfig = [{
      eventTypes: ['ACTOR.RUN.SUCCEEDED', 'ACTOR.RUN.FAILED', 'ACTOR.RUN.TIMED_OUT', 'ACTOR.RUN.ABORTED'],
      requestUrl: webhookUrl,
      shouldInterpolateStrings: true,
      payloadTemplate: `{"jobId":"${jobId}","caseId":"${caseId}","userId":"${userId}","caseNumber":"${caseNumber}","eventType":{{eventType}},"runId":{{resource.id}},"datasetId":{{resource.defaultDatasetId}},"status":{{resource.status}}}`,
      headersTemplate: `{"Content-Type":"application/json","Authorization":"Bearer ${anonKey}","apikey":"${anonKey}"}`,
    }];
    const webhooksParam = btoa(JSON.stringify(webhookConfig));
    const runUrl = `${APIFY_API_BASE}/acts/apify~puppeteer-scraper/runs?token=${apiToken}&webhooks=${webhooksParam}`;

    const resp = await fetch(runUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(actorInput),
      signal: AbortSignal.timeout(30000),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      log(`✗ [Apify] Launch failed: ${resp.status} — ${errText.substring(0, 200)}`);
      return { launched: false, error: `Apify error: ${resp.status}` };
    }

    const data = await resp.json();
    const runId = data?.data?.id;
    log(`✓ [Apify] Actor launched: runId=${runId}`);
    return { launched: true, runId };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown';
    log(`✗ [Apify] Launch error: ${msg}`);
    return { launched: false, error: msg };
  }
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

    const FIRECRAWL_API_KEY = Deno.env.get('FIRECRAWL_API_KEY');
    const SCRAPINGBEE_API_KEY = Deno.env.get('SCRAPINGBEE_API_KEY');
    const APIFY_API_TOKEN = Deno.env.get('APIFY_API_TOKEN');
    
    if (!FIRECRAWL_API_KEY && !SCRAPINGBEE_API_KEY && !APIFY_API_TOKEN) {
      return new Response(JSON.stringify({
        status: 'error',
        error: 'لم يتم تعيين أي مفتاح للجلب (Apify أو Firecrawl أو ScrapingBee)',
      }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const preferredProvider = (body.provider as ScrapeProvider) || 'auto';

    /** Smart dual-provider fetch with automatic fallback */
    async function fetchCase(
      input: CaseInput,
      ac?: string,
      pc?: string,
      expectedCourt?: string,
    ): Promise<CaseResult & { usedProvider?: string }> {
      const providers: Array<{ name: string; fn: () => Promise<CaseResult | null> }> = [];

      if (preferredProvider === 'firecrawl' && FIRECRAWL_API_KEY) {
        providers.push({ name: 'firecrawl', fn: () => fetchViaFirecrawl(FIRECRAWL_API_KEY!, input, ac, pc) });
        if (SCRAPINGBEE_API_KEY) providers.push({ name: 'scrapingbee', fn: () => fetchViaScrapingBee(SCRAPINGBEE_API_KEY!, input, ac, pc) });
      } else if (preferredProvider === 'scrapingbee' && SCRAPINGBEE_API_KEY) {
        providers.push({ name: 'scrapingbee', fn: () => fetchViaScrapingBee(SCRAPINGBEE_API_KEY!, input, ac, pc) });
        if (FIRECRAWL_API_KEY) providers.push({ name: 'firecrawl', fn: () => fetchViaFirecrawl(FIRECRAWL_API_KEY!, input, ac, pc) });
      } else {
        if (FIRECRAWL_API_KEY) providers.push({ name: 'firecrawl', fn: () => fetchViaFirecrawl(FIRECRAWL_API_KEY!, input, ac, pc) });
        if (SCRAPINGBEE_API_KEY) providers.push({ name: 'scrapingbee', fn: () => fetchViaScrapingBee(SCRAPINGBEE_API_KEY!, input, ac, pc) });
      }

      for (const p of providers) {
        log(`🔀 Trying ${p.name}...`);
        try {
          const result = await p.fn();
          if (result && result.status === 'success') {
            const matchesExpectedCourt = doesResultMatchExpectedCourt(
              expectedCourt,
              result.caseInfo.court,
              [result.caseInfo.section, result.caseInfo.department, result.caseInfo.subject],
            );

            if (!matchesExpectedCourt) {
              log(`⛔ Ignored mismatched result from ${p.name}: expected="${expectedCourt}" actual="${result.caseInfo.court || ''}"`);
              return {
                ...result,
                status: 'error',
                usedProvider: p.name,
                error: `تم العثور على نتيجة من محكمة أخرى غير المحكمة المسجلة (${expectedCourt}) وتم تجاهلها حفاظاً على صحة الملف`,
              };
            }

            log(`✓ ${p.name} succeeded`);
            return { ...result, usedProvider: p.name };
          }
          if (result && result.status === 'no_data') {
            return { ...result, usedProvider: p.name };
          }
          log(`✗ ${p.name} returned ${result?.status || 'null'} — trying next provider`);
        } catch (err) {
          log(`✗ ${p.name} threw: ${err instanceof Error ? err.message : 'unknown'}`);
        }
      }

      return {
        ...input, status: 'error', caseInfo: {}, procedures: [], nextSessionDate: null,
        error: 'فشل الجلب عبر جميع المزودين. اقتراحات: ① تحقق من صحة رقم الملف ② جرّب مزوداً مختلفاً ③ تأكد أن البوابة متاحة عبر mahakim.ma',
        usedProvider: 'none',
      };
    }

    /** Create notification on persistent failure */
    async function notifyOnFailure(supabaseClient: ReturnType<typeof createClient>, jobUserId: string, jobCaseId: string, caseNumber: string, errorMsg: string) {
      try {
        const { data: existing } = await supabaseClient
          .from('notifications')
          .select('id')
          .eq('case_id', jobCaseId)
          .eq('user_id', jobUserId)
          .eq('is_read', false)
          .ilike('message', '%فشل المزامنة%')
          .limit(1);

        if (existing && existing.length > 0) return;

        const { data: session } = await supabaseClient
          .from('court_sessions')
          .select('id')
          .eq('case_id', jobCaseId)
          .order('created_at', { ascending: false })
          .limit(1);

        const sessionId = session?.[0]?.id ?? null;

        await supabaseClient.from('notifications').insert({
          user_id: jobUserId,
          case_id: jobCaseId,
          session_id: sessionId,
          message: `فشل المزامنة التلقائية للملف ${caseNumber}: ${errorMsg}`,
          is_read: false,
        });
        log(`🔔 Notification created for failed sync: ${caseNumber}`);
      } catch (e) {
        log(`⚠ Failed to create notification: ${e instanceof Error ? e.message : 'unknown'}`);
      }
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

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
          let expectedCourt = payload.expectedCourt as string | undefined;

          if (!appealCourt || !expectedCourt) {
            const resolved = await resolveCourtForCase(supabase, job.case_id, input.code);
            appealCourt = appealCourt || resolved.appeal || undefined;
            firstInstanceCourt = firstInstanceCourt || resolved.primary || undefined;
            expectedCourt = expectedCourt || resolved.expectedCourt || undefined;
          }

          const result = await fetchCase(input, appealCourt, firstInstanceCourt, expectedCourt);
          await persistResults(supabase, job.case_id, job.user_id, result);

          const finalStatus = result.status === 'success' ? 'completed' : 'failed';
          await supabase.from('mahakim_sync_jobs').update({
            status: finalStatus,
            result_data: { ...result.caseInfo, _provider: result.usedProvider, expected_court: expectedCourt || null },
            error_message: result.error || null,
            next_session_date: result.nextSessionDate,
            completed_at: new Date().toISOString(),
          }).eq('id', job.id);

          if (finalStatus === 'failed' && (job.retry_count || 0) >= 1) {
            await notifyOnFailure(supabase, job.user_id, job.case_id, job.case_number, result.error || 'خطأ غير معروف');
          }
          processed++;
        } catch (err) {
          await supabase.from('mahakim_sync_jobs').update({
            status: 'failed',
            error_message: err instanceof Error ? err.message : 'Unknown',
            retry_count: (job.retry_count || 0) + 1,
            completed_at: new Date().toISOString(),
          }).eq('id', job.id);
          if ((job.retry_count || 0) >= 1) {
            await notifyOnFailure(supabase, job.user_id, job.case_id, job.case_number, err instanceof Error ? err.message : 'خطأ غير معروف');
          }
        }
      }

      return new Response(JSON.stringify({ status: 'success', processed, logs }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

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

      let appealCourt = body.appealCourt as string | undefined;
      let firstInstanceCourt = body.firstInstanceCourt as string | undefined;
      let expectedCourt = body.expectedCourt as string | undefined;
      if (!appealCourt || !expectedCourt) {
        const resolved = await resolveCourtForCase(supabase, jCaseId, input.code);
        appealCourt = appealCourt || resolved.appeal || undefined;
        firstInstanceCourt = firstInstanceCourt || resolved.primary || undefined;
        expectedCourt = expectedCourt || resolved.expectedCourt || undefined;
      }

      if (APIFY_API_TOKEN) {
        log('🚀 Launching Apify Actor (async residential proxy)...');
        const apifyResult = await launchApifyActor(
          APIFY_API_TOKEN, input, jobId, jCaseId,
          body.userId || '', caseNumber,
          appealCourt, firstInstanceCourt,
        );
        if (apifyResult.launched) {
          await supabase.from('mahakim_sync_jobs').update({
            status: 'scraping',
            request_payload: {
              ...(body.request_payload || {}),
              provider: 'apify',
              apify_run_id: apifyResult.runId,
              appealCourt: appealCourt || null,
              firstInstanceCourt: firstInstanceCourt || null,
              expectedCourt: expectedCourt || null,
            },
          }).eq('id', jobId);

          return new Response(JSON.stringify({
            success: true,
            status: 'scraping',
            provider: 'apify',
            runId: apifyResult.runId,
            message: 'تم إطلاق المزامنة عبر Apify — ستصل النتائج تلقائياً خلال 60-90 ثانية',
            logs,
          }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        log(`⚠ Apify launch failed: ${apifyResult.error} — falling back to sync providers`);
      }

      try {
        const result = await fetchCase(input, appealCourt, firstInstanceCourt, expectedCourt);
        const persistLog = await persistResults(supabase, jCaseId, body.userId, result);

        const finalStatus = result.status === 'success' ? 'completed' : 'failed';
        await supabase.from('mahakim_sync_jobs').update({
          status: finalStatus,
          result_data: { ...result.caseInfo, _provider: result.usedProvider, expected_court: expectedCourt || null },
          error_message: result.error || null,
          next_session_date: result.nextSessionDate,
          completed_at: new Date().toISOString(),
        }).eq('id', jobId);

        if (finalStatus === 'failed' && body.userId) {
          await notifyOnFailure(supabase, body.userId, jCaseId, caseNumber, result.error || 'خطأ غير معروف');
        }

        return new Response(JSON.stringify({
          success: result.status === 'success',
          status: result.status,
          usedProvider: result.usedProvider,
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

        if (body.userId) {
          await notifyOnFailure(supabase, body.userId, jCaseId, caseNumber, errMsg);
        }

        return new Response(JSON.stringify({ success: false, error: errMsg, logs }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

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

    const batch = cases.slice(0, 2);
    const results: CaseResult[] = [];

    for (let i = 0; i < batch.length; i++) {
      if (i > 0) await randomDelay();

      let appealCourt = batch[i].courtType === 'appeal' ? undefined : undefined;
      let primaryCourt: string | undefined;
      let expectedCourt: string | undefined;
      if (caseId) {
        const resolved = await resolveCourtForCase(supabase, caseId, batch[i].code);
        appealCourt = resolved.appeal || undefined;
        primaryCourt = resolved.primary || undefined;
        expectedCourt = resolved.expectedCourt || undefined;
      }

      const result = await fetchCase(batch[i], appealCourt, primaryCourt, expectedCourt);
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
