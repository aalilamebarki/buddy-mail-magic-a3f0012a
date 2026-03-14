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

// Search queries to find Moroccan legal content
const LEGAL_SEARCHES = [
  // Court of Cassation rulings
  "قرار محكمة النقض المغربية الكراء الإفراغ",
  "قرار محكمة النقض المغربية مدونة الأسرة الطلاق",
  "قرار محكمة النقض المغربية القانون الجنائي",
  "قرار محكمة النقض المغربية قانون الشغل الفصل التعسفي",
  "قرار محكمة النقض المغربية التحفيظ العقاري",
  "قرار محكمة النقض المغربية القانون التجاري",
  "قرار محكمة النقض المغربية المسؤولية المدنية التعويض",
  "قرار محكمة النقض المغربية القانون الإداري",
  "اجتهاد قضائي مغربي محكمة النقض",
  "قرار محكمة النقض المغربية النفقة الحضانة",
  // Laws and legal texts
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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");
    if (!FIRECRAWL_API_KEY) throw new Error("FIRECRAWL_API_KEY not configured");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json();
    const { action, search_index, custom_query } = body;

    // Action: search - search for legal content and ingest results
    if (action === "search") {
      const query = custom_query || LEGAL_SEARCHES[search_index ?? 0];
      if (!query) throw new Error("No query");

      console.log(`[SEARCH] "${query}"`);

      const resp = await fetch(`${FIRECRAWL_API}/search`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${FIRECRAWL_API_KEY}`,
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

      const data = await resp.json();
      if (!resp.ok) {
        console.error("Search error:", JSON.stringify(data));
        throw new Error(`Firecrawl search error: ${data.error || resp.status}`);
      }

      const results = data.data || [];
      console.log(`[SEARCH] Got ${results.length} results`);

      let totalIngested = 0;
      const ingested: any[] = [];

      for (const result of results) {
        const markdown = result.markdown || "";
        const title = result.title || result.metadata?.title || "مستند قانوني";
        const url = result.url || result.metadata?.sourceURL || "";

        if (!markdown || markdown.length < 100) continue;

        // Check if already ingested
        const { data: existing } = await supabase
          .from("legal_documents")
          .select("id")
          .eq("source", url)
          .limit(1);

        if (existing && existing.length > 0) {
          console.log(`[SKIP] Already exists: ${url}`);
          continue;
        }

        const category = detectCategory(markdown);
        const isRuling = /(?:قرار|حكم|اجتهاد|محكمة النقض)/.test(title + " " + markdown.slice(0, 500));
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
          totalIngested += chunkCount;
          ingested.push({ title, url, chunks: chunkCount, doc_type: docType, category });
          console.log(`[INGESTED] ${title} → ${chunkCount} chunks (${docType})`);
        }
      }

      return new Response(
        JSON.stringify({
          success: true,
          query,
          searchResults: results.length,
          ingested,
          totalIngested,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Action: batch_search - run multiple searches sequentially
    if (action === "batch_search") {
      const startIndex = body.start_index ?? 0;
      const count = Math.min(body.count ?? 3, 5); // Max 5 searches per call
      const allIngested: any[] = [];
      let totalChunks = 0;

      for (let i = startIndex; i < startIndex + count && i < LEGAL_SEARCHES.length; i++) {
        const query = LEGAL_SEARCHES[i];
        console.log(`[BATCH ${i + 1}/${startIndex + count}] "${query}"`);

        try {
          const resp = await fetch(`${FIRECRAWL_API}/search`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${FIRECRAWL_API_KEY}`,
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
            console.error(`Search ${i} failed:`, errText);
            continue;
          }

          const data = await resp.json();
          const results = data.data || [];

          for (const result of results) {
            const markdown = result.markdown || "";
            const title = result.title || "مستند قانوني";
            const url = result.url || "";

            if (!markdown || markdown.length < 100) continue;

            const { data: existing } = await supabase
              .from("legal_documents")
              .select("id")
              .eq("source", url)
              .limit(1);

            if (existing && existing.length > 0) continue;

            const category = detectCategory(markdown);
            const isRuling = /(?:قرار|حكم|اجتهاد|محكمة النقض)/.test(title + " " + markdown.slice(0, 500));
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
              totalChunks += chunkCount;
              allIngested.push({ title: title.slice(0, 100), doc_type: docType, chunks: chunkCount });
            }
          }

          // Delay between searches
          await new Promise(r => setTimeout(r, 1000));
        } catch (err) {
          console.error(`Search ${i} error:`, err);
        }
      }

      const remaining = LEGAL_SEARCHES.length - (startIndex + count);

      return new Response(
        JSON.stringify({
          success: true,
          processed: count,
          totalIngested: totalChunks,
          documentsAdded: allIngested.length,
          ingested: allIngested,
          remaining: Math.max(0, remaining),
          nextIndex: startIndex + count,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Action: status - get available searches info
    if (action === "status") {
      const { count } = await supabase
        .from("legal_documents")
        .select("*", { count: "exact", head: true });

      return new Response(
        JSON.stringify({
          totalSearches: LEGAL_SEARCHES.length,
          searches: LEGAL_SEARCHES,
          documentsInDB: count || 0,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Use action: search, batch_search, or status" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("auto-ingest error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
