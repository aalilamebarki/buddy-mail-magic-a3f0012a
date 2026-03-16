import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function parseLinksFile(text: string): string[] {
  const urls: string[] = [];
  for (const line of text.split('\n')) {
    const m = line.match(/الرابط:\s*(https?:\/\/[^\s]+)/);
    if (m) urls.push(m[1].trim().split('#')[0]);
  }
  return urls;
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

    const { action = "fix_and_download", batch_size = 5 } = await req.json().catch(() => ({}));

    // Step 1: Load the full links file
    const { data: fileData, error: fileError } = await supabase.storage
      .from("scraping-data")
      .download("adala_pdf_links.txt");
    
    if (fileError || !fileData) {
      return new Response(
        JSON.stringify({ error: "Cannot read links file", details: fileError?.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const allUrls = parseLinksFile(await fileData.text());
    console.log(`Total URLs in file: ${allUrls.length}`);

    if (action === "fix_sources") {
      // Fix truncated sources by matching partial URLs to full ones
      const { data: brokenDocs } = await supabase
        .from("legal_documents")
        .select("id, source")
        .like("source", "%adala.justice.gov.ma%")
        .limit(1000);

      if (!brokenDocs) {
        return new Response(JSON.stringify({ fixed: 0 }), 
          { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      let fixed = 0;
      for (const doc of brokenDocs) {
        if (!doc.source || doc.source.endsWith('.pdf')) continue;
        
        // Find matching full URL
        const partialSource = doc.source.split('#')[0];
        const matchingUrl = allUrls.find(u => u.startsWith(partialSource));
        
        if (matchingUrl && matchingUrl !== doc.source) {
          const { error } = await supabase
            .from("legal_documents")
            .update({ 
              source: matchingUrl,
              local_pdf_path: null // Reset so we can re-download
            })
            .eq("id", doc.id);
          
          if (!error) fixed++;
        }
      }

      return new Response(
        JSON.stringify({ success: true, fixed, total: brokenDocs.length }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "fix_and_download") {
      // Fix then download in one go
      // 1. Fix broken sources
      const { data: brokenDocs } = await supabase
        .from("legal_documents")
        .select("id, source, local_pdf_path")
        .like("source", "%adala.justice.gov.ma%")
        .or("local_pdf_path.is.null,local_pdf_path.eq.fetch_failed")
        .limit(batch_size);

      if (!brokenDocs || brokenDocs.length === 0) {
        return new Response(
          JSON.stringify({ message: "لا توجد وثائق للمعالجة", processed: 0 }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      let downloaded = 0;
      let fixed = 0;
      let failed = 0;
      const results: { id: string; status: string; title?: string }[] = [];

      for (const doc of brokenDocs) {
        let sourceUrl = doc.source?.split('#')[0] || '';
        
        // Fix truncated URL if needed
        if (sourceUrl && !sourceUrl.endsWith('.pdf')) {
          const matchingUrl = allUrls.find(u => u.startsWith(sourceUrl));
          if (matchingUrl) {
            sourceUrl = matchingUrl;
            await supabase.from("legal_documents")
              .update({ source: matchingUrl })
              .eq("id", doc.id);
            fixed++;
          } else {
            // No matching full URL found
            await supabase.from("legal_documents")
              .update({ local_pdf_path: "no_matching_url" })
              .eq("id", doc.id);
            failed++;
            results.push({ id: doc.id, status: "no_matching_url" });
            continue;
          }
        }

        // Download PDF
        try {
          let fetchUrl: string;
          try { fetchUrl = encodeURI(decodeURI(sourceUrl)); } 
          catch { fetchUrl = encodeURI(sourceUrl); }

          const response = await fetch(fetchUrl, {
            headers: { "User-Agent": "Mozilla/5.0 (compatible; LegalBot/1.0)" },
          });

          if (!response.ok) {
            await supabase.from("legal_documents")
              .update({ local_pdf_path: "fetch_failed" })
              .eq("id", doc.id);
            failed++;
            results.push({ id: doc.id, status: `http_${response.status}` });
            continue;
          }

          const fileData = await response.arrayBuffer();
          const { data: docData } = await supabase.from("legal_documents")
            .select("doc_type").eq("id", doc.id).single();
          
          const docType = docData?.doc_type || "law";
          const filePath = `${docType}/${doc.id}.pdf`;

          const { error: uploadErr } = await supabase.storage
            .from("legal-pdfs")
            .upload(filePath, fileData, {
              contentType: "application/pdf",
              upsert: true,
            });

          if (uploadErr) {
            failed++;
            results.push({ id: doc.id, status: `upload_err: ${uploadErr.message}` });
            continue;
          }

          await supabase.from("legal_documents")
            .update({ local_pdf_path: filePath })
            .eq("id", doc.id);

          downloaded++;
          results.push({ id: doc.id, status: "success" });
        } catch (e) {
          await supabase.from("legal_documents")
            .update({ local_pdf_path: "fetch_failed" })
            .eq("id", doc.id);
          failed++;
          results.push({ id: doc.id, status: `error: ${e.message?.slice(0, 50)}` });
        }
      }

      return new Response(
        JSON.stringify({ 
          success: true, downloaded, fixed, failed, 
          total: brokenDocs.length, results 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Invalid action" }),
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
