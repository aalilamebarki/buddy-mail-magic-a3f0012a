import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const FIRECRAWL_API = "https://api.firecrawl.dev/v1";

const SOURCES = [
  { url: "https://juriscassation.cspj.ma", name: "محكمة النقض", defaultType: "ruling" },
  { url: "https://www.sgg.gov.ma", name: "الجريدة الرسمية", defaultType: "law" },
  { url: "https://adala.justice.gov.ma", name: "بوابة عدالة", defaultType: "law" },
];

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

    const { source_index, phase } = await req.json();

    // Phase 1: Map a single source to discover URLs
    if (phase === "map") {
      const src = SOURCES[source_index ?? 0];
      if (!src) throw new Error("Invalid source_index");

      console.log(`[MAP] ${src.name}: ${src.url}`);
      
      const resp = await fetch(`${FIRECRAWL_API}/map`, {
        method: "POST",
        headers: { Authorization: `Bearer ${FIRECRAWL_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ url: src.url, limit: 300, includeSubdomains: false }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(`Firecrawl map error: ${JSON.stringify(data)}`);

      const links: string[] = data.links || [];
      console.log(`[MAP] ${src.name}: found ${links.length} URLs`);

      return new Response(
        JSON.stringify({ success: true, source: src.name, links, count: links.length }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Phase 2: Scrape a single URL and ingest
    if (phase === "ingest") {
      const { url, doc_type } = await req.json();
      if (!url) throw new Error("url required");

      console.log(`[INGEST] ${url}`);

      const resp = await fetch(`${FIRECRAWL_API}/scrape`, {
        method: "POST",
        headers: { Authorization: `Bearer ${FIRECRAWL_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ url, formats: ["markdown"], onlyMainContent: true, waitFor: 3000 }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(`Firecrawl scrape error: ${JSON.stringify(data)}`);

      const markdown = data.data?.markdown || data.markdown || "";
      const title = data.data?.metadata?.title || data.metadata?.title || "مستند قانوني";

      if (!markdown || markdown.length < 50) {
        return new Response(
          JSON.stringify({ success: false, error: "empty content" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const category = detectCategory(markdown);
      const finalDocType = doc_type || (url.includes("juriscassation") ? "ruling" : "law");
      const chunks = chunkText(markdown);
      let ingested = 0;

      for (const chunk of chunks) {
        const { error } = await supabase.from("legal_documents").insert({
          title: title.slice(0, 500),
          content: chunk,
          source: url,
          doc_type: finalDocType,
          category,
          embedding: JSON.stringify(generateHashEmbedding(chunk)),
          metadata: { scraped: true, scraped_at: new Date().toISOString() },
        });
        if (!error) ingested++;
        else console.error("Insert err:", error.message);
      }

      console.log(`[INGEST] Done: ${title} → ${ingested} chunks`);

      return new Response(
        JSON.stringify({ success: true, title, ingested, doc_type: finalDocType, category }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Phase 3: Bulk ingest - accepts array of URLs, processes sequentially
    if (phase === "bulk") {
      const { urls, doc_type } = await req.json();
      if (!urls || !Array.isArray(urls)) throw new Error("urls array required");

      const limit = Math.min(urls.length, 10); // Max 10 per call to avoid timeout
      const results: any[] = [];

      for (let i = 0; i < limit; i++) {
        try {
          const resp = await fetch(`${FIRECRAWL_API}/scrape`, {
            method: "POST",
            headers: { Authorization: `Bearer ${FIRECRAWL_API_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({ url: urls[i], formats: ["markdown"], onlyMainContent: true, waitFor: 2000 }),
          });

          if (!resp.ok) {
            results.push({ url: urls[i], success: false, error: `HTTP ${resp.status}` });
            continue;
          }

          const data = await resp.json();
          const markdown = data.data?.markdown || data.markdown || "";
          const title = data.data?.metadata?.title || data.metadata?.title || "مستند";

          if (!markdown || markdown.length < 50) {
            results.push({ url: urls[i], success: false, error: "empty" });
            continue;
          }

          const category = detectCategory(markdown);
          const finalDocType = doc_type || (urls[i].includes("juriscassation") ? "ruling" : "law");
          const chunks = chunkText(markdown);
          let ingested = 0;

          for (const chunk of chunks) {
            const { error } = await supabase.from("legal_documents").insert({
              title: title.slice(0, 500),
              content: chunk,
              source: urls[i],
              doc_type: finalDocType,
              category,
              embedding: JSON.stringify(generateHashEmbedding(chunk)),
              metadata: { scraped: true, scraped_at: new Date().toISOString() },
            });
            if (!error) ingested++;
          }

          results.push({ url: urls[i], success: true, title, ingested });
          console.log(`[BULK] ${i + 1}/${limit}: ${title} → ${ingested} chunks`);

          // Small delay
          await new Promise(r => setTimeout(r, 500));
        } catch (err) {
          results.push({ url: urls[i], success: false, error: String(err) });
        }
      }

      const total = results.filter(r => r.success).reduce((s, r) => s + (r.ingested || 0), 0);
      return new Response(
        JSON.stringify({ success: true, results, totalIngested: total, remaining: urls.length - limit }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Use phase: map, ingest, or bulk" }),
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
