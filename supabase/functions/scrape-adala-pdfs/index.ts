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
  if (/(?:ظهير\s+شريف|الظهير\s+الشريف|ظــهــيــر)/.test(snippet)) return "dahir";
  if (/(?:قانون\s+تنظيمي|القانون\s+التنظيمي)/.test(snippet)) return "organic_law";
  if (/(?:مرسوم\s+رقم|المرسوم\s+رقم|مرسوم\s+بقانون|مرسوم\s+ملكي|مرسوم\s+ملکی)/.test(snippet)) return "decree";
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

  const decreeMatch = snippet.match(/مرسوم\s+(?:ملكي\s+)?رقم\s+([\d\.]+)/);
  if (decreeMatch) decreeNumber = decreeMatch[1];

  const gregMatch = snippet.match(/(\d{1,2})\s+(?:يناير|فبراير|مارس|أبريل|ماي|يونيو|يوليوز|غشت|شتنبر|أكتوبر|نونبر|دجنبر|أغسطس)\s+(\d{4})/);
  if (gregMatch) publicationDate = gregMatch[0];

  const subjectLine = snippet.split('\n').find(l => /(?:يتعلق|بشأن|المتعلق|في شأن|القاضي|بتنفيذ|بتغيير|بتتميم)/.test(l));
  if (subjectLine) subject = subjectLine.trim().slice(0, 300);

  return { referenceNumber, dahirNumber, decreeNumber, publicationDate, subject };
}

function extractTitleFromUrl(url: string): string {
  try {
    const urlPath = url.split('#')[0];
    const segments = urlPath.split('/');
    const filename = segments[segments.length - 1];
    const cleaned = decodeURIComponent(filename)
      .replace(/-\d{13}\.pdf$/i, '')
      .replace(/\.pdf$/i, '')
      .replace(/\s*\(\d+\)\s*$/, '')
      .trim();
    return cleaned || "نص قانوني";
  } catch {
    return "نص قانوني";
  }
}

/** Parse the links file and return array of {url, resourceId} */
function parseLinksFile(text: string): { url: string; resourceId: string }[] {
  const results: { url: string; resourceId: string }[] = [];
  for (const line of text.split('\n')) {
    const urlMatch = line.match(/الرابط:\s*(https?:\/\/[^\s]+)/);
    const resMatch = line.match(/Resource\s+(\d+)/);
    if (urlMatch) {
      results.push({
        url: urlMatch[1].trim(),
        resourceId: resMatch ? resMatch[1] : "unknown",
      });
    }
  }
  return results;
}

async function scrapePdf(
  pdfUrl: string,
  firecrawlKey: string,
  supabase: any,
): Promise<{ success: boolean; title: string; ingested: number; docType?: string; category?: string; error?: string }> {
  const cleanUrl = pdfUrl.split('#')[0];
  const titleFromUrl = extractTitleFromUrl(pdfUrl);

  // Properly encode Arabic characters and spaces in the URL
  const encodedUrl = encodeURI(decodeURI(cleanUrl)).replace(/%25/g, '%');

  try {
    let resp: Response | null = null;
    let ok = false;

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        resp = await fetch(`${FIRECRAWL_API}/scrape`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${firecrawlKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            url: encodedUrl,
            formats: ["markdown"],
            waitFor: 20000,
            timeout: 90000,
          }),
        });
        if (resp.ok) { ok = true; break; }
        const errText = await resp.text();
        console.error(`Firecrawl attempt ${attempt + 1}: ${errText.slice(0, 200)}`);
        if (attempt < 2) await new Promise(r => setTimeout(r, 3000 * (attempt + 1)));
      } catch (e) {
        console.error(`Fetch error attempt ${attempt + 1}:`, e);
        if (attempt < 2) await new Promise(r => setTimeout(r, 3000 * (attempt + 1)));
      }
    }

    if (!ok || !resp) return { success: false, title: titleFromUrl, ingested: 0, error: "فشل بعد محاولتين" };

    const data = await resp.json();
    const markdown = data.data?.markdown || data.markdown || "";

    if (markdown.length < 100) return { success: false, title: titleFromUrl, ingested: 0, error: "محتوى قصير" };

    const docType = detectDocType(markdown);
    const meta = extractMetadata(markdown);
    const category = detectCategory(markdown);

    let title = titleFromUrl;
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
        source: pdfUrl,
        doc_type: docType,
        category,
        reference_number: meta.referenceNumber || meta.dahirNumber || meta.decreeNumber || null,
        decision_date: meta.publicationDate || null,
        embedding: JSON.stringify(generateHashEmbedding(chunk)),
        metadata: {
          scraped: true,
          scraped_at: new Date().toISOString(),
          source_site: "adala",
          is_pdf: true,
          dahir_number: meta.dahirNumber || null,
          decree_number: meta.decreeNumber || null,
          subject: meta.subject || null,
        },
      });
      if (!error) ingested++;
      if (error?.code === '23505') break;
    }

    return { success: ingested > 0, title: title.slice(0, 100), ingested, docType, category };
  } catch (err) {
    return { success: false, title: titleFromUrl, ingested: 0, error: String(err).slice(0, 100) };
  }
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
    const { action } = body;

    // ─── AUTO PROCESS: Runs from cron, no user interaction needed ───
    if (action === "auto_process") {
      const BATCH_SIZE = 2;

      // 1. Load links file from storage
      const { data: fileData, error: fileError } = await supabase.storage
        .from("scraping-data")
        .download("adala_pdf_links.txt");

      if (fileError || !fileData) {
        return new Response(
          JSON.stringify({ success: false, error: "لم يتم العثور على ملف الروابط: " + (fileError?.message || "") }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const fileText = await fileData.text();
      const allLinks = parseLinksFile(fileText);
      console.log(`Total links in file: ${allLinks.length}`);

      // 2. Get all existing sources from DB
      const existingSources = new Set<string>();
      let offset = 0;
      while (true) {
        const { data } = await supabase
          .from("legal_documents")
          .select("source")
          .like("source", "%adala.justice.gov.ma%")
          .range(offset, offset + 999);
        if (!data || data.length === 0) break;
        for (const d of data) {
          if (d.source) existingSources.add(d.source);
        }
        if (data.length < 1000) break;
        offset += 1000;
      }

      console.log(`Existing sources: ${existingSources.size}`);

      // 3. Find next batch of unprocessed URLs
      const pending: string[] = [];
      for (const link of allLinks) {
        if (!existingSources.has(link.url) && pending.length < BATCH_SIZE) {
          pending.push(link.url);
        }
        if (pending.length >= BATCH_SIZE) break;
      }

      if (pending.length === 0) {
        console.log("All PDFs have been processed!");
        return new Response(
          JSON.stringify({
            success: true,
            message: "تم الانتهاء من جميع الملفات",
            totalLinks: allLinks.length,
            totalProcessed: existingSources.size,
            remaining: 0,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      // 4. Process batch
      const results = [];
      for (const url of pending) {
        const result = await scrapePdf(url, FIRECRAWL_API_KEY, supabase);
        results.push({ url, ...result });
        console.log(`${result.success ? '✅' : '❌'} ${result.title.slice(0, 60)} (${result.ingested} chunks)`);
        await new Promise(r => setTimeout(r, 500));
      }

      const totalIngested = results.reduce((sum, r) => sum + (r.ingested || 0), 0);
      const remaining = allLinks.length - existingSources.size - results.filter(r => r.success).length;

      return new Response(
        JSON.stringify({
          success: true,
          processed: pending.length,
          successCount: results.filter(r => r.success).length,
          totalIngested,
          remaining: Math.max(0, remaining),
          totalLinks: allLinks.length,
          results,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ─── CHECK EXISTING ────────────────────────────────────────────
    if (action === "check_existing") {
      const pdfUrls: string[] = body.pdf_urls || [];

      if (pdfUrls.length === 0) {
        return new Response(
          JSON.stringify({ success: true, total: 0, existing: 0, newCount: 0, newUrls: [] }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const existingSet = new Set<string>();
      for (let i = 0; i < pdfUrls.length; i += 100) {
        const batch = pdfUrls.slice(i, i + 100);
        const { data } = await supabase
          .from("legal_documents")
          .select("source")
          .in("source", batch);
        if (data) {
          for (const d of data) {
            if (d.source) existingSet.add(d.source);
          }
        }
      }

      const newUrls = pdfUrls.filter(u => !existingSet.has(u));

      return new Response(
        JSON.stringify({ success: true, total: pdfUrls.length, existing: existingSet.size, newCount: newUrls.length, newUrls }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ─── SCRAPE BATCH (manual) ─────────────────────────────────────
    if (action === "scrape_batch") {
      const urls: string[] = body.pdf_urls || [];
      if (!urls.length) throw new Error("No pdf_urls provided");

      const size = Math.min(urls.length, body.batch_size || 3);
      const batchUrls = urls.slice(0, size);
      const results = [];

      for (const url of batchUrls) {
        const result = await scrapePdf(url, FIRECRAWL_API_KEY, supabase);
        results.push({ url, ...result });
        await new Promise(r => setTimeout(r, 400));
      }

      return new Response(
        JSON.stringify({
          success: true,
          results,
          processed: batchUrls.length,
          successCount: results.filter(r => r.success).length,
          totalIngested: results.reduce((sum, r) => sum + (r.ingested || 0), 0),
          remaining: urls.length - batchUrls.length,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ─── STATUS ────────────────────────────────────────────────────
    if (action === "status") {
      // Load file to get total count
      let totalLinks = 0;
      try {
        const { data: fileData } = await supabase.storage
          .from("scraping-data")
          .download("adala_pdf_links.txt");
        if (fileData) {
          const text = await fileData.text();
          totalLinks = parseLinksFile(text).length;
        }
      } catch { /* ignore */ }

      const { count } = await supabase
        .from("legal_documents")
        .select("*", { count: "exact", head: true })
        .like("source", "%adala.justice.gov.ma%");

      return new Response(
        JSON.stringify({ success: true, adalaDocuments: count || 0, totalLinks }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({ error: "Use action: auto_process, check_existing, scrape_batch, or status" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("scrape-adala-pdfs error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
