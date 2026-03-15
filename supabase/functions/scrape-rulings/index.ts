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

function extractRulingMetadata(text: string) {
  const snippet = text.slice(0, 3000);
  let referenceNumber = "";
  let chamber = "";
  let decisionDate = "";
  let fileNumber = "";
  let subject = "";

  const refMatch = snippet.match(/(?:قرار\s+)?عدد\s*[:\s]*(\d+(?:\/\d+)?)/);
  if (refMatch) referenceNumber = refMatch[1];

  const fileMatch = snippet.match(/ملف\s+(?:\w+\s+)?عدد\s*[:\s]*([\d\/]+)/);
  if (fileMatch) fileNumber = fileMatch[1];

  const dateMatch = snippet.match(/(\d{4}[-/]\d{1,2}[-/]\d{1,2})/);
  if (dateMatch) decisionDate = dateMatch[1];
  
  const gregMatch = snippet.match(/(\d{1,2})\s+(?:يناير|فبراير|مارس|أبريل|ماي|يونيو|يوليوز|غشت|شتنبر|أكتوبر|نونبر|دجنبر|أغسطس)\s+(\d{4})/);
  if (gregMatch && !decisionDate) decisionDate = gregMatch[0];

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

  // Detect category
  let category = "أخرى";
  const categoryPatterns = [
    { regex: /(?:كراء|الكراء|المكتري|إفراغ)/, value: "قانون الكراء" },
    { regex: /(?:الطلاق|النفقة|الحضانة|الزواج|مدونة الأسرة)/, value: "مدونة الأسرة" },
    { regex: /(?:التحفيظ|العقار|الرسم العقاري)/, value: "القانون العقاري" },
    { regex: /(?:الشغل|العمل|الأجير|المشغل|الفصل التعسفي)/, value: "قانون الشغل" },
    { regex: /(?:التجاري|الشركة|الكمبيالة|الإفلاس)/, value: "القانون التجاري" },
    { regex: /(?:الجنائي|الجناية|الجنحة|المتهم)/, value: "القانون الجنائي" },
    { regex: /(?:الإداري|الدولة|نزع الملكية)/, value: "القانون الإداري" },
    { regex: /(?:المسؤولية|التعويض|الضرر|العقد)/, value: "القانون المدني" },
  ];
  for (const p of categoryPatterns) {
    if (p.regex.test(snippet)) { category = p.value; break; }
  }

  // Extract subject
  const subjectLine = snippet.split('\n').find(l => /(?:يتعلق|بشأن|المتعلق|في شأن|القاضي|حول|في قضية)/.test(l));
  if (subjectLine) subject = subjectLine.trim().slice(0, 300);

  return { referenceNumber, chamber, decisionDate, fileNumber, category, subject };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");
    if (!FIRECRAWL_API_KEY) throw new Error("FIRECRAWL_API_KEY not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json();
    const { action, url, limit, urls } = body;

    if (action === "map") {
      const targetUrl = url || "https://juriscassation.cspj.ma";
      const data = await firecrawlRequest("/map", {
        url: targetUrl,
        limit: limit || 500,
        includeSubdomains: false,
      }, FIRECRAWL_API_KEY);

      return new Response(
        JSON.stringify({ success: true, links: data.links || [], count: (data.links || []).length }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "scrape") {
      if (!url) throw new Error("URL is required");

      // Check duplicate
      const { data: existing } = await supabase
        .from("legal_documents")
        .select("id")
        .eq("source", url)
        .limit(1);
      if (existing && existing.length > 0) {
        return new Response(
          JSON.stringify({ success: false, error: "موجود مسبقاً", skipped: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

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

      const meta = extractRulingMetadata(markdown);
      
      // Build structured title
      let structuredTitle = title;
      if (meta.referenceNumber) {
        const parts = ['قرار محكمة النقض عدد ' + meta.referenceNumber];
        if (meta.chamber) parts.push('- ' + meta.chamber);
        if (meta.decisionDate) parts.push('بتاريخ ' + meta.decisionDate);
        structuredTitle = parts.join(' ');
      }

      const chunks = chunkText(markdown);
      let ingested = 0;

      for (const chunk of chunks) {
        const embedding = generateHashEmbedding(chunk);
        const { error } = await supabase.from("legal_documents").insert({
          title: structuredTitle.slice(0, 500),
          content: chunk,
          source: url,
          doc_type: "ruling",
          category: meta.category,
          reference_number: meta.referenceNumber || null,
          court_chamber: meta.chamber || null,
          decision_date: meta.decisionDate || null,
          embedding: JSON.stringify(embedding),
          metadata: {
            scraped: true,
            scraped_at: new Date().toISOString(),
            file_number: meta.fileNumber || null,
            subject: meta.subject || null,
          },
        });
        if (!error) ingested++;
      }

      return new Response(
        JSON.stringify({ success: true, title: structuredTitle, ingested, chunks: chunks.length, category: meta.category }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "batch") {
      const batchUrls: string[] = urls || [];
      if (!batchUrls.length) throw new Error("URLs array is required");

      const batchLimit = Math.min(batchUrls.length, 20);
      const results: any[] = [];

      for (let i = 0; i < batchLimit; i++) {
        try {
          // Check duplicate
          const { data: existing } = await supabase
            .from("legal_documents")
            .select("id")
            .eq("source", batchUrls[i])
            .limit(1);
          if (existing && existing.length > 0) {
            results.push({ url: batchUrls[i], success: false, error: "موجود مسبقاً", skipped: true });
            continue;
          }

          const data = await firecrawlRequest("/scrape", {
            url: batchUrls[i],
            formats: ["markdown"],
            onlyMainContent: true,
            waitFor: 3000,
          }, FIRECRAWL_API_KEY);

          const markdown = data.data?.markdown || data.markdown || "";
          const pageTitle = data.data?.metadata?.title || data.metadata?.title || "قرار محكمة النقض";

          if (markdown && markdown.length >= 100) {
            const meta = extractRulingMetadata(markdown);
            
            let structuredTitle = pageTitle;
            if (meta.referenceNumber) {
              const parts = ['قرار محكمة النقض عدد ' + meta.referenceNumber];
              if (meta.chamber) parts.push('- ' + meta.chamber);
              if (meta.decisionDate) parts.push('بتاريخ ' + meta.decisionDate);
              structuredTitle = parts.join(' ');
            }

            const chunks = chunkText(markdown);
            let ingested = 0;

            for (const chunk of chunks) {
              const embedding = generateHashEmbedding(chunk);
              const { error } = await supabase.from("legal_documents").insert({
                title: structuredTitle.slice(0, 500),
                content: chunk,
                source: batchUrls[i],
                doc_type: "ruling",
                category: meta.category,
                reference_number: meta.referenceNumber || null,
                court_chamber: meta.chamber || null,
                decision_date: meta.decisionDate || null,
                embedding: JSON.stringify(embedding),
                metadata: {
                  scraped: true,
                  scraped_at: new Date().toISOString(),
                  file_number: meta.fileNumber || null,
                  subject: meta.subject || null,
                },
              });
              if (!error) ingested++;
            }

            results.push({ url: batchUrls[i], success: true, title: structuredTitle, ingested, category: meta.category });
          } else {
            results.push({ url: batchUrls[i], success: false, error: "محتوى قصير" });
          }

          await new Promise(r => setTimeout(r, 1000));
        } catch (err) {
          results.push({ url: batchUrls[i], success: false, error: String(err) });
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
