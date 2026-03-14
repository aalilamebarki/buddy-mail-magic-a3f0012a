import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const FIRECRAWL_API = "https://api.firecrawl.dev/v1";

async function firecrawlRequest(endpoint: string, body: any, apiKey: string) {
  const response = await fetch(`${FIRECRAWL_API}${endpoint}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(`Firecrawl error [${response.status}]: ${JSON.stringify(data)}`);
  }
  return data;
}

// Generate a simple hash-based embedding (same as legal-knowledge function)
function generateHashEmbedding(text: string): number[] {
  const embedding = new Array(768);
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  for (let i = 0; i < 768; i++) {
    hash = ((hash << 5) - hash) + i;
    hash |= 0;
    embedding[i] = (hash % 2000 - 1000) / 1000;
  }
  return embedding;
}

function chunkText(text: string, maxChunkSize = 1500): string[] {
  const paragraphs = text.split(/\n\n+/);
  const chunks: string[] = [];
  let current = "";
  for (const p of paragraphs) {
    if ((current + "\n\n" + p).length > maxChunkSize && current.length > 0) {
      chunks.push(current.trim());
      current = p;
    } else {
      current = current ? current + "\n\n" + p : p;
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks;
}

// Extract ruling metadata from text
function extractRulingMetadata(text: string, url: string) {
  let referenceNumber = "";
  let chamber = "";
  let decisionDate = "";

  // Try to extract reference number (e.g., "قرار عدد 1234" or "عدد 1234/2024")
  const refMatch = text.match(/(?:قرار\s+)?عدد\s*[:\s]*(\d+(?:\/\d+)?)/);
  if (refMatch) referenceNumber = refMatch[1];

  // Try to extract date
  const dateMatch = text.match(/(\d{4}[-/]\d{2}[-/]\d{2})/);
  if (dateMatch) decisionDate = dateMatch[1];

  // Try to extract chamber
  const chamberPatterns = [
    { regex: /الغرفة\s+المدنية/, value: "الغرفة المدنية" },
    { regex: /الغرفة\s+الجنائية/, value: "الغرفة الجنائية" },
    { regex: /الغرفة\s+التجارية/, value: "الغرفة التجارية" },
    { regex: /الغرفة\s+الاجتماعية/, value: "الغرفة الاجتماعية" },
    { regex: /الغرفة\s+الإدارية/, value: "الغرفة الإدارية" },
    { regex: /غرفة\s+الأحوال\s+الشخصية/, value: "غرفة الأحوال الشخصية والميراث" },
  ];
  for (const p of chamberPatterns) {
    if (p.regex.test(text)) {
      chamber = p.value;
      break;
    }
  }

  // Detect category from content
  let category = "أخرى";
  const categoryPatterns = [
    { regex: /(?:كراء|الكراء|المكتري|المكري|إفراغ)/, value: "قانون الكراء" },
    { regex: /(?:الطلاق|النفقة|الحضانة|الزواج|مدونة الأسرة|الأسرة)/, value: "مدونة الأسرة" },
    { regex: /(?:التحفيظ|العقار|الرسم العقاري|الحقوق العينية)/, value: "القانون العقاري" },
    { regex: /(?:الشغل|العمل|الأجير|المشغل|الفصل التعسفي)/, value: "قانون الشغل" },
    { regex: /(?:التجاري|الشركة|الكمبيالة|الإفلاس|التسوية القضائية)/, value: "القانون التجاري" },
    { regex: /(?:الجنائي|الجناية|الجنحة|المتهم|النيابة العامة)/, value: "القانون الجنائي" },
    { regex: /(?:الإداري|الدولة|الجماعة|نزع الملكية)/, value: "القانون الإداري" },
    { regex: /(?:المسؤولية|التعويض|الضرر|العقد|الالتزام)/, value: "القانون المدني" },
  ];
  for (const p of categoryPatterns) {
    if (p.regex.test(text)) {
      category = p.value;
      break;
    }
  }

  return { referenceNumber, chamber, decisionDate, category };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");
    if (!FIRECRAWL_API_KEY) {
      throw new Error("FIRECRAWL_API_KEY not configured");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { action, url, limit } = await req.json();

    // Action 1: Map the website to discover ruling URLs
    if (action === "map") {
      const targetUrl = url || "https://juriscassation.cspj.ma";
      console.log("Mapping:", targetUrl);

      const data = await firecrawlRequest("/map", {
        url: targetUrl,
        limit: limit || 500,
        includeSubdomains: false,
      }, FIRECRAWL_API_KEY);

      const links = data.links || [];
      console.log(`Found ${links.length} URLs`);

      return new Response(
        JSON.stringify({ success: true, links, count: links.length }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Action 2: Scrape a single ruling page and save it
    if (action === "scrape") {
      if (!url) throw new Error("URL is required");
      console.log("Scraping:", url);

      const data = await firecrawlRequest("/scrape", {
        url,
        formats: ["markdown"],
        onlyMainContent: true,
        waitFor: 3000,
      }, FIRECRAWL_API_KEY);

      const markdown = data.data?.markdown || data.markdown || "";
      const title = data.data?.metadata?.title || data.metadata?.title || "قرار محكمة النقض";

      if (!markdown || markdown.length < 100) {
        return new Response(
          JSON.stringify({ success: false, error: "المحتوى قصير جداً أو فارغ" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const meta = extractRulingMetadata(markdown, url);
      const chunks = chunkText(markdown);
      let ingested = 0;

      for (const chunk of chunks) {
        const embedding = generateHashEmbedding(chunk);
        const { error } = await supabase.from("legal_documents").insert({
          title: title.slice(0, 500),
          content: chunk,
          source: url,
          doc_type: "ruling",
          category: meta.category,
          reference_number: meta.referenceNumber || null,
          court_chamber: meta.chamber || null,
          decision_date: meta.decisionDate || null,
          embedding: JSON.stringify(embedding),
          metadata: { scraped: true, scraped_at: new Date().toISOString() },
        });
        if (error) {
          console.error("Insert error:", error);
        } else {
          ingested++;
        }
      }

      return new Response(
        JSON.stringify({ success: true, title, ingested, chunks: chunks.length, category: meta.category }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Action 3: Batch scrape multiple URLs
    if (action === "batch") {
      const urls: string[] = await req.json().then(b => b.urls) || [];
      if (!urls || urls.length === 0) throw new Error("URLs array is required");

      const batchLimit = Math.min(urls.length, 20); // Process max 20 at a time
      const results: any[] = [];

      for (let i = 0; i < batchLimit; i++) {
        try {
          console.log(`Scraping ${i + 1}/${batchLimit}: ${urls[i]}`);
          
          const data = await firecrawlRequest("/scrape", {
            url: urls[i],
            formats: ["markdown"],
            onlyMainContent: true,
            waitFor: 3000,
          }, FIRECRAWL_API_KEY);

          const markdown = data.data?.markdown || data.markdown || "";
          const title = data.data?.metadata?.title || data.metadata?.title || "قرار محكمة النقض";

          if (markdown && markdown.length >= 100) {
            const meta = extractRulingMetadata(markdown, urls[i]);
            const chunks = chunkText(markdown);
            let ingested = 0;

            for (const chunk of chunks) {
              const embedding = generateHashEmbedding(chunk);
              const { error } = await supabase.from("legal_documents").insert({
                title: title.slice(0, 500),
                content: chunk,
                source: urls[i],
                doc_type: "ruling",
                category: meta.category,
                reference_number: meta.referenceNumber || null,
                court_chamber: meta.chamber || null,
                decision_date: meta.decisionDate || null,
                embedding: JSON.stringify(embedding),
                metadata: { scraped: true, scraped_at: new Date().toISOString() },
              });
              if (!error) ingested++;
            }

            results.push({ url: urls[i], success: true, title, ingested });
          } else {
            results.push({ url: urls[i], success: false, error: "محتوى قصير" });
          }

          // Small delay between requests
          await new Promise(r => setTimeout(r, 1000));
        } catch (err) {
          results.push({ url: urls[i], success: false, error: String(err) });
        }
      }

      const totalIngested = results.filter(r => r.success).reduce((sum, r) => sum + (r.ingested || 0), 0);

      return new Response(
        JSON.stringify({ success: true, results, totalIngested, processed: results.length }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Invalid action. Use 'map', 'scrape', or 'batch'." }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("scrape-rulings error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
