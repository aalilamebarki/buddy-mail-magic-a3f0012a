import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface ScrapedLaw {
  title: string;
  pdfUrl: string;
  pageText: string;
}

/**
 * Step 1: Use Firecrawl to scrape a resource page and extract PDF links + text
 */
async function scrapeResourcePage(pageId: number, firecrawlKey: string): Promise<ScrapedLaw[]> {
  const url = `https://adala.justice.gov.ma/resources/${pageId}`;
  console.log(`Scraping page: ${url}`);

  const response = await fetch("https://api.firecrawl.dev/v1/scrape", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${firecrawlKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      url,
      formats: ["markdown", "links", "html"],
      waitFor: 8000,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    console.error(`Firecrawl error (${response.status}):`, err.slice(0, 200));
    throw new Error(`Firecrawl error: ${response.status}`);
  }

  const result = await response.json();
  const data = result.data || result;
  
  const markdown = data.markdown || "";
  const html = data.html || "";
  const links: string[] = data.links || [];
  
  console.log(`Page ${pageId}: ${markdown.length} chars markdown, ${links.length} links`);

  // Extract PDF links from the page
  const pdfLinks = links.filter((l: string) => 
    l.includes("adala.justice.gov.ma") && 
    (l.toLowerCase().includes(".pdf") || l.includes("/api/uploads/"))
  );

  // Also extract PDF links from HTML using regex
  const htmlPdfRegex = /href=["'](https?:\/\/adala\.justice\.gov\.ma[^"']*\.pdf[^"']*)/gi;
  let match;
  while ((match = htmlPdfRegex.exec(html)) !== null) {
    const pdfUrl = match[1].split("#")[0].trim();
    if (!pdfLinks.includes(pdfUrl)) pdfLinks.push(pdfUrl);
  }

  // Also look for upload API links
  const uploadRegex = /href=["'](https?:\/\/adala\.justice\.gov\.ma\/api\/uploads\/[^"']+)/gi;
  while ((match = uploadRegex.exec(html)) !== null) {
    const pdfUrl = match[1].split("#")[0].trim();
    if (!pdfLinks.includes(pdfUrl)) pdfLinks.push(pdfUrl);
  }

  console.log(`Found ${pdfLinks.length} PDF links on page ${pageId}`);

  // Build law entries from markdown context
  const laws: ScrapedLaw[] = pdfLinks.map((pdfUrl: string) => {
    // Clean the URL
    const cleanUrl = pdfUrl.split("#")[0].trim();
    
    // Extract title from URL filename
    let title = "نص قانوني";
    try {
      const segments = cleanUrl.split("/");
      let filename = segments[segments.length - 1];
      try { filename = decodeURIComponent(filename); } catch { /* keep */ }
      title = filename
        .replace(/-\d{10,15}\.pdf$/i, "")
        .replace(/\.pdf$/i, "")
        .replace(/\s*\(\d+\)\s*$/, "")
        .trim() || "نص قانوني";
    } catch { /* keep default */ }

    return {
      title,
      pdfUrl: cleanUrl,
      pageText: markdown.slice(0, 3000), // context for AI classification
    };
  });

  return laws;
}

/**
 * Step 2: Use AI (Gemini) to classify a legal document
 */
async function classifyWithAI(title: string, pageText: string, lovableKey: string): Promise<{
  doc_type: string;
  category: string;
  reference_number: string;
  year_issued: number | null;
  issuing_authority: string;
  subject: string;
  official_gazette_number: string;
  signing_date: string | null;
}> {
  try {
    const prompt = `أنت خبير في القانون المغربي. حلل النص التالي واستخرج المعلومات المطلوبة.

عنوان الوثيقة: ${title}

سياق الصفحة:
${pageText.slice(0, 2000)}

أجب بصيغة JSON فقط (بدون أي نص إضافي) بالحقول التالية:
{
  "doc_type": "نوع الوثيقة: dahir أو law أو organic_law أو decree أو circular أو decision أو convention",
  "category": "التصنيف: مثل القانون الجنائي، مدونة الأسرة، القانون التجاري، القانون العقاري، قانون الشغل، القانون الإداري، القانون المدني، المسطرة المدنية، المسطرة الجنائية، القانون المالي والضريبي، التنظيم القضائي، قانون الكراء، مهنة المحاماة، أخرى",
  "reference_number": "رقم القانون مثل 1.22.38 أو 38.15",
  "year_issued": "سنة الصدور كرقم أو null",
  "issuing_authority": "الجهة المصدرة: مثل الملك، رئيس الحكومة، وزير العدل",
  "subject": "موضوع القانون في جملة واحدة",
  "official_gazette_number": "رقم الجريدة الرسمية إن وجد",
  "signing_date": "تاريخ التوقيع بصيغة YYYY-MM-DD أو null"
}`;

    const response = await fetch("https://api.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      console.error(`AI error: ${response.status}`);
      return fallbackClassify(title);
    }

    const aiResult = await response.json();
    const content = aiResult.choices?.[0]?.message?.content || "";
    
    // Extract JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.log("No JSON in AI response, using fallback");
      return fallbackClassify(title);
    }

    const parsed = JSON.parse(jsonMatch[0]);
    return {
      doc_type: parsed.doc_type || fallbackDocType(title),
      category: parsed.category || fallbackCategory(title),
      reference_number: parsed.reference_number || extractRefNumber(title),
      year_issued: parsed.year_issued ? Number(parsed.year_issued) : extractYear(title),
      issuing_authority: parsed.issuing_authority || "",
      subject: parsed.subject || "",
      official_gazette_number: parsed.official_gazette_number || "",
      signing_date: parsed.signing_date || null,
    };
  } catch (e) {
    console.error("AI classification error:", String(e).slice(0, 100));
    return fallbackClassify(title);
  }
}

// Fallback classification using regex
function fallbackClassify(title: string) {
  return {
    doc_type: fallbackDocType(title),
    category: fallbackCategory(title),
    reference_number: extractRefNumber(title),
    year_issued: extractYear(title),
    issuing_authority: "",
    subject: "",
    official_gazette_number: "",
    signing_date: null,
  };
}

function fallbackDocType(text: string): string {
  if (/ظهير|ظــهــيــر/.test(text)) return "dahir";
  if (/قانون\s*تنظيمي/.test(text)) return "organic_law";
  if (/مرسوم/.test(text)) return "decree";
  if (/دورية|منشور/.test(text)) return "circular";
  if (/اتفاقية|معاهدة/.test(text)) return "convention";
  if (/قرار\s*(وزير|رقم|مشترك)/.test(text)) return "decision";
  if (/قانون\s*رقم|مدونة/.test(text)) return "law";
  return "law";
}

function fallbackCategory(text: string): string {
  const patterns: [RegExp, string][] = [
    [/كراء|المكتري|إفراغ/, "قانون الكراء"],
    [/الطلاق|النفقة|الحضانة|الزواج|الأسرة/, "مدونة الأسرة"],
    [/التحفيظ|العقار|العقاري/, "القانون العقاري"],
    [/الشغل|العمل|الأجير|المشغل/, "قانون الشغل"],
    [/التجاري|الشركة|الكمبيالة|التجارة/, "القانون التجاري"],
    [/الجنائي|الجناية|الجنحة|العقوبات/, "القانون الجنائي"],
    [/الإداري|نزع الملكية/, "القانون الإداري"],
    [/المسؤولية|التعويض|الالتزام/, "القانون المدني"],
    [/المسطرة المدنية|الدعوى/, "المسطرة المدنية"],
    [/المسطرة الجنائية/, "المسطرة الجنائية"],
    [/الضريبة|المالية|الجمارك/, "القانون المالي والضريبي"],
    [/المحاماة|المحامي/, "مهنة المحاماة"],
    [/التنظيم القضائي|المحاكم/, "التنظيم القضائي"],
  ];
  for (const [r, v] of patterns) if (r.test(text)) return v;
  return "أخرى";
}

function extractRefNumber(text: string): string {
  const m = text.match(/رقم\s+([\d\.]+[-–]?[\d\.]*)/);
  return m ? m[1] : "";
}

function extractYear(text: string): number | null {
  // Look for Gregorian year
  const m = text.match(/(20\d{2}|19\d{2})/);
  return m ? parseInt(m[1]) : null;
}

/**
 * Step 3: Download PDF and upload to storage
 */
async function downloadAndStorePdf(
  pdfUrl: string,
  docId: string,
  docType: string,
  supabase: any
): Promise<{ localPath: string | null; fileSize: number }> {
  try {
    let fetchUrl: string;
    try { fetchUrl = encodeURI(decodeURI(pdfUrl)); }
    catch { fetchUrl = encodeURI(pdfUrl); }

    const response = await fetch(fetchUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; LegalBot/1.0)" },
    });

    if (!response.ok) {
      console.log(`PDF download failed: ${response.status} for ${pdfUrl.slice(-50)}`);
      return { localPath: null, fileSize: 0 };
    }

    const pdfData = await response.arrayBuffer();
    const filePath = `${docType}/${docId}.pdf`;

    const { error: uploadErr } = await supabase.storage
      .from("legal-pdfs")
      .upload(filePath, pdfData, {
        contentType: "application/pdf",
        upsert: true,
      });

    if (uploadErr) {
      console.error(`Upload error: ${uploadErr.message}`);
      return { localPath: null, fileSize: pdfData.byteLength };
    }

    return { localPath: filePath, fileSize: pdfData.byteLength };
  } catch (e) {
    console.error(`Download error: ${String(e).slice(0, 80)}`);
    return { localPath: null, fileSize: 0 };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    const firecrawlKey = Deno.env.get("FIRECRAWL_API_KEY")!;
    const lovableKey = Deno.env.get("LOVABLE_API_KEY")!;

    const body = await req.json().catch(() => ({}));
    const { action = "scrape_page", page_id, start_page, end_page, batch_size = 1 } = body;

    // === ACTION: scrape a single resource page ===
    if (action === "scrape_page" && page_id) {
      console.log(`=== Scraping resource page ${page_id} ===`);

      // Check if this page was already scraped
      const { data: existing } = await supabase
        .from("legal_documents")
        .select("id")
        .eq("resource_page_id", page_id)
        .limit(1);

      if (existing && existing.length > 0) {
        return new Response(
          JSON.stringify({ success: true, message: `Page ${page_id} already scraped`, skipped: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Step 1: Scrape the page with Firecrawl
      const laws = await scrapeResourcePage(page_id, firecrawlKey);
      
      if (!laws.length) {
        return new Response(
          JSON.stringify({ success: true, message: `No PDF links found on page ${page_id}`, count: 0 }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const results = [];
      for (const law of laws) {
        // Check if this PDF URL already exists
        const { data: existingDoc } = await supabase
          .from("legal_documents")
          .select("id")
          .eq("pdf_url", law.pdfUrl)
          .limit(1);

        if (existingDoc && existingDoc.length > 0) {
          results.push({ title: law.title.slice(0, 60), status: "duplicate" });
          continue;
        }

        // Step 2: Classify with AI
        const classification = await classifyWithAI(law.title, law.pageText, lovableKey);

        // Step 3: Insert record
        const { data: inserted, error: insertErr } = await supabase
          .from("legal_documents")
          .insert({
            title: law.title.slice(0, 500),
            content: `${law.title}\n\nالتصنيف: ${classification.category}\nالنوع: ${classification.doc_type}\n${classification.reference_number ? 'الرقم: ' + classification.reference_number + '\n' : ''}${classification.subject ? 'الموضوع: ' + classification.subject + '\n' : ''}مصدر: بوابة عدالة`,
            source: `https://adala.justice.gov.ma/resources/${page_id}`,
            pdf_url: law.pdfUrl,
            doc_type: classification.doc_type,
            category: classification.category,
            reference_number: classification.reference_number || null,
            year_issued: classification.year_issued,
            issuing_authority: classification.issuing_authority || null,
            subject: classification.subject || null,
            official_gazette_number: classification.official_gazette_number || null,
            signing_date: classification.signing_date,
            resource_page_id: page_id,
            ai_classification: classification,
            metadata: {
              scraped: true,
              scraped_at: new Date().toISOString(),
              source_site: "adala",
              is_pdf: true,
            },
          })
          .select("id")
          .single();

        if (insertErr) {
          console.error(`Insert error: ${insertErr.message}`);
          results.push({ title: law.title.slice(0, 60), status: `error: ${insertErr.message.slice(0, 30)}` });
          continue;
        }

        // Step 4: Download PDF and store locally
        const docId = inserted!.id;
        const { localPath, fileSize } = await downloadAndStorePdf(
          law.pdfUrl, docId, classification.doc_type, supabase
        );

        if (localPath) {
          await supabase
            .from("legal_documents")
            .update({
              local_pdf_path: localPath,
              metadata: {
                scraped: true,
                scraped_at: new Date().toISOString(),
                source_site: "adala",
                is_pdf: true,
                has_local_pdf: true,
                file_size_bytes: fileSize,
              },
            })
            .eq("id", docId);
        }

        results.push({
          title: law.title.slice(0, 60),
          status: localPath ? "✅ downloaded" : "📝 metadata_only",
          doc_type: classification.doc_type,
          category: classification.category,
          year: classification.year_issued,
        });

        // Small delay
        await new Promise(r => setTimeout(r, 300));
      }

      return new Response(
        JSON.stringify({ success: true, page_id, count: results.length, results }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // === ACTION: batch scrape multiple pages ===
    if (action === "scrape_batch") {
      const start = start_page || 1;
      const end = Math.min(start + (batch_size || 1) - 1, end_page || 1070);
      const allResults = [];

      for (let pid = start; pid <= end; pid++) {
        try {
          // Check if already scraped
          const { data: existing } = await supabase
            .from("legal_documents")
            .select("id")
            .eq("resource_page_id", pid)
            .limit(1);

          if (existing && existing.length > 0) {
            allResults.push({ page: pid, status: "skipped" });
            continue;
          }

          const laws = await scrapeResourcePage(pid, firecrawlKey);
          let pageCount = 0;

          for (const law of laws) {
            const { data: existingDoc } = await supabase
              .from("legal_documents")
              .select("id")
              .eq("pdf_url", law.pdfUrl)
              .limit(1);

            if (existingDoc && existingDoc.length > 0) continue;

            const classification = await classifyWithAI(law.title, law.pageText, lovableKey);

            const { data: inserted, error: insertErr } = await supabase
              .from("legal_documents")
              .insert({
                title: law.title.slice(0, 500),
                content: `${law.title}\n\nالتصنيف: ${classification.category}\nالنوع: ${classification.doc_type}\n${classification.reference_number ? 'الرقم: ' + classification.reference_number + '\n' : ''}${classification.subject ? 'الموضوع: ' + classification.subject + '\n' : ''}مصدر: بوابة عدالة`,
                source: `https://adala.justice.gov.ma/resources/${pid}`,
                pdf_url: law.pdfUrl,
                doc_type: classification.doc_type,
                category: classification.category,
                reference_number: classification.reference_number || null,
                year_issued: classification.year_issued,
                issuing_authority: classification.issuing_authority || null,
                subject: classification.subject || null,
                official_gazette_number: classification.official_gazette_number || null,
                signing_date: classification.signing_date,
                resource_page_id: pid,
                ai_classification: classification,
                metadata: {
                  scraped: true,
                  scraped_at: new Date().toISOString(),
                  source_site: "adala",
                  is_pdf: true,
                },
              })
              .select("id")
              .single();

            if (insertErr) continue;

            const docId = inserted!.id;
            const { localPath, fileSize } = await downloadAndStorePdf(
              law.pdfUrl, docId, classification.doc_type, supabase
            );

            if (localPath) {
              await supabase.from("legal_documents")
                .update({ local_pdf_path: localPath, metadata: { scraped: true, scraped_at: new Date().toISOString(), source_site: "adala", is_pdf: true, has_local_pdf: true, file_size_bytes: fileSize } })
                .eq("id", docId);
            }

            pageCount++;
            await new Promise(r => setTimeout(r, 200));
          }

          allResults.push({ page: pid, count: pageCount });
          await new Promise(r => setTimeout(r, 500)); // delay between pages
        } catch (e) {
          allResults.push({ page: pid, status: `error: ${String(e).slice(0, 50)}` });
        }
      }

      return new Response(
        JSON.stringify({ success: true, results: allResults, pages_processed: allResults.length }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // === ACTION: status ===
    if (action === "status") {
      const { count: totalDocs } = await supabase
        .from("legal_documents")
        .select("*", { count: "exact", head: true })
        .not("resource_page_id", "is", null);

      const { count: withPdf } = await supabase
        .from("legal_documents")
        .select("*", { count: "exact", head: true })
        .not("resource_page_id", "is", null)
        .not("local_pdf_path", "is", null);

      // Get max page scraped
      const { data: maxPage } = await supabase
        .from("legal_documents")
        .select("resource_page_id")
        .not("resource_page_id", "is", null)
        .order("resource_page_id", { ascending: false })
        .limit(1);

      return new Response(
        JSON.stringify({
          totalDocuments: totalDocs || 0,
          withLocalPdf: withPdf || 0,
          lastPageScraped: maxPage?.[0]?.resource_page_id || 0,
          totalPages: 1070,
          progress: `${((maxPage?.[0]?.resource_page_id || 0) / 1070 * 100).toFixed(1)}%`,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Invalid action. Use: scrape_page, scrape_batch, status" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("Error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
