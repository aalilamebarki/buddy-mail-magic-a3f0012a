import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * Fetch resource page HTML directly and extract PDF links + text
 */
async function scrapeResourcePage(pageId: number): Promise<{
  laws: { title: string; pdfUrl: string; context: string }[];
  html: string;
}> {
  const url = `https://adala.justice.gov.ma/resources/${pageId}`;
  console.log(`📄 Fetching: ${url}`);

  const resp = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "ar,fr;q=0.9,en;q=0.8",
    },
    signal: AbortSignal.timeout(30000),
  });

  if (!resp.ok) {
    throw new Error(`HTTP ${resp.status} for page ${pageId}`);
  }

  const html = await resp.text();
  console.log(`Page ${pageId}: ${html.length} chars HTML`);

  // Extract PDF links from HTML
  const pdfUrls = new Set<string>();
  const laws: { title: string; pdfUrl: string; context: string }[] = [];

  // Pattern 1: <a href="...pdf...">text</a>
  const linkRegex = /<a[^>]+href=["']([^"']*(?:\.pdf|\/api\/uploads\/)[^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match;
  while ((match = linkRegex.exec(html)) !== null) {
    let pdfUrl = match[1].split("#")[0].trim();
    if (!pdfUrl.startsWith("http")) {
      pdfUrl = `https://adala.justice.gov.ma${pdfUrl.startsWith("/") ? "" : "/"}${pdfUrl}`;
    }
    if (pdfUrls.has(pdfUrl)) continue;
    pdfUrls.add(pdfUrl);

    // Clean the link text as title
    const linkText = match[2].replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
    
    // Get surrounding text as context
    const pos = match.index;
    const contextBefore = html.substring(Math.max(0, pos - 500), pos)
      .replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(-200);
    
    laws.push({
      title: linkText || extractTitleFromUrl(pdfUrl),
      pdfUrl,
      context: contextBefore,
    });
  }

  // Pattern 2: href with uploads path (not .pdf extension)
  const uploadsRegex = /href=["'](https?:\/\/adala\.justice\.gov\.ma\/api\/uploads\/[^"'#]+)/gi;
  while ((match = uploadsRegex.exec(html)) !== null) {
    const pdfUrl = match[1].trim();
    if (pdfUrls.has(pdfUrl)) continue;
    pdfUrls.add(pdfUrl);
    laws.push({
      title: extractTitleFromUrl(pdfUrl),
      pdfUrl,
      context: "",
    });
  }

  return { laws, html: html.slice(0, 3000) };
}

function extractTitleFromUrl(url: string): string {
  try {
    const segments = url.split("/");
    let filename = segments[segments.length - 1];
    try { filename = decodeURIComponent(filename); } catch {}
    return filename
      .replace(/-\d{10,15}\.pdf$/i, "")
      .replace(/\.pdf$/i, "")
      .replace(/\s*\(\d+\)\s*$/, "")
      .replace(/[-_]/g, " ")
      .trim() || "نص قانوني";
  } catch { return "نص قانوني"; }
}

/**
 * Classify a legal document using AI
 */
async function classifyWithAI(title: string, context: string, lovableKey: string): Promise<Record<string, any>> {
  try {
    const textToAnalyze = (context.length > title.length ? context + "\n" + title : title).slice(0, 2000);

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${lovableKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [{
          role: "user",
          content: `أنت خبير في القانون المغربي. حلل النص التالي واستخرج المعلومات:

النص: ${textToAnalyze}

أجب بـ JSON فقط:
{
  "doc_type": "dahir|law|organic_law|decree|circular|decision|convention",
  "category": "التصنيف (مدونة الأسرة، القانون الجنائي، قانون الشغل، القانون التجاري، القانون العقاري، المسطرة المدنية، القانون الإداري، القانون المالي والضريبي، أخرى)",
  "reference_number": "رقم النص إن وجد أو null",
  "year_issued": null,
  "issuing_authority": "الجهة المصدرة إن وجدت أو null",
  "subject": "ملخص قصير للموضوع"
}`
        }],
        temperature: 0.1,
      }),
    });

    if (!resp.ok) return fallbackClassify(title);

    const ai = await resp.json();
    const content = ai.choices?.[0]?.message?.content || "";
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return fallbackClassify(title);
    return JSON.parse(jsonMatch[0]);
  } catch {
    return fallbackClassify(title);
  }
}

function fallbackClassify(title: string) {
  let doc_type = "law";
  if (/ظهير/.test(title)) doc_type = "dahir";
  else if (/قانون\s*تنظيمي/.test(title)) doc_type = "organic_law";
  else if (/مرسوم/.test(title)) doc_type = "decree";
  else if (/دورية|منشور/.test(title)) doc_type = "circular";
  else if (/قرار/.test(title)) doc_type = "decision";

  let category = "أخرى";
  const cats: [RegExp, string][] = [
    [/كراء/, "قانون الكراء"], [/الأسرة|الزواج|الطلاق/, "مدونة الأسرة"],
    [/العقار/, "القانون العقاري"], [/الشغل|العمل/, "قانون الشغل"],
    [/التجاري|الشركة/, "القانون التجاري"], [/الجنائي|العقوبات/, "القانون الجنائي"],
    [/الإداري/, "القانون الإداري"], [/المسطرة المدنية/, "المسطرة المدنية"],
  ];
  for (const [r, v] of cats) if (r.test(title)) { category = v; break; }

  const refMatch = title.match(/رقم\s+([\d\.]+[-–]?[\d\.]*)/);
  const yearMatch = title.match(/(20\d{2}|19\d{2})/);

  return {
    doc_type, category,
    reference_number: refMatch?.[1] || null,
    year_issued: yearMatch ? parseInt(yearMatch[1]) : null,
    issuing_authority: null, subject: null,
  };
}

async function downloadAndStorePdf(
  pdfUrl: string, docId: string, docType: string, supabase: any,
): Promise<{ success: boolean; size: number; path: string }> {
  try {
    let fetchUrl: string;
    try { fetchUrl = encodeURI(decodeURI(pdfUrl)); } catch { fetchUrl = encodeURI(pdfUrl); }

    const pdfResp = await fetch(fetchUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
      signal: AbortSignal.timeout(30000),
    });

    if (!pdfResp.ok) {
      console.log(`PDF download failed: ${pdfResp.status}`);
      return { success: false, size: 0, path: "" };
    }

    const pdfData = await pdfResp.arrayBuffer();
    if (pdfData.byteLength < 100) {
      console.log(`PDF too small: ${pdfData.byteLength} bytes`);
      return { success: false, size: 0, path: "" };
    }

    const filePath = `${docType}/${docId}.pdf`;

    const { error: uploadErr } = await supabase.storage
      .from("legal-pdfs")
      .upload(filePath, pdfData, { contentType: "application/pdf", upsert: true });

    if (uploadErr) {
      console.log(`Upload error: ${uploadErr.message}`);
      return { success: false, size: pdfData.byteLength, path: filePath };
    }

    return { success: true, size: pdfData.byteLength, path: filePath };
  } catch (e) {
    console.log(`PDF error: ${e}`);
    return { success: false, size: 0, path: "" };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const lovableKey = Deno.env.get("LOVABLE_API_KEY")!;

    const body = await req.json().catch(() => ({}));
    const { action = "scrape_page", page_id, batch_size = 1, start_page } = body;

    // ===== STATUS =====
    if (action === "status") {
      const { count: total } = await supabase
        .from("legal_documents")
        .select("*", { count: "exact", head: true })
        .not("resource_page_id", "is", null);

      const { count: withPdf } = await supabase
        .from("legal_documents")
        .select("*", { count: "exact", head: true })
        .not("local_pdf_path", "is", null)
        .neq("local_pdf_path", "fetch_failed")
        .neq("local_pdf_path", "upload_failed");

      const { data: maxP } = await supabase
        .from("legal_documents")
        .select("resource_page_id")
        .not("resource_page_id", "is", null)
        .order("resource_page_id", { ascending: false })
        .limit(1);

      return new Response(JSON.stringify({
        totalDocs: total || 0,
        withLocalPdf: withPdf || 0,
        lastPage: maxP?.[0]?.resource_page_id || 0,
        totalPages: 1070,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ===== SCRAPE SINGLE PAGE =====
    if (action === "scrape_page" && page_id) {
      // Check if already scraped
      const { data: existing } = await supabase
        .from("legal_documents")
        .select("id")
        .eq("resource_page_id", page_id)
        .limit(1);

      if (existing?.length) {
        return new Response(JSON.stringify({
          success: true, message: `Page ${page_id} already scraped`, skipped: true,
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const { laws, html } = await scrapeResourcePage(page_id);

      if (!laws.length) {
        return new Response(JSON.stringify({
          success: true, message: `No PDF links found on page ${page_id}`, count: 0,
          htmlPreview: html.slice(0, 500),
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      console.log(`Found ${laws.length} PDF links on page ${page_id}`);

      const results = [];
      for (const law of laws) {
        // Skip duplicates by pdf_url
        const { data: dup } = await supabase
          .from("legal_documents")
          .select("id")
          .eq("pdf_url", law.pdfUrl)
          .limit(1);
        if (dup?.length) {
          results.push({ title: law.title.slice(0, 80), status: "duplicate" });
          continue;
        }

        // Classify with AI
        const cls = await classifyWithAI(law.title, law.context, lovableKey);

        const content = [
          law.title,
          cls.subject ? `الموضوع: ${cls.subject}` : "",
          `التصنيف: ${cls.category || "أخرى"}`,
          `النوع: ${cls.doc_type || "law"}`,
          cls.reference_number ? `الرقم المرجعي: ${cls.reference_number}` : "",
          cls.issuing_authority ? `الجهة المصدرة: ${cls.issuing_authority}` : "",
          `المصدر: بوابة عدالة`,
        ].filter(Boolean).join("\n");

        // Insert into DB
        const { data: ins, error: err } = await supabase.from("legal_documents").insert({
          title: law.title.slice(0, 500),
          content,
          source: `https://adala.justice.gov.ma/resources/${page_id}`,
          pdf_url: law.pdfUrl,
          doc_type: cls.doc_type || "law",
          category: cls.category || "أخرى",
          reference_number: cls.reference_number || null,
          year_issued: cls.year_issued || null,
          issuing_authority: cls.issuing_authority || null,
          subject: cls.subject || null,
          resource_page_id: page_id,
          ai_classification: cls,
          metadata: {
            scraped: true,
            scraped_at: new Date().toISOString(),
            source_site: "adala",
            is_pdf: true,
          },
        }).select("id").single();

        if (err) {
          console.log(`Insert error: ${err.message}`);
          results.push({ title: law.title.slice(0, 80), status: `error: ${err.message.slice(0, 50)}` });
          continue;
        }

        // Download and store PDF
        const pdfResult = await downloadAndStorePdf(law.pdfUrl, ins!.id, cls.doc_type || "law", supabase);
        
        if (pdfResult.success) {
          await supabase.from("legal_documents").update({
            local_pdf_path: pdfResult.path,
            metadata: {
              scraped: true, scraped_at: new Date().toISOString(),
              source_site: "adala", is_pdf: true, has_local_pdf: true,
              file_size_bytes: pdfResult.size,
            },
          }).eq("id", ins!.id);
        }

        results.push({
          title: law.title.slice(0, 80),
          status: pdfResult.success ? "✅ saved" : "📝 metadata_only",
          doc_type: cls.doc_type,
          category: cls.category,
          pdf_size: pdfResult.size,
        });
      }

      return new Response(JSON.stringify({
        success: true, page_id, count: results.length, results,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({
      error: "Invalid action. Use: scrape_page or status",
      usage: { scrape_page: { action: "scrape_page", page_id: 1 }, status: { action: "status" } },
    }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (e) {
    console.error("Error:", e);
    return new Response(JSON.stringify({
      success: false, error: String(e).slice(0, 200),
    }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
