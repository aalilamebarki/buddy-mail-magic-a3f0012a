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
    { r: /(?:الطلاق|النفقة|الحضانة|الزواج|مدونة الأسرة|الأسرة)/, v: "مدونة الأسرة" },
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
    const { action, page, base_url, urls_to_scrape } = body;

    // ===== Action 1: Discover all law URLs from the SGG archive =====
    if (action === "discover") {
      const targetUrl = base_url || "https://www.sgg.gov.ma";
      console.log("Mapping SGG archive:", targetUrl);

      const data = await firecrawlRequest("/map", {
        url: targetUrl,
        limit: 5000,
        includeSubdomains: false,
      }, FIRECRAWL_API_KEY);

      const allLinks: string[] = data.links || [];
      
      // Filter for relevant law pages (PDFs, legislation pages)
      const lawLinks = allLinks.filter((u: string) => {
        const lower = u.toLowerCase();
        return (
          lower.includes('/bo/') ||
          lower.includes('bulletinofficiel') ||
          lower.includes('texteslegislatifs') ||
          lower.includes('legislation') ||
          lower.includes('/portals/') ||
          lower.endsWith('.pdf') ||
          lower.includes('avantprojet') ||
          lower.includes('reference/adala')
        );
      });

      // Check which URLs are already scraped
      const { data: existingSources } = await supabase
        .from("legal_documents")
        .select("source")
        .not("source", "is", null);

      const existingUrls = new Set((existingSources || []).map((d: any) => d.source));
      const newLinks = lawLinks.filter((u: string) => !existingUrls.has(u));

      console.log(`Found ${allLinks.length} total, ${lawLinks.length} law-related, ${newLinks.length} new`);

      return new Response(
        JSON.stringify({
          success: true,
          totalFound: allLinks.length,
          lawLinks: lawLinks.length,
          newLinks: newLinks.length,
          alreadyScraped: lawLinks.length - newLinks.length,
          urls: newLinks,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ===== Action 2: Scrape a batch of specific URLs =====
    if (action === "scrape_batch") {
      const urls: string[] = urls_to_scrape || [];
      if (!urls || urls.length === 0) throw new Error("No URLs provided");

      const batchSize = Math.min(urls.length, 10);
      const results: any[] = [];

      for (let i = 0; i < batchSize; i++) {
        const url = urls[i];
        try {
          console.log(`Scraping ${i + 1}/${batchSize}: ${url}`);

          // Check if already exists (double-check)
          const { data: existing } = await supabase
            .from("legal_documents")
            .select("id")
            .eq("source", url)
            .limit(1);

          if (existing && existing.length > 0) {
            results.push({ url, success: false, error: "موجود مسبقاً", skipped: true });
            continue;
          }

          const data = await firecrawlRequest("/scrape", {
            url,
            formats: ["markdown"],
            onlyMainContent: true,
            waitFor: 3000,
          }, FIRECRAWL_API_KEY);

          const markdown = data.data?.markdown || data.markdown || "";
          let title = data.data?.metadata?.title || data.metadata?.title || "";

          if (!markdown || markdown.length < 100) {
            results.push({ url, success: false, error: "محتوى قصير أو فارغ" });
            continue;
          }

          // Build a meaningful title
          if (!title || title.length < 5 || /^(home|index|page)/i.test(title)) {
            const headingMatch = markdown.match(/^#+\s*(.+)/m);
            if (headingMatch) {
              title = headingMatch[1].trim().slice(0, 300);
            } else {
              const firstLine = markdown.split('\n').find((l: string) => l.trim().length > 10);
              title = firstLine ? firstLine.trim().slice(0, 300) : "نص قانوني";
            }
          }

          // Extract law-specific metadata
          const lawNumMatch = markdown.match(/(?:قانون|ظهير|مرسوم)\s+(?:رقم\s+)?(\d+[\.\-]\d+)/);
          const referenceNumber = lawNumMatch ? lawNumMatch[1] : null;
          
          const category = detectCategory(markdown);
          const chunks = chunkText(markdown);
          let ingested = 0;

          for (const chunk of chunks) {
            const embedding = generateHashEmbedding(chunk);
            const { error } = await supabase.from("legal_documents").insert({
              title: title.slice(0, 500),
              content: chunk,
              source: url,
              doc_type: "law",
              category,
              reference_number: referenceNumber,
              embedding: JSON.stringify(embedding),
              metadata: { scraped: true, scraped_at: new Date().toISOString(), source_site: "sgg" },
            });
            if (!error) ingested++;
            // If duplicate index error, skip remaining chunks for this URL
            if (error?.code === '23505') {
              results.push({ url, success: false, error: "موجود مسبقاً", skipped: true });
              break;
            }
          }

          if (ingested > 0) {
            results.push({ url, success: true, title: title.slice(0, 100), ingested, category });
          }

          // Delay between requests
          await new Promise(r => setTimeout(r, 1000));
        } catch (err) {
          results.push({ url, success: false, error: String(err) });
        }
      }

      const successCount = results.filter(r => r.success).length;
      const skippedCount = results.filter(r => r.skipped).length;
      const totalIngested = results.filter(r => r.success).reduce((sum, r) => sum + (r.ingested || 0), 0);

      return new Response(
        JSON.stringify({
          success: true,
          results,
          processed: batchSize,
          successCount,
          skippedCount,
          totalIngested,
          remaining: Math.max(0, urls.length - batchSize),
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ===== Action 3: Get scraping status =====
    if (action === "status") {
      const [totalRes, sggRes] = await Promise.all([
        supabase.from("legal_documents").select("*", { count: "exact", head: true }),
        supabase.from("legal_documents").select("*", { count: "exact", head: true }).eq("doc_type", "law"),
      ]);

      // Count unique sources from SGG
      const { data: sggSources } = await supabase
        .from("legal_documents")
        .select("source")
        .ilike("source", "%sgg.gov.ma%");

      const uniqueSggUrls = new Set((sggSources || []).map(d => d.source).filter(Boolean));

      return new Response(
        JSON.stringify({
          success: true,
          totalDocuments: totalRes.count || 0,
          totalLaws: sggRes.count || 0,
          sggUrlsScraped: uniqueSggUrls.size,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({ error: "Use action: discover, scrape_batch, or status" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("scrape-sgg-laws error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
