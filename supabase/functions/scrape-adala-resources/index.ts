import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * Use Firecrawl to scrape a resource page and extract PDF links + text context
 */
async function scrapeWithFirecrawl(pageId: number, firecrawlKey: string): Promise<{
  laws: { title: string; pdfUrl: string; context: string }[];
  rawMarkdown: string;
}> {
  const url = `https://adala.justice.gov.ma/resources/${pageId}`;
  console.log(`🔥 Firecrawl scraping: ${url}`);

  const resp = await fetch("https://api.firecrawl.dev/v1/scrape", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${firecrawlKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      url,
      formats: ["markdown", "links", "html"],
      waitFor: 15000,
      timeout: 60000,
    }),
  });

  if (!resp.ok) {
    const errText = await resp.text();
    console.error(`Firecrawl error: ${resp.status} - ${errText.slice(0, 200)}`);
    throw new Error(`Firecrawl ${resp.status}`);
  }

  const data = await resp.json();
  const markdown = data.data?.markdown || data.markdown || "";
  const html = data.data?.html || data.html || "";
  const links: string[] = data.data?.links || data.links || [];

  console.log(`Page ${pageId}: ${markdown.length} chars markdown, ${links.length} links`);

  // Extract PDF links from all sources
  const pdfUrls = new Set<string>();

  // From links array
  for (const link of links) {
    if (link.includes(".pdf") || link.includes("/api/uploads/")) {
      pdfUrls.add(link.split("#")[0].trim());
    }
  }

  // From HTML - more patterns
  const htmlPatterns = [
    /href=["'](https?:\/\/[^"']*\.pdf[^"']*)/gi,
    /href=["'](https?:\/\/adala\.justice\.gov\.ma\/api\/uploads\/[^"']+)/gi,
    /href=["']([^"']*\/uploads\/[^"']+\.pdf[^"']*)/gi,
  ];
  for (const pattern of htmlPatterns) {
    let m;
    while ((m = pattern.exec(html)) !== null) {
      let u = m[1].split("#")[0].trim();
      if (!u.startsWith("http")) u = `https://adala.justice.gov.ma${u}`;
      pdfUrls.add(u);
    }
  }

  // From markdown links
  const mdLinkRegex = /\[([^\]]*)\]\((https?:\/\/[^)]*\.pdf[^)]*)\)/gi;
  let mdMatch;
  while ((mdMatch = mdLinkRegex.exec(markdown)) !== null) {
    pdfUrls.add(mdMatch[2].split("#")[0].trim());
  }

  // Build law entries with context from markdown
  const laws: { title: string; pdfUrl: string; context: string }[] = [];

  for (const pdfUrl of pdfUrls) {
    // Try to find context around this URL in the markdown
    let title = extractTitleFromUrl(pdfUrl);
    let context = "";

    // Search for this URL or filename in markdown to get surrounding text
    const filename = pdfUrl.split("/").pop() || "";
    const decodedFilename = tryDecode(filename);

    // Look for text near the PDF link in markdown
    const escapedUrl = pdfUrl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const contextRegex = new RegExp(`([^\\n]{0,300})(?:${escapedUrl.slice(0, 50)}|${decodedFilename.slice(0, 30)})`, "i");
    const ctxMatch = contextRegex.exec(markdown);
    if (ctxMatch && ctxMatch[1]) {
      context = ctxMatch[1].replace(/[#*[\]()]/g, "").trim();
      if (context.length > title.length) title = context.slice(0, 500);
    }

    // Also try: extract text just before the link in markdown
    const beforeLinkRegex = new RegExp(`([^\\n]+)\\n[^\\n]*${decodedFilename.slice(0, 20)}`, "i");
    const blMatch = beforeLinkRegex.exec(markdown);
    if (blMatch && blMatch[1] && blMatch[1].length > title.length) {
      title = blMatch[1].replace(/[#*[\]()]/g, "").trim().slice(0, 500);
    }

    laws.push({ title: title || "نص قانوني", pdfUrl, context: context.slice(0, 1000) });
  }

  return { laws, rawMarkdown: markdown.slice(0, 5000) };
}

function tryDecode(s: string): string {
  try { return decodeURIComponent(s); } catch { return s; }
}

function extractTitleFromUrl(url: string): string {
  try {
    const segments = url.split("/");
    let filename = segments[segments.length - 1];
    filename = tryDecode(filename);
    return filename
      .replace(/-\d{10,15}\.pdf$/i, "")
      .replace(/\.pdf$/i, "")
      .replace(/\s*\(\d+\)\s*$/, "")
      .replace(/_/g, " ")
      .trim() || "نص قانوني";
  } catch { return "نص قانوني"; }
}

/**
 * Classify a legal document using AI
 */
async function classifyWithAI(title: string, context: string, lovableKey: string): Promise<Record<string, any>> {
  try {
    const textToAnalyze = context.length > title.length ? context : title;

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${lovableKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [{
          role: "user",
          content: `أنت خبير في القانون المغربي. حلل النص التالي واستخرج المعلومات الوصفية.

النص: ${textToAnalyze}

أجب بـ JSON فقط بدون أي نص إضافي:
{
  "doc_type": "dahir أو law أو organic_law أو decree أو circular أو decision أو convention",
  "category": "التصنيف مثل: مدونة الأسرة، القانون الجنائي، قانون الشغل، القانون التجاري، القانون العقاري، المسطرة المدنية، القانون الإداري، أخرى",
  "reference_number": "رقم النص إن وجد",
  "year_issued": null,
  "issuing_authority": "الجهة المصدرة إن وجدت",
  "subject": "ملخص قصير للموضوع"
}`
        }],
        temperature: 0.1,
      }),
    });

    if (!resp.ok) {
      console.log(`AI classification failed: ${resp.status}`);
      return fallbackClassify(title);
    }

    const ai = await resp.json();
    const content = ai.choices?.[0]?.message?.content || "";
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return fallbackClassify(title);
    return JSON.parse(jsonMatch[0]);
  } catch (e) {
    console.log(`AI error: ${e}`);
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
    [/المسطرة الجنائية/, "المسطرة الجنائية"], [/الضريب/, "القانون المالي والضريبي"],
  ];
  for (const [r, v] of cats) if (r.test(title)) { category = v; break; }

  const refMatch = title.match(/رقم\s+([\d\.]+[-–]?[\d\.]*)/);
  const yearMatch = title.match(/(20\d{2}|19\d{2})/);

  return {
    doc_type, category,
    reference_number: refMatch?.[1] || "",
    year_issued: yearMatch ? parseInt(yearMatch[1]) : null,
    issuing_authority: "", subject: "",
  };
}

async function downloadAndStorePdf(
  pdfUrl: string,
  docId: string,
  docType: string,
  supabase: any,
): Promise<{ success: boolean; size: number; path: string }> {
  try {
    let fetchUrl: string;
    try { fetchUrl = encodeURI(decodeURI(pdfUrl)); } catch { fetchUrl = encodeURI(pdfUrl); }

    const pdfResp = await fetch(fetchUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
    });

    if (!pdfResp.ok) {
      console.log(`PDF download failed: ${pdfResp.status} for ${pdfUrl.slice(0, 80)}`);
      return { success: false, size: 0, path: "" };
    }

    const pdfData = await pdfResp.arrayBuffer();
    const filePath = `${docType}/${docId}.pdf`;

    const { error: uploadErr } = await supabase.storage
      .from("legal-pdfs")
      .upload(filePath, pdfData, { contentType: "application/pdf", upsert: true });

    if (uploadErr) {
      console.log(`Upload error: ${uploadErr.message}`);
      return { success: false, size: pdfData.byteLength, path: filePath };
    }

    await supabase.from("legal_documents").update({
      local_pdf_path: filePath,
      metadata: {
        scraped: true,
        scraped_at: new Date().toISOString(),
        source_site: "adala",
        is_pdf: true,
        has_local_pdf: true,
        file_size_bytes: pdfData.byteLength,
      },
    }).eq("id", docId);

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
    const firecrawlKey = Deno.env.get("FIRECRAWL_API_KEY")!;

    if (!firecrawlKey) {
      return new Response(JSON.stringify({ error: "FIRECRAWL_API_KEY not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const { action = "scrape_page", page_id, batch_size = 1, start_page } = body;

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

      const { laws, rawMarkdown } = await scrapeWithFirecrawl(page_id, firecrawlKey);

      if (!laws.length) {
        return new Response(JSON.stringify({
          success: true, message: `No PDF links found on page ${page_id}`, count: 0,
          markdownPreview: rawMarkdown.slice(0, 500),
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

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

        // Build content
        const content = [
          law.title,
          "",
          law.context ? `السياق: ${law.context}` : "",
          `التصنيف: ${cls.category || "أخرى"}`,
          `النوع: ${cls.doc_type || "law"}`,
          cls.reference_number ? `الرقم المرجعي: ${cls.reference_number}` : "",
          cls.subject ? `الموضوع: ${cls.subject}` : "",
          cls.issuing_authority ? `الجهة المصدرة: ${cls.issuing_authority}` : "",
          `المصدر: بوابة عدالة - وزارة العدل`,
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
          results.push({ title: law.title.slice(0, 80), status: `error: ${err.message.slice(0, 50)}` });
          continue;
        }

        // Download and store PDF
        const pdfResult = await downloadAndStorePdf(law.pdfUrl, ins!.id, cls.doc_type || "law", supabase);
        results.push({
          title: law.title.slice(0, 80),
          status: pdfResult.success ? "✅ saved" : "📝 metadata_only",
          doc_type: cls.doc_type,
          category: cls.category,
          pdf_size: pdfResult.size,
        });

        // Small delay between items
        await new Promise(r => setTimeout(r, 300));
      }

      return new Response(JSON.stringify({
        success: true, page_id, count: results.length, results,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ===== SCRAPE BATCH =====
    if (action === "scrape_batch") {
      const start = start_page || 1;
      const end = Math.min(start + (batch_size || 3) - 1, 1070);
      const summary = [];

      for (let pid = start; pid <= end; pid++) {
        try {
          const { data: ex } = await supabase
            .from("legal_documents")
            .select("id")
            .eq("resource_page_id", pid)
            .limit(1);

          if (ex?.length) {
            summary.push({ page: pid, status: "skipped" });
            continue;
          }

          const { laws } = await scrapeWithFirecrawl(pid, firecrawlKey);
          let saved = 0;

          for (const law of laws) {
            const { data: dup } = await supabase
              .from("legal_documents")
              .select("id")
              .eq("pdf_url", law.pdfUrl)
              .limit(1);
            if (dup?.length) continue;

            const cls = await classifyWithAI(law.title, law.context, lovableKey);
            const { data: ins, error } = await supabase.from("legal_documents").insert({
              title: law.title.slice(0, 500),
              content: law.title,
              source: `https://adala.justice.gov.ma/resources/${pid}`,
              pdf_url: law.pdfUrl,
              doc_type: cls.doc_type || "law",
              category: cls.category || "أخرى",
              reference_number: cls.reference_number || null,
              year_issued: cls.year_issued || null,
              issuing_authority: cls.issuing_authority || null,
              subject: cls.subject || null,
              resource_page_id: pid,
              ai_classification: cls,
              metadata: { scraped: true, scraped_at: new Date().toISOString(), source_site: "adala", is_pdf: true },
            }).select("id").single();

            if (error) continue;

            await downloadAndStorePdf(law.pdfUrl, ins!.id, cls.doc_type || "law", supabase);
            saved++;
            await new Promise(r => setTimeout(r, 300));
          }

          summary.push({ page: pid, laws_found: laws.length, saved });
        } catch (e) {
          summary.push({ page: pid, error: String(e).slice(0, 80) });
        }

        // Delay between pages
        await new Promise(r => setTimeout(r, 500));
      }

      return new Response(JSON.stringify({ success: true, summary }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ===== STATUS =====
    if (action === "status") {
      const { count: total } = await supabase
        .from("legal_documents")
        .select("*", { count: "exact", head: true })
        .not("resource_page_id", "is", null);

      const { count: withPdf } = await supabase
        .from("legal_documents")
        .select("*", { count: "exact", head: true })
        .not("resource_page_id", "is", null)
        .not("local_pdf_path", "is", null);

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

    return new Response(JSON.stringify({
      error: "Invalid action. Use: scrape_page, scrape_batch, or status",
      usage: {
        scrape_page: { action: "scrape_page", page_id: 1 },
        scrape_batch: { action: "scrape_batch", start_page: 1, batch_size: 5 },
        status: { action: "status" },
      },
    }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (e) {
    console.error("Fatal error:", e);
    return new Response(JSON.stringify({
      error: e instanceof Error ? e.message : "Unknown error",
    }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
