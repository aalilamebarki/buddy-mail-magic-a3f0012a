import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const FIRECRAWL_API = "https://api.firecrawl.dev/v1";

function generateHashEmbedding(text: string): number[] {
  const embedding = new Array(768);
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = ((hash << 5) - hash) + text.charCodeAt(i);
    hash |= 0;
  }
  for (let i = 0; i < 768; i++) {
    hash = ((hash << 5) - hash) + i;
    hash |= 0;
    embedding[i] = (hash % 2000 - 1000) / 1000;
  }
  return embedding;
}

function chunkText(text: string, max = 1500): string[] {
  const paragraphs = text.split(/\n\n+/);
  const chunks: string[] = [];
  let current = "";
  for (const p of paragraphs) {
    if ((current + "\n\n" + p).length > max && current) {
      chunks.push(current.trim());
      current = p;
    } else {
      current = current ? current + "\n\n" + p : p;
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks;
}

function detectCategory(text: string): string {
  const patterns = [
    { r: /(?:كراء|الكراء|المكتري|المكري|إفراغ)/, v: "قانون الكراء" },
    { r: /(?:الطلاق|النفقة|الحضانة|الزواج|مدونة الأسرة)/, v: "مدونة الأسرة" },
    { r: /(?:التحفيظ|العقار|الرسم العقاري|الحقوق العينية)/, v: "القانون العقاري" },
    { r: /(?:الشغل|العمل|الأجير|المشغل|الفصل التعسفي)/, v: "قانون الشغل" },
    { r: /(?:التجاري|الشركة|الكمبيالة|الإفلاس)/, v: "القانون التجاري" },
    { r: /(?:الجنائي|الجناية|الجنحة|المتهم|النيابة العامة)/, v: "القانون الجنائي" },
    { r: /(?:الإداري|الدولة|الجماعة|نزع الملكية)/, v: "القانون الإداري" },
    { r: /(?:المسؤولية|التعويض|الضرر|العقد|الالتزام)/, v: "القانون المدني" },
    { r: /(?:المسطرة المدنية|الدعوى|الاستئناف|التنفيذ)/, v: "المسطرة المدنية" },
    { r: /(?:المسطرة الجنائية|البحث|التحقيق|المحاكمة)/, v: "المسطرة الجنائية" },
    { r: /(?:الضريبة|الضرائب|المالية|الجمارك)/, v: "القانون المالي والضريبي" },
  ];
  for (const p of patterns) {
    if (p.r.test(text)) return p.v;
  }
  return "أخرى";
}

// Detect precise doc_type from content
function detectDocType(text: string, url: string): string {
  const lower = text.slice(0, 2000);
  
  // Rulings
  if (url.includes("juriscassation") || url.includes("cspj")) return "ruling";
  if (/(?:قرار\s+محكمة\s+النقض|قرار\s+عدد|حكم\s+قضائي|اجتهاد\s+قضائي)/.test(lower)) return "ruling";
  
  // Dahir (Royal Decree)
  if (/(?:ظهير\s+شريف|الظهير\s+الشريف)/.test(lower)) return "dahir";
  
  // Organic law
  if (/(?:قانون\s+تنظيمي|القانون\s+التنظيمي)/.test(lower)) return "organic_law";
  
  // Decree
  if (/(?:مرسوم\s+رقم|المرسوم\s+رقم|مرسوم\s+بقانون)/.test(lower)) return "decree";
  
  // Circular / Directive
  if (/(?:دورية|منشور|مذكرة\s+توجيهية)/.test(lower)) return "circular";
  
  // Convention / Treaty
  if (/(?:اتفاقية|معاهدة|بروتوكول|مصادقة\s+على)/.test(lower)) return "convention";
  
  // Decision / Order
  if (/(?:قرار\s+(?:وزير|لوزير|للوزير|مشترك)|قرار\s+رقم)/.test(lower)) return "decision";
  
  // Law (default for legislative texts)
  if (/(?:قانون\s+رقم|القانون\s+رقم|مدونة)/.test(lower)) return "law";
  
  // If from SGG, default to law
  if (url.includes("sgg.gov.ma")) return "law";
  
  return "law";
}

// Extract structured metadata
function extractMetadata(text: string, url: string) {
  const snippet = text.slice(0, 3000);
  
  let referenceNumber = "";
  let dahirNumber = "";
  let decreeNumber = "";
  let publicationDate = "";
  let chamber = "";
  let fileNumber = "";
  let subject = "";
  
  // Law number: قانون رقم 12.34
  const lawNumMatch = snippet.match(/قانون\s+(?:تنظيمي\s+)?رقم\s+(\d+[\.\-]\d+)/);
  if (lawNumMatch) referenceNumber = lawNumMatch[1];
  
  // Dahir number: ظهير شريف رقم 1.23.45
  const dahirMatch = snippet.match(/ظهير\s+شريف\s+رقم\s+([\d\.]+)/);
  if (dahirMatch) dahirNumber = dahirMatch[1];
  
  // Decree number: مرسوم رقم 2.23.45
  const decreeMatch = snippet.match(/مرسوم\s+رقم\s+([\d\.]+)/);
  if (decreeMatch) decreeNumber = decreeMatch[1];
  
  // Ruling reference: قرار عدد 1234
  const rulingRefMatch = snippet.match(/(?:قرار\s+)?عدد\s*[:\s]*(\d+(?:\/\d+)?)/);
  if (rulingRefMatch && !referenceNumber) referenceNumber = rulingRefMatch[1];
  
  // File number: ملف عدد 1234/2024
  const fileMatch = snippet.match(/ملف\s+(?:\w+\s+)?عدد\s*[:\s]*([\d\/]+)/);
  if (fileMatch) fileNumber = fileMatch[1];
  
  // Date
  const dateMatch = snippet.match(/(\d{4}[-/]\d{1,2}[-/]\d{1,2})/);
  if (dateMatch) publicationDate = dateMatch[1];
  
  // Hijri date with year
  const hijriMatch = snippet.match(/(\d{1,2})\s+(?:محرم|صفر|ربيع الأول|ربيع الثاني|جمادى الأولى|جمادى الثانية|رجب|شعبان|رمضان|شوال|ذو القعدة|ذو الحجة)\s+(\d{4})/);
  
  // Gregorian date
  const gregMatch = snippet.match(/(\d{1,2})\s+(?:يناير|فبراير|مارس|أبريل|ماي|يونيو|يوليوز|غشت|شتنبر|أكتوبر|نونبر|دجنبر|أغسطس)\s+(\d{4})/);
  if (gregMatch && !publicationDate) publicationDate = gregMatch[0];
  
  // Chamber
  const chamberPatterns = [
    { regex: /الغرفة\s+المدنية/, value: "الغرفة المدنية" },
    { regex: /الغرفة\s+الجنائية/, value: "الغرفة الجنائية" },
    { regex: /الغرفة\s+التجارية/, value: "الغرفة التجارية" },
    { regex: /الغرفة\s+الاجتماعية/, value: "الغرفة الاجتماعية" },
    { regex: /الغرفة\s+الإدارية/, value: "الغرفة الإدارية" },
    { regex: /غرفة\s+الأحوال\s+الشخصية/, value: "غرفة الأحوال الشخصية والميراث" },
  ];
  for (const p of chamberPatterns) {
    if (p.regex.test(snippet)) { chamber = p.value; break; }
  }
  
  // Subject - first meaningful sentence
  const lines = snippet.split('\n').filter(l => l.trim().length > 20);
  if (lines.length > 0) {
    const subjectLine = lines.find(l => 
      /(?:يتعلق|بشأن|المتعلق|في شأن|القاضي|الصادر)/.test(l)
    );
    if (subjectLine) subject = subjectLine.trim().slice(0, 300);
  }
  
  return { referenceNumber, dahirNumber, decreeNumber, publicationDate, chamber, fileNumber, subject };
}

// Check if content is relevant legal text
function isRelevantLegalContent(text: string, url: string): boolean {
  if (text.length < 200) return false;
  
  // Skip navigation, menu, footer pages
  const skipPatterns = [
    /^(?:menu|nav|footer|header|sidebar|cookie)/i,
    /^\s*(?:الصفحة الرئيسية|اتصل بنا|من نحن|خريطة الموقع)\s*$/,
  ];
  for (const p of skipPatterns) {
    if (p.test(text.slice(0, 100))) return false;
  }
  
  // Must contain Arabic legal keywords
  const legalKeywords = /(?:قانون|ظهير|مرسوم|مادة|فصل|باب|قرار|حكم|محكمة|دورية|منشور|اتفاقية|الجريدة الرسمية|بتنفيذ|صدر|المملكة المغربية)/;
  return legalKeywords.test(text);
}

// Search queries organized by source
const SGG_SEARCHES = [
  "site:sgg.gov.ma ظهير شريف قانون",
  "site:sgg.gov.ma الجريدة الرسمية نص قانوني",
  "site:sgg.gov.ma قانون الالتزامات والعقود",
  "site:sgg.gov.ma مدونة الأسرة",
  "site:sgg.gov.ma مدونة الشغل",
  "site:sgg.gov.ma قانون المسطرة المدنية",
  "site:sgg.gov.ma قانون المسطرة الجنائية",
  "site:sgg.gov.ma القانون الجنائي",
  "site:sgg.gov.ma قانون الكراء",
  "site:sgg.gov.ma مدونة التجارة",
  "site:sgg.gov.ma قانون التحفيظ العقاري",
  "site:sgg.gov.ma قانون الشركات",
  "site:sgg.gov.ma قانون المحاماة",
  "site:sgg.gov.ma قانون التوثيق",
  "site:sgg.gov.ma ظهير التحفيظ العقاري",
  "site:sgg.gov.ma قانون حماية المستهلك",
  "site:sgg.gov.ma مرسوم تطبيقي",
  "site:sgg.gov.ma دورية منشور",
  "site:sgg.gov.ma قانون تنظيمي",
  "site:sgg.gov.ma قانون المالية",
];

const CASSATION_SEARCHES = [
  "site:juriscassation.cspj.ma قرار محكمة النقض",
  "site:juriscassation.cspj.ma الغرفة المدنية",
  "site:juriscassation.cspj.ma الغرفة الجنائية",
  "site:juriscassation.cspj.ma الغرفة التجارية",
  "site:juriscassation.cspj.ma الغرفة الاجتماعية",
  "site:juriscassation.cspj.ma الغرفة الإدارية",
  "site:juriscassation.cspj.ma غرفة الأحوال الشخصية",
  "site:juriscassation.cspj.ma قرار الكراء الإفراغ",
  "site:juriscassation.cspj.ma قرار الطلاق النفقة",
  "site:juriscassation.cspj.ma قرار التحفيظ العقاري",
  "site:juriscassation.cspj.ma قرار الفصل التعسفي الشغل",
  "site:juriscassation.cspj.ma قرار المسؤولية التعويض",
  "site:juriscassation.cspj.ma اجتهاد قضائي",
];

const ALL_SOURCES: Record<string, string[]> = {
  sgg: SGG_SEARCHES,
  cassation: CASSATION_SEARCHES,
};

async function searchAndIngest(query: string, apiKey: string, supabase: any) {
  const resp = await fetch(`${FIRECRAWL_API}/search`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query,
      limit: 5,
      lang: "ar",
      country: "ma",
      scrapeOptions: { formats: ["markdown"] },
    }),
  });

  if (!resp.ok) {
    console.error(`Search failed for "${query}":`, await resp.text());
    return { ingested: 0, docs: [] };
  }

  const data = await resp.json();
  const results = data.data || [];
  let ingested = 0;
  const docs: any[] = [];

  for (const result of results) {
    const markdown = result.markdown || "";
    let title = result.title || "";
    const url = result.url || "";

    if (!markdown || markdown.length < 100) continue;
    
    // Filter irrelevant content
    if (!isRelevantLegalContent(markdown, url)) continue;

    // Check duplicate by source URL
    const { data: existing } = await supabase
      .from("legal_documents")
      .select("id")
      .eq("source", url)
      .limit(1);
    if (existing && existing.length > 0) continue;

    // Detect doc type
    const docType = detectDocType(markdown, url);
    const meta = extractMetadata(markdown, url);
    const category = detectCategory(markdown);

    // Build structured title
    if (!title || title.length < 5 || /^(home|index|page|untitled)/i.test(title)) {
      const headingMatch = markdown.match(/^#+\s*(.+)/m);
      if (headingMatch) title = headingMatch[1].trim().slice(0, 300);
      else {
        const firstLine = markdown.split('\n').find(l => l.trim().length > 10);
        title = firstLine ? firstLine.trim().slice(0, 300) : "مستند قانوني";
      }
    }

    // Enrich title based on doc type
    if (docType === "ruling" && meta.referenceNumber) {
      const parts = ['قرار محكمة النقض عدد ' + meta.referenceNumber];
      if (meta.chamber) parts.push('- ' + meta.chamber);
      if (meta.publicationDate) parts.push('بتاريخ ' + meta.publicationDate);
      title = parts.join(' ');
    } else if (docType === "dahir" && meta.dahirNumber) {
      title = `ظهير شريف رقم ${meta.dahirNumber}` + (meta.subject ? ` ${meta.subject.slice(0, 100)}` : '');
    } else if (docType === "decree" && meta.decreeNumber) {
      title = `مرسوم رقم ${meta.decreeNumber}` + (meta.subject ? ` ${meta.subject.slice(0, 100)}` : '');
    }

    const chunks = chunkText(markdown);
    let chunkCount = 0;

    for (const chunk of chunks) {
      const { error } = await supabase.from("legal_documents").insert({
        title: title.slice(0, 500),
        content: chunk,
        source: url,
        doc_type: docType,
        category,
        reference_number: meta.referenceNumber || meta.dahirNumber || meta.decreeNumber || null,
        court_chamber: docType === 'ruling' ? (meta.chamber || null) : null,
        decision_date: meta.publicationDate || null,
        embedding: JSON.stringify(generateHashEmbedding(chunk)),
        metadata: {
          scraped: true,
          query,
          scraped_at: new Date().toISOString(),
          dahir_number: meta.dahirNumber || null,
          decree_number: meta.decreeNumber || null,
          file_number: meta.fileNumber || null,
          subject: meta.subject || null,
        },
      });
      if (!error) chunkCount++;
    }

    if (chunkCount > 0) {
      ingested += chunkCount;
      docs.push({ title: title.slice(0, 100), url, doc_type: docType, chunks: chunkCount, category });
    }
  }

  return { ingested, docs };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");
    if (!FIRECRAWL_API_KEY) throw new Error("FIRECRAWL_API_KEY not configured");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const body = await req.json();
    const { action, source, start_index, count: reqCount } = body;

    if (action === "batch_search") {
      const sourceList = ALL_SOURCES[source] || SGG_SEARCHES;
      const start = start_index ?? 0;
      const count = Math.min(reqCount ?? 3, 5);
      const allDocs: any[] = [];
      let totalIngested = 0;

      for (let i = start; i < start + count && i < sourceList.length; i++) {
        console.log(`[BATCH ${i + 1 - start}/${count}] "${sourceList[i]}"`);
        try {
          const result = await searchAndIngest(sourceList[i], FIRECRAWL_API_KEY, supabase);
          totalIngested += result.ingested;
          allDocs.push(...result.docs);
        } catch (err) {
          console.error(`Search ${i} error:`, err);
        }
        await new Promise(r => setTimeout(r, 800));
      }

      return new Response(
        JSON.stringify({
          success: true,
          source: source || "sgg",
          processed: count,
          totalIngested,
          documentsAdded: allDocs.length,
          ingested: allDocs,
          remaining: Math.max(0, sourceList.length - (start + count)),
          nextIndex: start + count,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (action === "status") {
      const { count } = await supabase
        .from("legal_documents")
        .select("*", { count: "exact", head: true });

      return new Response(
        JSON.stringify({
          sources: {
            sgg: { name: "الجريدة الرسمية", total: SGG_SEARCHES.length },
            cassation: { name: "محكمة النقض", total: CASSATION_SEARCHES.length },
          },
          documentsInDB: count || 0,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({ error: "Use action: batch_search or status" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("auto-ingest error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
