import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * Use Firecrawl to scrape adala.justice.gov.ma resource pages
 * This bypasses the cloud blocking that the direct fetch approach hits.
 */

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

function extractPdfLinksFromMarkdown(markdown: string, pageUrl: string): { title: string; pdfUrl: string; context: string }[] {
  const laws: { title: string; pdfUrl: string; context: string }[] = [];
  const seen = new Set<string>();

  // Pattern 1: Markdown links to PDFs [text](url)
  const mdLinkRegex = /\[([^\]]*)\]\((https?:\/\/[^\s)]*(?:\.pdf|\/api\/uploads\/)[^\s)]*)\)/gi;
  let match;
  while ((match = mdLinkRegex.exec(markdown)) !== null) {
    let pdfUrl = match[2].split("#")[0].trim();
    if (seen.has(pdfUrl)) continue;
    seen.add(pdfUrl);
    const title = match[1].trim() || extractTitleFromUrl(pdfUrl);
    const pos = match.index;
    const context = markdown.substring(Math.max(0, pos - 300), pos).trim().slice(-200);
    laws.push({ title, pdfUrl, context });
  }

  // Pattern 2: Plain URLs that look like PDFs
  const plainUrlRegex = /(https?:\/\/adala\.justice\.gov\.ma\/api\/uploads\/[^\s"'<>]+)/gi;
  while ((match = plainUrlRegex.exec(markdown)) !== null) {
    const pdfUrl = match[1].split("#")[0].trim();
    if (seen.has(pdfUrl)) continue;
    seen.add(pdfUrl);
    laws.push({ title: extractTitleFromUrl(pdfUrl), pdfUrl, context: "" });
  }

  return laws;
}

function extractPdfLinksFromHtml(html: string): { title: string; pdfUrl: string; context: string }[] {
  const laws: { title: string; pdfUrl: string; context: string }[] = [];
  const seen = new Set<string>();

  const linkRegex = /<a[^>]+href=["']([^"']*(?:\.pdf|\/api\/uploads\/)[^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match;
  while ((match = linkRegex.exec(html)) !== null) {
    let pdfUrl = match[1].split("#")[0].trim();
    if (!pdfUrl.startsWith("http")) {
      pdfUrl = `https://adala.justice.gov.ma${pdfUrl.startsWith("/") ? "" : "/"}${pdfUrl}`;
    }
    if (seen.has(pdfUrl)) continue;
    seen.add(pdfUrl);
    const linkText = match[2].replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
    const pos = match.index;
    const context = html.substring(Math.max(0, pos - 500), pos)
      .replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(-200);
    laws.push({ title: linkText || extractTitleFromUrl(pdfUrl), pdfUrl, context });
  }

  return laws;
}

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
  pdfUrl: string, docId: string, docType: string, supabase: any, firecrawlKey: string,
): Promise<{ success: boolean; size: number; path: string }> {
  try {
    // Try direct download first via Firecrawl scrape (screenshot method for binary)
    // Actually for PDFs we try direct fetch - PDFs aren't blocked like HTML pages
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
    const firecrawlKey = Deno.env.get("FIRECRAWL_API_KEY");

    if (!firecrawlKey) {
      return new Response(JSON.stringify({
        success: false, error: "FIRECRAWL_API_KEY not configured",
      }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const body = await req.json().catch(() => ({}));
    const { action = "scrape_page", page_id, start_page, end_page, batch_size = 5 } = body;

    // ===== STATUS =====
    if (action === "status") {
      const { count: total } = await supabase
        .from("legal_documents")
        .select("*", { count: "exact", head: true });

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

    // ===== SCRAPE SINGLE PAGE VIA FIRECRAWL =====
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

      const url = `https://adala.justice.gov.ma/resources/${page_id}`;
      console.log(`🔥 Firecrawl scraping: ${url}`);

      // Use Firecrawl to scrape the page
      const scrapeResp = await fetch("https://api.firecrawl.dev/v1/scrape", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${firecrawlKey}`,
          "Content-Type": "application/json",
        },
      body: JSON.stringify({
        url,
        formats: ["html", "links"],
        timeout: 90000,
      }),
      });

      if (!scrapeResp.ok) {
        const errText = await scrapeResp.text();
        console.error(`Firecrawl error ${scrapeResp.status}: ${errText}`);
        return new Response(JSON.stringify({
          success: false, error: `Firecrawl error: ${scrapeResp.status}`, details: errText.slice(0, 200),
        }), { status: scrapeResp.status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const scrapeData = await scrapeResp.json();
      const markdown = scrapeData.data?.markdown || scrapeData.markdown || "";
      const html = scrapeData.data?.html || scrapeData.html || "";
      const links = scrapeData.data?.links || scrapeData.links || [];

      console.log(`Page ${page_id}: ${markdown.length} chars markdown, ${links.length} links`);

      // Extract PDF links from both markdown and HTML
      const mdLaws = extractPdfLinksFromMarkdown(markdown, url);
      const htmlLaws = extractPdfLinksFromHtml(html);

      // Also check links array for PDFs
      const linkLaws: { title: string; pdfUrl: string; context: string }[] = [];
      const seenUrls = new Set(mdLaws.map(l => l.pdfUrl));
      htmlLaws.forEach(l => { if (!seenUrls.has(l.pdfUrl)) { seenUrls.add(l.pdfUrl); mdLaws.push(l); } });
      for (const link of links) {
        const linkStr = typeof link === "string" ? link : link?.url || "";
        if ((linkStr.includes(".pdf") || linkStr.includes("/api/uploads/")) && !seenUrls.has(linkStr)) {
          seenUrls.add(linkStr);
          mdLaws.push({ title: extractTitleFromUrl(linkStr), pdfUrl: linkStr, context: "" });
        }
      }

      const laws = mdLaws;

      if (!laws.length) {
        return new Response(JSON.stringify({
          success: true, message: `No PDF links found on page ${page_id}`, count: 0,
          markdownPreview: markdown.slice(0, 500),
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

        const { data: ins, error: err } = await supabase.from("legal_documents").insert({
          title: law.title.slice(0, 500),
          content,
          source: url,
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
            scraped: true, scraped_at: new Date().toISOString(),
            source_site: "adala", is_pdf: true, scraped_via: "firecrawl",
          },
        }).select("id").single();

        if (err) {
          console.log(`Insert error: ${err.message}`);
          results.push({ title: law.title.slice(0, 80), status: `error: ${err.message.slice(0, 50)}` });
          continue;
        }

        // Download PDF
        const pdfResult = await downloadAndStorePdf(law.pdfUrl, ins!.id, cls.doc_type || "law", supabase, firecrawlKey);

        if (pdfResult.success) {
          await supabase.from("legal_documents").update({
            local_pdf_path: pdfResult.path,
            metadata: {
              scraped: true, scraped_at: new Date().toISOString(),
              source_site: "adala", is_pdf: true, has_local_pdf: true,
              file_size_bytes: pdfResult.size, scraped_via: "firecrawl",
            },
          }).eq("id", ins!.id);
        }

        results.push({
          title: law.title.slice(0, 80),
          status: pdfResult.success ? "✅ saved" : "📝 metadata_only",
          doc_type: cls.doc_type, category: cls.category, pdf_size: pdfResult.size,
        });
      }

      return new Response(JSON.stringify({
        success: true, page_id, count: results.length, results,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ===== BATCH SCRAPE =====
    if (action === "batch_scrape" && start_page && end_page) {
      const batchResults = [];
      const actualBatchSize = Math.min(batch_size, 10); // Max 10 pages per call
      const endP = Math.min(end_page, start_page + actualBatchSize - 1);

      for (let pageId = start_page; pageId <= endP; pageId++) {
        try {
          // Check if already scraped
          const { data: existing } = await supabase
            .from("legal_documents")
            .select("id")
            .eq("resource_page_id", pageId)
            .limit(1);

          if (existing?.length) {
            batchResults.push({ page_id: pageId, status: "skipped", reason: "already_scraped" });
            continue;
          }

          const url = `https://adala.justice.gov.ma/resources/${pageId}`;

          const scrapeResp = await fetch("https://api.firecrawl.dev/v1/scrape", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${firecrawlKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              url,
              formats: ["html", "links"],
              timeout: 90000,
            }),
          });

          if (!scrapeResp.ok) {
            batchResults.push({ page_id: pageId, status: "firecrawl_error", code: scrapeResp.status });
            continue;
          }

          const scrapeData = await scrapeResp.json();
          const markdown = scrapeData.data?.markdown || scrapeData.markdown || "";
          const html = scrapeData.data?.html || scrapeData.html || "";
          const links = scrapeData.data?.links || scrapeData.links || [];

          const mdLaws = extractPdfLinksFromMarkdown(markdown, url);
          const htmlLaws = extractPdfLinksFromHtml(html);
          const seenUrls = new Set(mdLaws.map(l => l.pdfUrl));
          htmlLaws.forEach(l => { if (!seenUrls.has(l.pdfUrl)) { seenUrls.add(l.pdfUrl); mdLaws.push(l); } });
          for (const link of links) {
            const linkStr = typeof link === "string" ? link : link?.url || "";
            if ((linkStr.includes(".pdf") || linkStr.includes("/api/uploads/")) && !seenUrls.has(linkStr)) {
              seenUrls.add(linkStr);
              mdLaws.push({ title: extractTitleFromUrl(linkStr), pdfUrl: linkStr, context: "" });
            }
          }

          let saved = 0;
          for (const law of mdLaws) {
            const { data: dup } = await supabase.from("legal_documents").select("id").eq("pdf_url", law.pdfUrl).limit(1);
            if (dup?.length) continue;

            const cls = await classifyWithAI(law.title, law.context, lovableKey);
            const contentText = [law.title, cls.subject ? `الموضوع: ${cls.subject}` : "", `التصنيف: ${cls.category || "أخرى"}`, `المصدر: بوابة عدالة`].filter(Boolean).join("\n");

            const { data: ins, error: err } = await supabase.from("legal_documents").insert({
              title: law.title.slice(0, 500), content: contentText, source: url,
              pdf_url: law.pdfUrl, doc_type: cls.doc_type || "law", category: cls.category || "أخرى",
              reference_number: cls.reference_number || null, year_issued: cls.year_issued || null,
              issuing_authority: cls.issuing_authority || null, subject: cls.subject || null,
              resource_page_id: pageId, ai_classification: cls,
              metadata: { scraped: true, scraped_at: new Date().toISOString(), source_site: "adala", is_pdf: true, scraped_via: "firecrawl" },
            }).select("id").single();

            if (!err && ins) {
              const pdfResult = await downloadAndStorePdf(law.pdfUrl, ins.id, cls.doc_type || "law", supabase, firecrawlKey);
              if (pdfResult.success) {
                await supabase.from("legal_documents").update({
                  local_pdf_path: pdfResult.path,
                  metadata: { scraped: true, scraped_at: new Date().toISOString(), source_site: "adala", is_pdf: true, has_local_pdf: true, file_size_bytes: pdfResult.size, scraped_via: "firecrawl" },
                }).eq("id", ins.id);
              }
              saved++;
            }
          }

          batchResults.push({ page_id: pageId, status: "done", found: mdLaws.length, saved });
        } catch (e) {
          batchResults.push({ page_id: pageId, status: "error", error: String(e).slice(0, 100) });
        }
      }

      return new Response(JSON.stringify({
        success: true, action: "batch_scrape",
        start_page, processed_to: endP,
        next_start: endP < end_page ? endP + 1 : null,
        results: batchResults,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({
      error: "Invalid action. Use: scrape_page, batch_scrape, or status",
      usage: {
        scrape_page: { action: "scrape_page", page_id: 1 },
        batch_scrape: { action: "batch_scrape", start_page: 1, end_page: 10, batch_size: 5 },
        status: { action: "status" },
      },
    }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (e) {
    console.error("Error:", e);
    return new Response(JSON.stringify({
      success: false, error: String(e).slice(0, 200),
    }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
