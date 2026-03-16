import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * Directly fetch a resource page from adala.justice.gov.ma and extract PDF links
 */
async function scrapeResourcePage(pageId: number): Promise<{ title: string; pdfUrl: string }[]> {
  const url = `https://adala.justice.gov.ma/resources/${pageId}`;
  console.log(`Fetching: ${url}`);

  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "ar,fr;q=0.9,en;q=0.8",
    },
  });

  if (!response.ok) {
    console.log(`Page ${pageId} returned ${response.status}`);
    return [];
  }

  const html = await response.text();
  console.log(`Page ${pageId}: ${html.length} chars HTML`);

  // Extract PDF links - multiple patterns
  const results: { title: string; pdfUrl: string }[] = [];
  const seen = new Set<string>();

  // Pattern 1: href with .pdf
  const pdfRegex = /href=["'](https?:\/\/adala\.justice\.gov\.ma[^"']*\.pdf[^"']*)/gi;
  let match;
  while ((match = pdfRegex.exec(html)) !== null) {
    const pdfUrl = match[1].split("#")[0].trim();
    if (!seen.has(pdfUrl)) {
      seen.add(pdfUrl);
      results.push({ title: extractTitleFromUrl(pdfUrl), pdfUrl });
    }
  }

  // Pattern 2: href with /api/uploads/
  const uploadRegex = /href=["'](https?:\/\/adala\.justice\.gov\.ma\/api\/uploads\/[^"']+)/gi;
  while ((match = uploadRegex.exec(html)) !== null) {
    let pdfUrl = match[1].split("#")[0].trim();
    if (!seen.has(pdfUrl)) {
      seen.add(pdfUrl);
      results.push({ title: extractTitleFromUrl(pdfUrl), pdfUrl });
    }
  }

  // Pattern 3: Look for links in any anchor tags that might be PDFs
  const anyLinkRegex = /href=["']([^"']*adala[^"']*(?:\.pdf|uploads)[^"']*)/gi;
  while ((match = anyLinkRegex.exec(html)) !== null) {
    let pdfUrl = match[1].split("#")[0].trim();
    if (!pdfUrl.startsWith("http")) pdfUrl = `https://adala.justice.gov.ma${pdfUrl}`;
    if (!seen.has(pdfUrl)) {
      seen.add(pdfUrl);
      results.push({ title: extractTitleFromUrl(pdfUrl), pdfUrl });
    }
  }

  // Also try to extract text context near links for better titles
  // Look for Arabic text near PDF links
  const contextRegex = /([^<>]{10,200})\s*<a[^>]*href=["']([^"']*\.pdf[^"']*)/gi;
  while ((match = contextRegex.exec(html)) !== null) {
    const contextText = match[1].replace(/<[^>]+>/g, "").trim();
    let pdfUrl = match[2].split("#")[0].trim();
    if (!pdfUrl.startsWith("http")) pdfUrl = `https://adala.justice.gov.ma${pdfUrl}`;
    // Update title if we have better context
    const existing = results.find(r => r.pdfUrl === pdfUrl);
    if (existing && contextText.length > existing.title.length) {
      existing.title = contextText.slice(0, 500);
    }
  }

  console.log(`Found ${results.length} PDF links on page ${pageId}`);
  return results;
}

function extractTitleFromUrl(url: string): string {
  try {
    const segments = url.split("/");
    let filename = segments[segments.length - 1];
    try { filename = decodeURIComponent(filename); } catch { /* keep */ }
    return filename
      .replace(/-\d{10,15}\.pdf$/i, "")
      .replace(/\.pdf$/i, "")
      .replace(/\s*\(\d+\)\s*$/, "")
      .trim() || "نص قانوني";
  } catch { return "نص قانوني"; }
}

async function classifyWithAI(title: string, lovableKey: string): Promise<Record<string, any>> {
  try {
    const prompt = `أنت خبير في القانون المغربي. حلل عنوان هذه الوثيقة القانونية واستخرج المعلومات.

العنوان: ${title}

أجب بصيغة JSON فقط:
{"doc_type":"dahir/law/organic_law/decree/circular/decision/convention","category":"التصنيف القانوني","reference_number":"رقم النص","year_issued":2024,"issuing_authority":"الجهة","subject":"الموضوع","official_gazette_number":"","signing_date":null}`;

    const resp = await fetch("https://api.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${lovableKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "google/gemini-2.5-flash-lite", messages: [{ role: "user", content: prompt }], temperature: 0.1 }),
    });

    if (!resp.ok) return fallbackClassify(title);
    const ai = await resp.json();
    const content = ai.choices?.[0]?.message?.content || "";
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return fallbackClassify(title);
    return JSON.parse(jsonMatch[0]);
  } catch { return fallbackClassify(title); }
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

  return { doc_type, category, reference_number: refMatch?.[1] || "", year_issued: yearMatch ? parseInt(yearMatch[1]) : null, issuing_authority: "", subject: "", official_gazette_number: "", signing_date: null };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const lovableKey = Deno.env.get("LOVABLE_API_KEY")!;
    const body = await req.json().catch(() => ({}));
    const { action = "scrape_page", page_id, batch_size = 1, start_page } = body;

    if (action === "scrape_page" && page_id) {
      // Check if already scraped
      const { data: existing } = await supabase.from("legal_documents").select("id").eq("resource_page_id", page_id).limit(1);
      if (existing?.length) {
        return new Response(JSON.stringify({ success: true, message: `Page ${page_id} already done`, skipped: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const laws = await scrapeResourcePage(page_id);
      if (!laws.length) {
        return new Response(JSON.stringify({ success: true, message: `No PDFs on page ${page_id}`, count: 0 }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const results = [];
      for (const law of laws) {
        // Skip duplicates
        const { data: dup } = await supabase.from("legal_documents").select("id").eq("pdf_url", law.pdfUrl).limit(1);
        if (dup?.length) { results.push({ title: law.title.slice(0, 60), status: "duplicate" }); continue; }

        // Classify
        const cls = await classifyWithAI(law.title, lovableKey);

        // Insert
        const { data: ins, error: err } = await supabase.from("legal_documents").insert({
          title: law.title.slice(0, 500),
          content: `${law.title}\n\nالتصنيف: ${cls.category || "أخرى"}\nالنوع: ${cls.doc_type || "law"}\n${cls.reference_number ? 'الرقم: ' + cls.reference_number + '\n' : ''}${cls.subject ? 'الموضوع: ' + cls.subject + '\n' : ''}مصدر: بوابة عدالة`,
          source: `https://adala.justice.gov.ma/resources/${page_id}`,
          pdf_url: law.pdfUrl,
          doc_type: cls.doc_type || "law",
          category: cls.category || "أخرى",
          reference_number: cls.reference_number || null,
          year_issued: cls.year_issued || null,
          issuing_authority: cls.issuing_authority || null,
          subject: cls.subject || null,
          official_gazette_number: cls.official_gazette_number || null,
          signing_date: cls.signing_date || null,
          resource_page_id: page_id,
          ai_classification: cls,
          metadata: { scraped: true, scraped_at: new Date().toISOString(), source_site: "adala", is_pdf: true },
        }).select("id").single();

        if (err) { results.push({ title: law.title.slice(0, 60), status: `err: ${err.message.slice(0, 30)}` }); continue; }

        // Download PDF
        const docId = ins!.id;
        try {
          let fetchUrl: string;
          try { fetchUrl = encodeURI(decodeURI(law.pdfUrl)); } catch { fetchUrl = encodeURI(law.pdfUrl); }
          const pdfResp = await fetch(fetchUrl, { headers: { "User-Agent": "Mozilla/5.0" } });
          if (pdfResp.ok) {
            const pdfData = await pdfResp.arrayBuffer();
            const filePath = `${cls.doc_type || "law"}/${docId}.pdf`;
            const { error: upErr } = await supabase.storage.from("legal-pdfs").upload(filePath, pdfData, { contentType: "application/pdf", upsert: true });
            if (!upErr) {
              await supabase.from("legal_documents").update({ local_pdf_path: filePath, metadata: { scraped: true, scraped_at: new Date().toISOString(), source_site: "adala", is_pdf: true, has_local_pdf: true, file_size_bytes: pdfData.byteLength } }).eq("id", docId);
              results.push({ title: law.title.slice(0, 60), status: "✅ saved", doc_type: cls.doc_type, size: pdfData.byteLength });
            } else {
              results.push({ title: law.title.slice(0, 60), status: "📝 metadata_only" });
            }
          } else {
            results.push({ title: law.title.slice(0, 60), status: `pdf_http_${pdfResp.status}` });
          }
        } catch (e) {
          results.push({ title: law.title.slice(0, 60), status: "pdf_download_err" });
        }
        await new Promise(r => setTimeout(r, 200));
      }

      return new Response(JSON.stringify({ success: true, page_id, count: results.length, results }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "scrape_batch") {
      const start = start_page || 1;
      const end = Math.min(start + (batch_size || 1) - 1, 1070);
      const summary = [];
      for (let pid = start; pid <= end; pid++) {
        try {
          const { data: ex } = await supabase.from("legal_documents").select("id").eq("resource_page_id", pid).limit(1);
          if (ex?.length) { summary.push({ page: pid, status: "skipped" }); continue; }
          const laws = await scrapeResourcePage(pid);
          let count = 0;
          for (const law of laws) {
            const { data: dup } = await supabase.from("legal_documents").select("id").eq("pdf_url", law.pdfUrl).limit(1);
            if (dup?.length) continue;
            const cls = await classifyWithAI(law.title, lovableKey);
            const { data: ins, error } = await supabase.from("legal_documents").insert({
              title: law.title.slice(0, 500), content: law.title, source: `https://adala.justice.gov.ma/resources/${pid}`,
              pdf_url: law.pdfUrl, doc_type: cls.doc_type || "law", category: cls.category || "أخرى",
              reference_number: cls.reference_number || null, year_issued: cls.year_issued || null,
              issuing_authority: cls.issuing_authority || null, subject: cls.subject || null,
              resource_page_id: pid, ai_classification: cls,
              metadata: { scraped: true, scraped_at: new Date().toISOString(), source_site: "adala", is_pdf: true },
            }).select("id").single();
            if (error) continue;
            // Download PDF
            try {
              let fetchUrl: string;
              try { fetchUrl = encodeURI(decodeURI(law.pdfUrl)); } catch { fetchUrl = encodeURI(law.pdfUrl); }
              const pdfResp = await fetch(fetchUrl, { headers: { "User-Agent": "Mozilla/5.0" } });
              if (pdfResp.ok) {
                const pdfData = await pdfResp.arrayBuffer();
                const fp = `${cls.doc_type || "law"}/${ins!.id}.pdf`;
                const { error: ue } = await supabase.storage.from("legal-pdfs").upload(fp, pdfData, { contentType: "application/pdf", upsert: true });
                if (!ue) await supabase.from("legal_documents").update({ local_pdf_path: fp, metadata: { scraped: true, scraped_at: new Date().toISOString(), source_site: "adala", is_pdf: true, has_local_pdf: true, file_size_bytes: pdfData.byteLength } }).eq("id", ins!.id);
              }
            } catch {}
            count++;
            await new Promise(r => setTimeout(r, 200));
          }
          summary.push({ page: pid, count });
        } catch (e) { summary.push({ page: pid, error: String(e).slice(0, 50) }); }
        await new Promise(r => setTimeout(r, 300));
      }
      return new Response(JSON.stringify({ success: true, summary }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "status") {
      const { count: total } = await supabase.from("legal_documents").select("*", { count: "exact", head: true }).not("resource_page_id", "is", null);
      const { count: withPdf } = await supabase.from("legal_documents").select("*", { count: "exact", head: true }).not("resource_page_id", "is", null).not("local_pdf_path", "is", null);
      const { data: maxP } = await supabase.from("legal_documents").select("resource_page_id").not("resource_page_id", "is", null).order("resource_page_id", { ascending: false }).limit(1);
      return new Response(JSON.stringify({ totalDocs: total || 0, withLocalPdf: withPdf || 0, lastPage: maxP?.[0]?.resource_page_id || 0, totalPages: 1070 }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "Use: scrape_page, scrape_batch, status" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("Error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
