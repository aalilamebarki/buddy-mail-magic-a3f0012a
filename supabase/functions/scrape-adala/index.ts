import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const FIRECRAWL_API = "https://api.firecrawl.dev/v1";
const ADALA_BASE = "https://adala.justice.gov.ma/resources";

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
    { r: /(?:التجاري|الشركة|الكمبيالة|الإفلاس|مدونة التجارة)/, v: "القانون التجاري" },
    { r: /(?:الجنائي|الجناية|الجنحة|المتهم|النيابة العامة|العقوبات)/, v: "القانون الجنائي" },
    { r: /(?:الإداري|الدولة|الجماعة|نزع الملكية)/, v: "القانون الإداري" },
    { r: /(?:المسؤولية|التعويض|الضرر|العقد|الالتزام|الالتزامات والعقود)/, v: "القانون المدني" },
    { r: /(?:المسطرة المدنية|الدعوى|الاستئناف|التنفيذ)/, v: "المسطرة المدنية" },
    { r: /(?:المسطرة الجنائية|البحث|التحقيق|المحاكمة الجنائية)/, v: "المسطرة الجنائية" },
    { r: /(?:الضريبة|الضرائب|المالية|الجمارك)/, v: "القانون المالي والضريبي" },
    { r: /(?:المحاماة|المحامي|محام)/, v: "مهنة المحاماة" },
    { r: /(?:التوثيق|الموثق|موثق)/, v: "مهنة التوثيق" },
    { r: /(?:العدالة|العدول|عدل|خطة العدالة)/, v: "خطة العدالة" },
    { r: /(?:المفوض|المفوضين القضائيين|تبليغ|تنفيذ الأحكام)/, v: "المفوضون القضائيون" },
    { r: /(?:التنظيم القضائي|المحاكم|محكمة الاستئناف|المحكمة الابتدائية)/, v: "التنظيم القضائي" },
    { r: /(?:السلطة القضائية|المجلس الأعلى|استقلال)/, v: "السلطة القضائية" },
  ];
  for (const p of patterns) {
    if (p.r.test(text)) return p.v;
  }
  return "أخرى";
}

function detectDocType(text: string): string {
  const snippet = text.slice(0, 3000);
  if (/(?:ظهير\s+شريف|الظهير\s+الشريف)/.test(snippet)) return "dahir";
  if (/(?:قانون\s+تنظيمي|القانون\s+التنظيمي)/.test(snippet)) return "organic_law";
  if (/(?:مرسوم\s+رقم|المرسوم\s+رقم|مرسوم\s+بقانون)/.test(snippet)) return "decree";
  if (/(?:دورية|منشور|مذكرة\s+توجيهية)/.test(snippet)) return "circular";
  if (/(?:اتفاقية|معاهدة|بروتوكول|مصادقة\s+على)/.test(snippet)) return "convention";
  if (/(?:قرار\s+(?:وزير|لوزير|للوزير|مشترك)|قرار\s+رقم)/.test(snippet)) return "decision";
  if (/(?:قرار\s+محكمة|قرار\s+عدد|حكم\s+قضائي|اجتهاد)/.test(snippet)) return "ruling";
  if (/(?:قانون\s+رقم|القانون\s+رقم|مدونة)/.test(snippet)) return "law";
  return "law";
}

function extractMetadata(text: string) {
  const snippet = text.slice(0, 4000);
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

  const subjectLine = snippet.split('\n').find(l => /(?:يتعلق|بشأن|المتعلق|في شأن|القاضي|بتنفيذ|بتغيير|بتتميم)/.test(l));
  if (subjectLine) subject = subjectLine.trim().slice(0, 300);

  return { referenceNumber, dahirNumber, decreeNumber, publicationDate, subject };
}

function isRelevantLegalContent(text: string): boolean {
  if (text.length < 150) return false;
  const legalKeywords = /(?:قانون|ظهير|مرسوم|مادة|فصل|باب|قرار|دورية|منشور|اتفاقية|الجريدة الرسمية|بتنفيذ|المملكة المغربية|محكمة|حكم|عدل|توثيق|محاماة)/;
  return legalKeywords.test(text);
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
    const { action, start_id, end_id, batch_size } = body;

    // Check which resource IDs already exist in the DB
    if (action === "check_existing") {
      const from = start_id ?? 1;
      const to = end_id ?? 1070;

      // Get all adala sources already scraped
      const { data: existing } = await supabase
        .from("legal_documents")
        .select("source")
        .like("source", `${ADALA_BASE}/%`);

      const existingIds = new Set<number>();
      if (existing) {
        for (const doc of existing) {
          const match = doc.source?.match(/\/resources\/(\d+)/);
          if (match) existingIds.add(parseInt(match[1]));
        }
      }

      const newIds: number[] = [];
      for (let i = from; i <= to; i++) {
        if (!existingIds.has(i)) newIds.push(i);
      }

      return new Response(
        JSON.stringify({
          success: true,
          totalRange: to - from + 1,
          alreadyScraped: existingIds.size,
          newCount: newIds.length,
          newIds: newIds,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Scrape a batch of resource IDs
    if (action === "scrape_batch") {
      const ids: number[] = body.resource_ids || [];
      if (!ids.length) throw new Error("No resource_ids provided");

      const size = Math.min(ids.length, batch_size || 5);
      const batchIds = ids.slice(0, size);
      const results: any[] = [];

      for (const resourceId of batchIds) {
        const url = `${ADALA_BASE}/${resourceId}`;
        try {
          console.log(`Scraping Adala resource ${resourceId}...`);

          // Check duplicate
          const { data: existing } = await supabase
            .from("legal_documents")
            .select("id")
            .eq("source", url)
            .limit(1);
          if (existing && existing.length > 0) {
            results.push({ resourceId, url, success: false, error: "موجود مسبقاً", skipped: true });
            continue;
          }

          // Scrape with Firecrawl
          const resp = await fetch(`${FIRECRAWL_API}/scrape`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${FIRECRAWL_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              url,
              formats: ["markdown"],
              onlyMainContent: true,
              waitFor: 3000,
            }),
          });

          if (!resp.ok) {
            const errText = await resp.text();
            console.error(`Firecrawl error for ${resourceId}: ${errText}`);
            results.push({ resourceId, url, success: false, error: `HTTP ${resp.status}` });
            continue;
          }

          const data = await resp.json();
          const markdown = data.data?.markdown || data.markdown || "";
          let title = data.data?.metadata?.title || data.metadata?.title || "";

          if (!markdown || markdown.length < 80) {
            results.push({ resourceId, url, success: false, error: "محتوى فارغ أو قصير جداً" });
            continue;
          }

          if (!isRelevantLegalContent(markdown)) {
            results.push({ resourceId, url, success: false, error: "محتوى غير قانوني" });
            continue;
          }

          const docType = detectDocType(markdown);
          const meta = extractMetadata(markdown);
          const category = detectCategory(markdown);

          // Build a good title
          if (!title || title.length < 5 || /^(home|index|page|resource)/i.test(title)) {
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
          } else if (docType === "organic_law" && meta.referenceNumber) {
            title = `قانون تنظيمي رقم ${meta.referenceNumber}` + (meta.subject ? ` ${meta.subject.slice(0, 150)}` : '');
          }

          const chunks = chunkText(markdown);
          let ingested = 0;

          for (const chunk of chunks) {
            const { error } = await supabase.from("legal_documents").insert({
              title: title.slice(0, 500),
              content: chunk,
              source: url,
              doc_type: docType,
              category,
              reference_number: meta.referenceNumber || meta.dahirNumber || meta.decreeNumber || null,
              decision_date: meta.publicationDate || null,
              embedding: JSON.stringify(generateHashEmbedding(chunk)),
              metadata: {
                scraped: true,
                scraped_at: new Date().toISOString(),
                source_site: "adala",
                resource_id: resourceId,
                dahir_number: meta.dahirNumber || null,
                decree_number: meta.decreeNumber || null,
                subject: meta.subject || null,
              },
            });
            if (!error) ingested++;
            if (error?.code === '23505') break; // duplicate
          }

          if (ingested > 0) {
            results.push({ resourceId, url, success: true, title: title.slice(0, 120), ingested, category, doc_type: docType });
          } else {
            results.push({ resourceId, url, success: false, error: "فشل الحفظ" });
          }

          // Rate limit
          await new Promise(r => setTimeout(r, 800));
        } catch (err) {
          console.error(`Error scraping resource ${resourceId}:`, err);
          results.push({ resourceId, url, success: false, error: String(err) });
        }
      }

      const successCount = results.filter(r => r.success).length;
      const totalIngested = results.filter(r => r.success).reduce((sum, r) => sum + (r.ingested || 0), 0);

      return new Response(
        JSON.stringify({
          success: true,
          results,
          processed: batchIds.length,
          successCount,
          totalIngested,
          remaining: ids.length - batchIds.length,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Status
    if (action === "status") {
      const { count } = await supabase
        .from("legal_documents")
        .select("*", { count: "exact", head: true })
        .like("source", `${ADALA_BASE}/%`);

      return new Response(
        JSON.stringify({ success: true, adalaDocuments: count || 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({ error: "Use action: check_existing, scrape_batch, or status" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("scrape-adala error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
