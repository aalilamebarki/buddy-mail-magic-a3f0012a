import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

/**
 * Parse the links file correctly - URLs contain spaces in Arabic filenames
 * Lines look like: المصدر (Resource 3) | الرابط: https://adala.justice.gov.ma/api/uploads/2025/11/07/ظهير شريف رقم 1.22.38 بتنفيذ القانون رقم 38.15 ال (1)-1762522515726.pdf#toolbar=0&statusbar=0
 */
function parseLinksFile(text: string): string[] {
  const urls: string[] = [];
  for (const line of text.split('\n')) {
    const idx = line.indexOf('الرابط: ');
    if (idx === -1) continue;
    let url = line.slice(idx + 'الرابط: '.length).trim();
    // Remove hash fragment
    const hashIdx = url.indexOf('#');
    if (hashIdx !== -1) url = url.slice(0, hashIdx);
    url = url.trim();
    if (url.startsWith('http')) urls.push(url);
  }
  return urls;
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

function detectCategory(text: string): string {
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
    [/التوثيق|الموثق/, "مهنة التوثيق"],
    [/العدالة|العدول|خطة/, "خطة العدالة"],
    [/المفوض|القضائيين/, "المفوضون القضائيون"],
    [/التنظيم القضائي|المحاكم/, "التنظيم القضائي"],
    [/السلطة القضائية/, "السلطة القضائية"],
  ];
  for (const [r, v] of patterns) if (r.test(text)) return v;
  return "أخرى";
}

function extractTitleFromUrl(url: string): string {
  try {
    const segments = url.split('/');
    let filename = segments[segments.length - 1];
    try { filename = decodeURIComponent(filename); } catch { /* keep */ }
    const cleaned = filename
      .replace(/-\d{10,15}\.pdf$/i, '')
      .replace(/\.pdf$/i, '')
      .replace(/\s*\(\d+\)\s*$/, '')
      .trim();
    return cleaned || "نص قانوني";
  } catch { return "نص قانوني"; }
}

function extractRefNumber(text: string): string {
  const m = text.match(/رقم\s+([\d\.]+[-–]?[\d\.]*)/);
  return m ? m[1] : "";
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

    const { action = "process", batch_size = 5 } = await req.json().catch(() => ({}));

    // Load links file
    const { data: fileData, error: fileError } = await supabase.storage
      .from("scraping-data")
      .download("adala_pdf_links.txt");
    
    if (fileError || !fileData) {
      return new Response(
        JSON.stringify({ error: "Cannot read links file" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const allUrls = parseLinksFile(await fileData.text());
    console.log(`Total URLs in file: ${allUrls.length}`);

    if (action === "status") {
      // Get existing sources
      const { count: totalDocs } = await supabase
        .from("legal_documents")
        .select("*", { count: "exact", head: true })
        .like("source", "%adala.justice.gov.ma%");
      
      const { count: withPdf } = await supabase
        .from("legal_documents")
        .select("*", { count: "exact", head: true })
        .like("source", "%adala.justice.gov.ma%")
        .not("local_pdf_path", "is", null)
        .not("local_pdf_path", "in", '("fetch_failed","no_matching_url","upload_failed")');

      return new Response(
        JSON.stringify({ 
          totalLinks: allUrls.length, 
          totalDocs: totalDocs || 0, 
          withLocalPdf: withPdf || 0,
          remaining: allUrls.length - (totalDocs || 0)
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "process") {
      // Get existing sources to skip
      const existing = new Set<string>();
      let off = 0;
      while (true) {
        const { data } = await supabase
          .from("legal_documents")
          .select("source")
          .like("source", "%adala.justice.gov.ma%")
          .range(off, off + 999);
        if (!data || !data.length) break;
        for (const d of data) if (d.source) existing.add(d.source);
        if (data.length < 1000) break;
        off += 1000;
      }
      console.log(`Existing docs: ${existing.size}`);

      // Find new URLs to process
      const pending = allUrls.filter(u => !existing.has(u)).slice(0, batch_size);
      
      if (!pending.length) {
        return new Response(
          JSON.stringify({ message: "✅ كل الروابط تمت معالجتها", processed: 0, remaining: 0 }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log(`Processing ${pending.length} new URLs...`);
      let downloaded = 0;
      let metadataOnly = 0;
      let failed = 0;
      const results: { url: string; status: string; title: string }[] = [];

      for (const url of pending) {
        const title = extractTitleFromUrl(url);
        const docType = detectDocType(title);
        const category = detectCategory(title);
        const refNum = extractRefNumber(title);

        try {
          // Encode URL properly (has spaces in Arabic filenames)
          let fetchUrl: string;
          try { fetchUrl = encodeURI(decodeURI(url)); }
          catch { fetchUrl = encodeURI(url); }

          const response = await fetch(fetchUrl, {
            headers: { "User-Agent": "Mozilla/5.0 (compatible; LegalBot/1.0)" },
          });

          // Insert document first
          const { data: inserted, error: insertErr } = await supabase
            .from("legal_documents")
            .insert({
              title: title.slice(0, 500),
              content: `${title}\n\nنوع الوثيقة: ${docType}\nالتصنيف: ${category}\n${refNum ? 'الرقم المرجعي: ' + refNum + '\n' : ''}مصدر: بوابة عدالة\nرابط: ${url}`,
              source: url,
              doc_type: docType,
              category,
              reference_number: refNum || null,
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
            if (insertErr.code === '23505') {
              results.push({ url: url.slice(-40), status: "duplicate", title: title.slice(0, 40) });
              continue;
            }
            console.error(`Insert error: ${insertErr.message}`);
            failed++;
            results.push({ url: url.slice(-40), status: `insert_err`, title: title.slice(0, 40) });
            continue;
          }

          const docId = inserted!.id;

          if (!response.ok) {
            // Save metadata only
            metadataOnly++;
            results.push({ url: url.slice(-40), status: `metadata_only (http ${response.status})`, title: title.slice(0, 40) });
            continue;
          }

          // Download and upload PDF
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
            metadataOnly++;
            results.push({ url: url.slice(-40), status: "upload_failed", title: title.slice(0, 40) });
            continue;
          }

          // Update with local path
          await supabase.from("legal_documents")
            .update({ 
              local_pdf_path: filePath,
              metadata: {
                scraped: true,
                scraped_at: new Date().toISOString(),
                source_site: "adala",
                is_pdf: true,
                has_local_pdf: true,
                file_size_bytes: pdfData.byteLength,
              }
            })
            .eq("id", docId);

          downloaded++;
          results.push({ url: url.slice(-40), status: "✅ downloaded", title: title.slice(0, 40) });
        } catch (e) {
          failed++;
          results.push({ url: url.slice(-40), status: `error: ${e.message?.slice(0, 30)}`, title: title.slice(0, 40) });
        }

        // Small delay between requests
        await new Promise(r => setTimeout(r, 300));
      }

      return new Response(
        JSON.stringify({
          success: true,
          downloaded,
          metadataOnly,
          failed,
          total: pending.length,
          remaining: allUrls.length - existing.size - pending.length,
          results,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Invalid action. Use: process, status" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("Error:", e);
    return new Response(
      JSON.stringify({ error: e.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
