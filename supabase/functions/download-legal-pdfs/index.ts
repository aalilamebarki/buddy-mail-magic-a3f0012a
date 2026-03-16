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

    const { batch_size = 5 } = await req.json().catch(() => ({}));

    // Find documents with source URLs but no local PDF
    const { data: docs, error: fetchErr } = await supabase
      .from("legal_documents")
      .select("id, title, source, doc_type")
      .not("source", "is", null)
      .is("local_pdf_path", null)
      .like("source", "%adala.justice.gov.ma%")
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

        const sourceUrl = doc.source.replace(/#.*$/, "");

        // Encode URL properly for Arabic characters
        let fetchUrl: string;
        try {
          fetchUrl = encodeURI(decodeURI(sourceUrl));
        } catch {
          fetchUrl = encodeURI(sourceUrl);
        }

        const response = await fetch(fetchUrl, {
          headers: {
            "User-Agent": "Mozilla/5.0 (compatible; LegalBot/1.0)",
          },
        });

        if (!response.ok) {
          await supabase
            .from("legal_documents")
            .update({ local_pdf_path: "fetch_failed" })
            .eq("id", doc.id);
          failed++;
          results.push({ id: doc.id, title: doc.title, status: `failed: ${response.status}` });
          continue;
        }

        const fileData = await response.arrayBuffer();

        // Use ONLY the document UUID as filename - no Arabic characters
        const filePath = `${doc.doc_type}/${doc.id}.pdf`;

        const { error: uploadErr } = await supabase.storage
          .from("legal-pdfs")
          .upload(filePath, fileData, {
            contentType: "application/pdf",
            upsert: true,
          });

        if (uploadErr) {
          console.error(`Upload error for ${doc.id}:`, uploadErr);
          results.push({ id: doc.id, title: doc.title, status: `upload_failed: ${uploadErr.message}` });
          failed++;
          continue;
        }

        await supabase
          .from("legal_documents")
          .update({ local_pdf_path: filePath })
          .eq("id", doc.id);

        downloaded++;
        results.push({ id: doc.id, title: doc.title, status: "success" });
      } catch (e) {
        console.error(`Error processing ${doc.id}:`, e);
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
