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
    { r: /(?:التحفيظ|العقار|الرسم العقاري)/, v: "القانون العقاري" },
    { r: /(?:الشغل|العمل|الأجير|المشغل)/, v: "قانون الشغل" },
    { r: /(?:التجاري|الشركة|الكمبيالة)/, v: "القانون التجاري" },
    { r: /(?:الجنائي|الجناية|الجنحة|المتهم)/, v: "القانون الجنائي" },
    { r: /(?:الإداري|الدولة|نزع الملكية)/, v: "القانون الإداري" },
    { r: /(?:المسؤولية|التعويض|الضرر|العقد)/, v: "القانون المدني" },
  ];
  for (const p of patterns) {
    if (p.r.test(text)) return p.v;
  }
  return "أخرى";
}

// Organized by source
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
  "site:sgg.gov.ma قانون حرية الأسعار والمنافسة",
  "site:sgg.gov.ma قانون الجنسية المغربية",
  "site:sgg.gov.ma قانون المالية",
  "site:sgg.gov.ma مدونة الضرائب",
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
  "site:juriscassation.cspj.ma قرار الشركات التجاري",
  "site:juriscassation.cspj.ma اجتهاد قضائي",
  "site:juriscassation.cspj.ma نقض حكم",
];

const GENERAL_SEARCHES = [
  "قرار محكمة النقض المغربية الكراء الإفراغ",
  "قرار محكمة النقض المغربية مدونة الأسرة الطلاق",
  "قرار محكمة النقض المغربية القانون الجنائي",
  "قرار محكمة النقض المغربية قانون الشغل الفصل التعسفي",
  "قرار محكمة النقض المغربية التحفيظ العقاري",
  "قانون الالتزامات والعقود المغربي ظهير 1913",
  "مدونة الأسرة المغربية قانون 70.03",
  "مدونة الشغل المغربية قانون 65.99",
  "قانون المسطرة المدنية المغربي",
  "قانون المسطرة الجنائية المغربي",
  "القانون الجنائي المغربي",
  "قانون الكراء السكني المغربي 67.12",
  "قانون الكراء التجاري المغربي 49.16",
  "مدونة التجارة المغربية",
  "قانون التحفيظ العقاري المغربي",
];

const ALL_SOURCES: Record<string, string[]> = {
  sgg: SGG_SEARCHES,
  cassation: CASSATION_SEARCHES,
  general: GENERAL_SEARCHES,
};

async function searchAndIngest(
  query: string,
  apiKey: string,
  supabase: any,
): Promise<{ ingested: number; docs: any[] }> {
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
    const errText = await resp.text();
    console.error(`Search failed for "${query}":`, errText);
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

    // Extract a meaningful title from content if the page title is generic
    if (!title || title.length < 5 || /^(home|index|page|untitled)/i.test(title)) {
      // Try first heading in markdown
      const headingMatch = markdown.match(/^#+\s*(.+)/m);
      if (headingMatch) {
        title = headingMatch[1].trim().slice(0, 200);
      } else {
        // Use first meaningful line
        const firstLine = markdown.split('\n').find(l => l.trim().length > 10);
        title = firstLine ? firstLine.trim().slice(0, 200) : "مستند قانوني";
      }
    }

    // For cassation rulings, try to build a descriptive title
    if (isCassation || /(?:قرار|حكم|محكمة النقض)/.test(title)) {
      const refMatch = markdown.match(/(?:قرار\s+)?عدد\s*[:\s]*(\d+(?:\/\d+)?)/);
      const dateMatch = markdown.match(/(\d{4}[-/]\d{2}[-/]\d{2})/);
      const chamberMatch = markdown.match(/(الغرفة\s+(?:المدنية|الجنائية|التجارية|الاجتماعية|الإدارية)|غرفة\s+الأحوال)/);
      if (refMatch || chamberMatch) {
        const parts = ['قرار محكمة النقض'];
        if (refMatch) parts.push(`عدد ${refMatch[1]}`);
        if (chamberMatch) parts.push(`- ${chamberMatch[1]}`);
        if (dateMatch) parts.push(`بتاريخ ${dateMatch[1]}`);
        title = parts.join(' ');
      }
    }

    const isCassation = url.includes("juriscassation") || url.includes("cspj");

    if (!markdown || markdown.length < 100) continue;

    // Check duplicate
    const { data: existing } = await supabase
      .from("legal_documents")
      .select("id")
      .eq("source", url)
      .limit(1);

    if (existing && existing.length > 0) continue;

    const category = detectCategory(markdown);
    const isCassation = url.includes("juriscassation") || url.includes("cspj");
    const isRuling = isCassation || /(?:قرار|حكم|اجتهاد|محكمة النقض)/.test(title + " " + markdown.slice(0, 500));
    const docType = isRuling ? "ruling" : "law";
    const chunks = chunkText(markdown);

    let chunkCount = 0;
    for (const chunk of chunks) {
      const { error } = await supabase.from("legal_documents").insert({
        title: title.slice(0, 500),
        content: chunk,
        source: url,
        doc_type: docType,
        category,
        embedding: JSON.stringify(generateHashEmbedding(chunk)),
        metadata: { scraped: true, query, scraped_at: new Date().toISOString() },
      });
      if (!error) chunkCount++;
    }

    if (chunkCount > 0) {
      ingested += chunkCount;
      docs.push({ title: title.slice(0, 100), url, doc_type: docType, chunks: chunkCount });
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
    const { action, source, search_index, custom_query, start_index, count: reqCount } = body;

    // Action: search - single query
    if (action === "search") {
      const sourceList = ALL_SOURCES[source] || GENERAL_SEARCHES;
      const query = custom_query || sourceList[search_index ?? 0];
      if (!query) throw new Error("No query");

      console.log(`[SEARCH] "${query}"`);
      const result = await searchAndIngest(query, FIRECRAWL_API_KEY, supabase);

      return new Response(
        JSON.stringify({ success: true, query, ...result }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Action: batch_search - multiple queries from a source
    if (action === "batch_search") {
      const sourceList = ALL_SOURCES[source] || GENERAL_SEARCHES;
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
          source: source || "general",
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

    // Action: status
    if (action === "status") {
      const { count } = await supabase
        .from("legal_documents")
        .select("*", { count: "exact", head: true });

      return new Response(
        JSON.stringify({
          sources: {
            sgg: { name: "الجريدة الرسمية", total: SGG_SEARCHES.length },
            cassation: { name: "محكمة النقض", total: CASSATION_SEARCHES.length },
            general: { name: "بحث عام", total: GENERAL_SEARCHES.length },
          },
          documentsInDB: count || 0,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({ error: "Use action: search, batch_search, or status" }),
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
