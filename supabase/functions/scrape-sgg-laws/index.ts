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

function detectDocType(text: string): string {
  const snippet = text.slice(0, 2000);
  if (/(?:ظهير\s+شريف|الظهير\s+الشريف)/.test(snippet)) return "dahir";
  if (/(?:قانون\s+تنظيمي|القانون\s+التنظيمي)/.test(snippet)) return "organic_law";
  if (/(?:مرسوم\s+رقم|المرسوم\s+رقم|مرسوم\s+بقانون)/.test(snippet)) return "decree";
  if (/(?:دورية|منشور|مذكرة\s+توجيهية)/.test(snippet)) return "circular";
  if (/(?:اتفاقية|معاهدة|بروتوكول|مصادقة\s+على)/.test(snippet)) return "convention";
  if (/(?:قرار\s+(?:وزير|لوزير|للوزير|مشترك)|قرار\s+رقم)/.test(snippet)) return "decision";
  if (/(?:قانون\s+رقم|القانون\s+رقم|مدونة)/.test(snippet)) return "law";
  return "law";
}

function extractMetadata(text: string) {
  const snippet = text.slice(0, 3000);
  let referenceNumber = "";
  let dahirNumber = "";
  let decreeNumber = "";
  let publicationDate = "";
  let subject = "";

  const lawNumMatch = snippet.match(/قانون\s+(?:تنظيمي\s+)?رقم\s+(\d+[\.\-]\d+)/);
  if (lawNumMatch) referenceNumber = lawNumMatch[1];
  
  const dahirMatch = snippet.match(/ظهير\s+شريف\s+رقم\s+([\d\.]+)/);
  if (dahirMatch) dahirNumber = dahirMatch[1];
  
  const decreeMatch = snippet.match(/مرسوم\s+رقم\s+([\d\.]+)/);
  if (decreeMatch) decreeNumber = decreeMatch[1];

  const gregMatch = snippet.match(/(\d{1,2})\s+(?:يناير|فبراير|مارس|أبريل|ماي|يونيو|يوليوز|غشت|شتنبر|أكتوبر|نونبر|دجنبر|أغسطس)\s+(\d{4})/);
  if (gregMatch) publicationDate = gregMatch[0];
  
  const dateMatch = snippet.match(/(\d{4}[-/]\d{1,2}[-/]\d{1,2})/);
  if (dateMatch && !publicationDate) publicationDate = dateMatch[1];

  const subjectLine = snippet.split('\n').find(l => /(?:يتعلق|بشأن|المتعلق|في شأن|القاضي|بتنفيذ)/.test(l));
  if (subjectLine) subject = subjectLine.trim().slice(0, 300);

  return { referenceNumber, dahirNumber, decreeNumber, publicationDate, subject };
}

function isRelevantLegalContent(text: string): boolean {
  if (text.length < 200) return false;
  const legalKeywords = /(?:قانون|ظهير|مرسوم|مادة|فصل|باب|قرار|دورية|منشور|اتفاقية|الجريدة الرسمية|بتنفيذ|المملكة المغربية)/;
  return legalKeywords.test(text);
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
    const { action, base_url, urls_to_scrape } = body;

    if (action === "discover") {
      const targetUrl = base_url || "https://www.sgg.gov.ma";
      console.log("Mapping SGG archive:", targetUrl);

      const data = await firecrawlRequest("/map", {
        url: targetUrl,
        limit: 5000,
        includeSubdomains: false,
      }, FIRECRAWL_API_KEY);

      const allLinks: string[] = data.links || [];
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

      const { data: existingSources } = await supabase
        .from("legal_documents")
        .select("source")
        .not("source", "is", null);
      const existingUrls = new Set((existingSources || []).map((d: any) => d.source));
      const newLinks = lawLinks.filter((u: string) => !existingUrls.has(u));

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

    if (action === "scrape_batch") {
      const urls: string[] = urls_to_scrape || [];
      if (!urls.length) throw new Error("No URLs provided");

      const batchSize = Math.min(urls.length, 10);
      const results: any[] = [];

      for (let i = 0; i < batchSize; i++) {
        const url = urls[i];
        try {
          console.log(`Scraping ${i + 1}/${batchSize}: ${url}`);

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

          // Filter irrelevant content
          if (!isRelevantLegalContent(markdown)) {
            results.push({ url, success: false, error: "محتوى غير قانوني" });
            continue;
          }

          const docType = detectDocType(markdown);
          const meta = extractMetadata(markdown);
          const category = detectCategory(markdown);

          // Build structured title
          if (!title || title.length < 5 || /^(home|index|page)/i.test(title)) {
            const headingMatch = markdown.match(/^#+\s*(.+)/m);
            if (headingMatch) title = headingMatch[1].trim().slice(0, 300);
            else {
              const firstLine = markdown.split('\n').find((l: string) => l.trim().length > 10);
              title = firstLine ? firstLine.trim().slice(0, 300) : "نص قانوني";
            }
          }

          // Enrich title
          if (docType === "dahir" && meta.dahirNumber) {
            title = `ظهير شريف رقم ${meta.dahirNumber}` + (meta.subject ? ` ${meta.subject.slice(0, 150)}` : '');
          } else if (docType === "decree" && meta.decreeNumber) {
            title = `مرسوم رقم ${meta.decreeNumber}` + (meta.subject ? ` ${meta.subject.slice(0, 150)}` : '');
          } else if (docType === "law" && meta.referenceNumber) {
            title = `قانون رقم ${meta.referenceNumber}` + (meta.subject ? ` ${meta.subject.slice(0, 150)}` : '');
          }

          const chunks = chunkText(markdown);
          let ingested = 0;

          for (const chunk of chunks) {
            const embedding = generateHashEmbedding(chunk);
            const { error } = await supabase.from("legal_documents").insert({
              title: title.slice(0, 500),
              content: chunk,
              source: url,
              doc_type: docType,
              category,
              reference_number: meta.referenceNumber || meta.dahirNumber || meta.decreeNumber || null,
              decision_date: meta.publicationDate || null,
              embedding: JSON.stringify(embedding),
              metadata: {
                scraped: true,
                scraped_at: new Date().toISOString(),
                source_site: "sgg",
                dahir_number: meta.dahirNumber || null,
                decree_number: meta.decreeNumber || null,
                subject: meta.subject || null,
              },
            });
            if (!error) ingested++;
            if (error?.code === '23505') {
              results.push({ url, success: false, error: "موجود مسبقاً", skipped: true });
              break;
            }
          }

          if (ingested > 0) {
            results.push({ url, success: true, title: title.slice(0, 100), ingested, category, doc_type: docType });
          }

          await new Promise(r => setTimeout(r, 1000));
        } catch (err) {
          results.push({ url, success: false, error: String(err) });
        }
      }

      const successCount = results.filter(r => r.success).length;
      const totalIngested = results.filter(r => r.success).reduce((sum, r) => sum + (r.ingested || 0), 0);

      return new Response(
        JSON.stringify({ success: true, results, processed: batchSize, successCount, totalIngested, remaining: Math.max(0, urls.length - batchSize) }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (action === "status") {
      const docTypes = ['law', 'dahir', 'decree', 'circular', 'convention', 'organic_law', 'decision', 'ruling'];
      const counts: Record<string, number> = {};
      
      for (const dt of docTypes) {
        const { count } = await supabase.from("legal_documents").select("*", { count: "exact", head: true }).eq("doc_type", dt);
        counts[dt] = count || 0;
      }

      const { count: total } = await supabase.from("legal_documents").select("*", { count: "exact", head: true });

      return new Response(
        JSON.stringify({ success: true, totalDocuments: total || 0, byType: counts }),
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
