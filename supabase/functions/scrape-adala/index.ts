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

/** Extract PDF links from a resource page's markdown/html */
function extractPdfLinks(markdown: string, baseUrl: string): string[] {
  const pdfLinks: string[] = [];
  // Match markdown links to PDFs: [text](url.pdf)
  const mdLinkRegex = /\[([^\]]*)\]\((https?:\/\/[^\s\)]+\.pdf[^\s\)]*)\)/gi;
  let match;
  while ((match = mdLinkRegex.exec(markdown)) !== null) {
    pdfLinks.push(match[2]);
  }
  // Match bare PDF URLs
  const bareUrlRegex = /(https?:\/\/[^\s"'<>]+\.pdf(?:\?[^\s"'<>]*)?)/gi;
  while ((match = bareUrlRegex.exec(markdown)) !== null) {
    if (!pdfLinks.includes(match[1])) pdfLinks.push(match[1]);
  }
  // Match relative PDF links like href="/path/to/file.pdf"
  const relRegex = /href=["']([^"']*\.pdf[^"']*?)["']/gi;
  while ((match = relRegex.exec(markdown)) !== null) {
    let url = match[1];
    if (url.startsWith('/')) {
      url = 'https://adala.justice.gov.ma' + url;
    }
    if (!pdfLinks.includes(url)) pdfLinks.push(url);
  }
  return pdfLinks;
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
    const { action } = body;

    // ─── CHECK EXISTING ────────────────────────────────────────────
    if (action === "check_existing") {
      const from = body.start_id ?? 1;
      const to = body.end_id ?? 1070;

      const { data: existing } = await supabase
        .from("legal_documents")
        .select("source")
        .like("source", "%adala.justice.gov.ma%");

      const existingSources = new Set<string>();
      if (existing) {
        for (const doc of existing) {
          if (doc.source) existingSources.add(doc.source);
        }
      }

      // Check which resource IDs have been visited (index page scraped)
      const existingIds = new Set<number>();
      for (const src of existingSources) {
        const m = src.match(/\/resources\/(\d+)$/);
        if (m) existingIds.add(parseInt(m[1]));
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
          newIds,
          existingDocCount: existingSources.size,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ─── SCRAPE BATCH (with PDF link extraction) ───────────────────
    if (action === "scrape_batch") {
      const ids: number[] = body.resource_ids || [];
      if (!ids.length) throw new Error("No resource_ids provided");

      const size = Math.min(ids.length, body.batch_size || 5);
      const batchIds = ids.slice(0, size);
      const results: any[] = [];

      for (const resourceId of batchIds) {
        const pageUrl = `${ADALA_BASE}/${resourceId}`;
        try {
          console.log(`Scraping Adala resource page ${resourceId}...`);

          // Step 1: Scrape the resource index page to find PDF links (with retry)
          let pageResp: Response | null = null;
          let pageSuccess = false;
          for (let attempt = 0; attempt < 3; attempt++) {
            try {
              pageResp = await fetch(`${FIRECRAWL_API}/scrape`, {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${FIRECRAWL_API_KEY}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  url: pageUrl,
                  formats: ["markdown", "html"],
                  onlyMainContent: false,
                  waitFor: 15000,
                  timeout: 60000,
                }),
              });
              if (pageResp.ok) {
                pageSuccess = true;
                break;
              }
              const errText = await pageResp.text();
              console.error(`Firecrawl attempt ${attempt + 1} for page ${resourceId}: ${errText}`);
              if (attempt < 2) await new Promise(r => setTimeout(r, 2000));
            } catch (fetchErr) {
              console.error(`Fetch error attempt ${attempt + 1} for page ${resourceId}:`, fetchErr);
              if (attempt < 2) await new Promise(r => setTimeout(r, 2000));
            }
          }

          if (!pageSuccess || !pageResp) {
            results.push({ resourceId, url: pageUrl, success: false, error: "فشل بعد 3 محاولات" });
            continue;
          }

          const pageData = await pageResp.json();
          const pageMarkdown = pageData.data?.markdown || pageData.markdown || "";
          const pageHtml = pageData.data?.html || pageData.html || "";

          // Extract PDF links from the page
          const pdfLinks = extractPdfLinks(pageMarkdown + "\n" + pageHtml, pageUrl);

          if (pdfLinks.length === 0) {
            // No PDFs found - try to use the page content itself if it's legal
            if (pageMarkdown.length > 150 && isRelevantLegalContent(pageMarkdown)) {
              const ingested = await ingestContent(supabase, pageMarkdown, pageUrl, pageData);
              if (ingested > 0) {
                results.push({ resourceId, url: pageUrl, success: true, title: "محتوى مباشر من الصفحة", ingested, pdfCount: 0 });
              } else {
                results.push({ resourceId, url: pageUrl, success: false, error: "لم يتم العثور على PDFs ولا محتوى قانوني" });
              }
            } else {
              results.push({ resourceId, url: pageUrl, success: false, error: "لا توجد روابط PDF ولا محتوى قانوني" });
            }
            await new Promise(r => setTimeout(r, 500));
            continue;
          }

          console.log(`Found ${pdfLinks.length} PDF links on page ${resourceId}`);

          // Step 2: Scrape each PDF
          let totalPdfIngested = 0;
          const pdfResults: string[] = [];

          for (const pdfUrl of pdfLinks) {
            // Check if PDF already scraped
            const { data: existingPdf } = await supabase
              .from("legal_documents")
              .select("id")
              .eq("source", pdfUrl)
              .limit(1);
            if (existingPdf && existingPdf.length > 0) {
              pdfResults.push(`⏭️ ${pdfUrl.split('/').pop()} (موجود)`);
              continue;
            }

            try {
              const pdfResp = await fetch(`${FIRECRAWL_API}/scrape`, {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${FIRECRAWL_API_KEY}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  url: pdfUrl,
                  formats: ["markdown"],
                  waitFor: 5000,
                }),
              });

              if (!pdfResp.ok) {
                pdfResults.push(`❌ ${pdfUrl.split('/').pop()} (HTTP ${pdfResp.status})`);
                continue;
              }

              const pdfData = await pdfResp.json();
              const pdfMarkdown = pdfData.data?.markdown || pdfData.markdown || "";
              
              if (pdfMarkdown.length < 100) {
                pdfResults.push(`⚠️ ${pdfUrl.split('/').pop()} (محتوى قصير)`);
                continue;
              }

              if (!isRelevantLegalContent(pdfMarkdown)) {
                pdfResults.push(`⚠️ ${pdfUrl.split('/').pop()} (غير قانوني)`);
                continue;
              }

              const count = await ingestContent(supabase, pdfMarkdown, pdfUrl, pdfData);
              totalPdfIngested += count;
              if (count > 0) {
                pdfResults.push(`✅ ${pdfUrl.split('/').pop()} (${count} أجزاء)`);
              }

              // Rate limit between PDFs
              await new Promise(r => setTimeout(r, 600));
            } catch (pdfErr) {
              pdfResults.push(`❌ ${pdfUrl.split('/').pop()} (${String(pdfErr).slice(0, 50)})`);
            }
          }

          results.push({
            resourceId,
            url: pageUrl,
            success: totalPdfIngested > 0,
            pdfCount: pdfLinks.length,
            ingested: totalPdfIngested,
            pdfResults,
            title: `صفحة ${resourceId} - ${pdfLinks.length} PDF`,
          });

          // Rate limit between pages
          await new Promise(r => setTimeout(r, 500));
        } catch (err) {
          console.error(`Error scraping resource ${resourceId}:`, err);
          results.push({ resourceId, url: pageUrl, success: false, error: String(err) });
        }
      }

      const successCount = results.filter(r => r.success).length;
      const totalIngested = results.reduce((sum, r) => sum + (r.ingested || 0), 0);

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

    // ─── STATUS ────────────────────────────────────────────────────
    if (action === "status") {
      const { count } = await supabase
        .from("legal_documents")
        .select("*", { count: "exact", head: true })
        .like("source", "%adala.justice.gov.ma%");

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

/** Ingest content into legal_documents with proper metadata extraction */
async function ingestContent(
  supabase: any,
  markdown: string,
  sourceUrl: string,
  rawData: any,
): Promise<number> {
  let title = rawData?.data?.metadata?.title || rawData?.metadata?.title || "";
  const docType = detectDocType(markdown);
  const meta = extractMetadata(markdown);
  const category = detectCategory(markdown);

  // Build a good title
  if (!title || title.length < 5 || /^(home|index|page|resource|\[PDF\])/i.test(title)) {
    const headingMatch = markdown.match(/^#+\s*(.+)/m);
    if (headingMatch) title = headingMatch[1].trim().slice(0, 300);
    else {
      const firstLine = markdown.split('\n').find((l: string) => l.trim().length > 10);
      title = firstLine ? firstLine.trim().slice(0, 300) : "نص قانوني";
    }
  }
  // Clean [PDF] prefix
  title = title.replace(/^\[PDF\]\s*/i, '').trim();

  // Enrich title based on doc type
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
      source: sourceUrl,
      doc_type: docType,
      category,
      reference_number: meta.referenceNumber || meta.dahirNumber || meta.decreeNumber || null,
      decision_date: meta.publicationDate || null,
      embedding: JSON.stringify(generateHashEmbedding(chunk)),
      metadata: {
        scraped: true,
        scraped_at: new Date().toISOString(),
        source_site: "adala",
        is_pdf: sourceUrl.toLowerCase().endsWith('.pdf'),
        dahir_number: meta.dahirNumber || null,
        decree_number: meta.decreeNumber || null,
        subject: meta.subject || null,
      },
    });
    if (!error) ingested++;
    if (error?.code === '23505') break; // duplicate
  }

  return ingested;
}
