import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function generateHashEmbedding(text: string): number[] {
  const embedding = new Array(768);
  let hash = 0;
  for (let i = 0; i < text.length; i++) { hash = ((hash << 5) - hash) + text.charCodeAt(i); hash |= 0; }
  for (let i = 0; i < 768; i++) { hash = ((hash << 5) - hash) + i; hash |= 0; embedding[i] = (hash % 2000 - 1000) / 1000; }
  return embedding;
}

function chunkText(text: string, max = 1500): string[] {
  const paragraphs = text.split(/\n\n+/);
  const chunks: string[] = [];
  let current = "";
  for (const p of paragraphs) {
    if ((current + "\n\n" + p).length > max && current) { chunks.push(current.trim()); current = p; }
    else { current = current ? current + "\n\n" + p : p; }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks;
}

function detectCategory(text: string): string {
  const p = [
    { r: /كراء|المكتري|إفراغ/, v: "قانون الكراء" },
    { r: /الطلاق|النفقة|الحضانة|الزواج|الأسرة/, v: "مدونة الأسرة" },
    { r: /التحفيظ|العقار|العقاري/, v: "القانون العقاري" },
    { r: /الشغل|العمل|الأجير|المشغل/, v: "قانون الشغل" },
    { r: /التجاري|الشركة|الكمبيالة|التجارة/, v: "القانون التجاري" },
    { r: /الجنائي|الجناية|الجنحة|العقوبات/, v: "القانون الجنائي" },
    { r: /الإداري|نزع الملكية/, v: "القانون الإداري" },
    { r: /المسؤولية|التعويض|الالتزام/, v: "القانون المدني" },
    { r: /المسطرة المدنية|الدعوى/, v: "المسطرة المدنية" },
    { r: /المسطرة الجنائية/, v: "المسطرة الجنائية" },
    { r: /الضريبة|المالية|الجمارك/, v: "القانون المالي والضريبي" },
    { r: /المحاماة|المحامي/, v: "مهنة المحاماة" },
    { r: /التوثيق|الموثق/, v: "مهنة التوثيق" },
    { r: /العدالة|العدول|خطة/, v: "خطة العدالة" },
    { r: /المفوض|القضائيين/, v: "المفوضون القضائيون" },
    { r: /التنظيم القضائي|المحاكم/, v: "التنظيم القضائي" },
    { r: /السلطة القضائية/, v: "السلطة القضائية" },
  ];
  for (const x of p) { if (x.r.test(text)) return x.v; }
  return "أخرى";
}

function detectDocType(text: string): string {
  if (/ظهير|ظــهــيــر/.test(text)) return "dahir";
  if (/قانون\s*تنظيمي/.test(text)) return "organic_law";
  if (/مرسوم/.test(text)) return "decree";
  if (/دورية|منشور/.test(text)) return "circular";
  if (/اتفاقية|معاهدة/.test(text)) return "convention";
  if (/قرار\s*(وزير|رقم|مشترك)/.test(text)) return "decision";
  if (/قانون\s*رقم|مدونة/.test(text)) return "law";
  return "law";
}

function extractTitleFromUrl(url: string): string {
  try {
    const urlPath = url.split('#')[0];
    const segments = urlPath.split('/');
    let filename = segments[segments.length - 1];
    try { filename = decodeURIComponent(filename); } catch { /* keep as is */ }
    const cleaned = filename.replace(/-\d{10,15}\.pdf$/i, '').replace(/\.pdf$/i, '').replace(/\s*\(\d+\)\s*$/, '').trim();
    return cleaned || "نص قانوني";
  } catch { return "نص قانوني"; }
}

function extractRefNumber(text: string): string {
  const m = text.match(/رقم\s+([\d\.]+[-–]?[\d\.]*)/);
  return m ? m[1] : "";
}

function parseLinksFile(text: string): string[] {
  const urls: string[] = [];
  for (const line of text.split('\n')) {
    const m = line.match(/الرابط:\s*(https?:\/\/[^\s]+)/);
    if (m) urls.push(m[1].trim());
  }
  return urls;
}

async function processPdf(pdfUrl: string, supabase: any): Promise<{ success: boolean; title: string; ingested: number; error?: string }> {
  const title = extractTitleFromUrl(pdfUrl);
  const docType = detectDocType(title);
  const category = detectCategory(title);
  const refNum = extractRefNumber(title);
  const cleanUrl = pdfUrl.split('#')[0];

  // Try to download and extract text
  let fullText = "";
  try {
    let encodedUrl: string;
    try { encodedUrl = encodeURI(decodeURI(cleanUrl)); } catch { encodedUrl = encodeURI(cleanUrl); }

    const resp = await fetch(encodedUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', 'Accept': '*/*' },
    });

    if (resp.ok) {
      const ct = resp.headers.get('content-type') || '';
      if (ct.includes('text/html') || ct.includes('text/plain')) {
        const html = await resp.text();
        fullText = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '').replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, '\n').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
      } else {
        // PDF binary - can't easily extract Arabic text without a library
        // We'll save the metadata and title
        console.log(`PDF binary (${(await resp.arrayBuffer()).byteLength} bytes) - saving metadata only`);
      }
    }
  } catch (e) {
    console.log(`Download error: ${String(e).slice(0, 80)}`);
  }

  // Build content: use extracted text or title + metadata
  const content = fullText.length > 100
    ? fullText
    : `${title}\n\nنوع الوثيقة: ${docType}\nالتصنيف: ${category}\n${refNum ? 'الرقم المرجعي: ' + refNum + '\n' : ''}مصدر: بوابة عدالة - وزارة العدل\nرابط: ${cleanUrl}`;

  const chunks = fullText.length > 100 ? chunkText(fullText) : [content];
  let ingested = 0;

  for (const chunk of chunks) {
    const { error } = await supabase.from("legal_documents").insert({
      title: title.slice(0, 500),
      content: chunk,
      source: pdfUrl,
      doc_type: docType,
      category,
      reference_number: refNum || null,
      metadata: {
        scraped: true, scraped_at: new Date().toISOString(),
        source_site: "adala", is_pdf: true,
        has_full_text: fullText.length > 100,
      },
    });
    if (error) {
      console.log(`Insert error: ${error.message} (code: ${error.code})`);
      if (error.code === '23505') break; // duplicate
      continue;
    }
    ingested++;
  }

  return { success: ingested > 0, title: title.slice(0, 80), ingested };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const body = await req.json();
    const { action } = body;

    if (action === "auto_process") {
      const BATCH = 10;
      const { data: fileData, error: fileError } = await supabase.storage.from("scraping-data").download("adala_pdf_links.txt");
      if (fileError || !fileData) {
        console.error("File error:", fileError?.message);
        return new Response(JSON.stringify({ success: false, error: fileError?.message }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const allUrls = parseLinksFile(await fileData.text());
      console.log(`Total URLs: ${allUrls.length}`);

      // Get existing
      const existing = new Set<string>();
      let off = 0;
      while (true) {
        const { data } = await supabase.from("legal_documents").select("source").like("source", "%adala.justice.gov.ma%").range(off, off + 999);
        if (!data || !data.length) break;
        for (const d of data) if (d.source) existing.add(d.source);
        if (data.length < 1000) break;
        off += 1000;
      }
      console.log(`Existing: ${existing.size}`);

      const pending = allUrls.filter(u => !existing.has(u)).slice(0, BATCH);
      if (!pending.length) {
        console.log("All done!");
        return new Response(JSON.stringify({ success: true, message: "done", remaining: 0, total: allUrls.length, processed: existing.size }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      console.log(`Processing ${pending.length} PDFs...`);
      let totalIngested = 0;
      for (const url of pending) {
        const r = await processPdf(url, supabase);
        console.log(`${r.success ? '✅' : '❌'} ${r.title.slice(0, 50)} (${r.ingested})`);
        totalIngested += r.ingested;
        await new Promise(res => setTimeout(res, 200));
      }

      return new Response(JSON.stringify({ success: true, processed: pending.length, totalIngested, remaining: allUrls.length - existing.size - pending.length }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "check_existing") {
      const urls: string[] = body.pdf_urls || [];
      const ex = new Set<string>();
      for (let i = 0; i < urls.length; i += 100) {
        const { data } = await supabase.from("legal_documents").select("source").in("source", urls.slice(i, i + 100));
        if (data) for (const d of data) if (d.source) ex.add(d.source);
      }
      return new Response(JSON.stringify({ success: true, total: urls.length, existing: ex.size, newCount: urls.length - ex.size, newUrls: urls.filter(u => !ex.has(u)) }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "scrape_batch") {
      const urls: string[] = (body.pdf_urls || []).slice(0, body.batch_size || 5);
      const results = [];
      for (const url of urls) { results.push(await processPdf(url, supabase)); await new Promise(r => setTimeout(r, 200)); }
      return new Response(JSON.stringify({ success: true, results, totalIngested: results.reduce((s, r) => s + r.ingested, 0) }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "status") {
      let total = 0;
      try { const { data: f } = await supabase.storage.from("scraping-data").download("adala_pdf_links.txt"); if (f) total = parseLinksFile(await f.text()).length; } catch {}
      const { count } = await supabase.from("legal_documents").select("*", { count: "exact", head: true }).like("source", "%adala.justice.gov.ma%");
      return new Response(JSON.stringify({ success: true, adalaDocuments: count || 0, totalLinks: total }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("Error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
