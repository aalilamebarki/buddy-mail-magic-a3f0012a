import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Get batch size from request or default to 5
    const { batch_size = 5 } = await req.json().catch(() => ({}));

    // Find documents with source URLs but no local PDF
    const { data: docs, error: fetchErr } = await supabase
      .from("legal_documents")
      .select("id, title, source, doc_type")
      .not("source", "is", null)
      .is("local_pdf_path", null)
      .limit(batch_size);

    if (fetchErr) throw fetchErr;
    if (!docs || docs.length === 0) {
      return new Response(
        JSON.stringify({ message: "لا توجد وثائق للتحميل", downloaded: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let downloaded = 0;
    let failed = 0;
    const results: { id: string; title: string; status: string }[] = [];

    for (const doc of docs) {
      try {
        if (!doc.source) continue;

        // Clean the source URL
        let sourceUrl = doc.source.replace(/#.*$/, ""); // Remove hash fragments

        // Fetch the PDF
        const response = await fetch(sourceUrl, {
          headers: {
            "User-Agent": "Mozilla/5.0 (compatible; LegalBot/1.0)",
          },
        });

        if (!response.ok) {
          // Mark as failed so we don't retry endlessly
          await supabase
            .from("legal_documents")
            .update({ local_pdf_path: "fetch_failed" })
            .eq("id", doc.id);
          failed++;
          results.push({ id: doc.id, title: doc.title, status: `failed: ${response.status}` });
          continue;
        }

        const contentType = response.headers.get("content-type") || "";
        const isPdf = contentType.includes("pdf") || sourceUrl.toLowerCase().endsWith(".pdf");

        // Generate a clean file name
        const sanitizedTitle = doc.title
          .replace(/[^\u0600-\u06FFa-zA-Z0-9\s\-_.]/g, "")
          .replace(/\s+/g, "_")
          .slice(0, 80);
        const ext = isPdf ? "pdf" : "pdf"; // Default to pdf
        const filePath = `${doc.doc_type}/${doc.id}_${sanitizedTitle}.${ext}`;

        const fileData = await response.arrayBuffer();

        // Upload to storage
        const { error: uploadErr } = await supabase.storage
          .from("legal-pdfs")
          .upload(filePath, fileData, {
            contentType: isPdf ? "application/pdf" : contentType,
            upsert: true,
          });

        if (uploadErr) {
          console.error(`Upload error for ${doc.id}:`, uploadErr);
          results.push({ id: doc.id, title: doc.title, status: `upload_failed: ${uploadErr.message}` });
          failed++;
          continue;
        }

        // Update the document with local path
        await supabase
          .from("legal_documents")
          .update({ local_pdf_path: filePath })
          .eq("id", doc.id);

        downloaded++;
        results.push({ id: doc.id, title: doc.title, status: "success" });
      } catch (e) {
        console.error(`Error processing ${doc.id}:`, e);
        // Mark as failed
        await supabase
          .from("legal_documents")
          .update({ local_pdf_path: "fetch_failed" })
          .eq("id", doc.id);
        failed++;
        results.push({ id: doc.id, title: doc.title, status: `error: ${e.message}` });
      }
    }

    return new Response(
      JSON.stringify({
        message: `تم تحميل ${downloaded} وثيقة، فشل ${failed}`,
        downloaded,
        failed,
        total: docs.length,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("Function error:", e);
    return new Response(
      JSON.stringify({ error: e.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
