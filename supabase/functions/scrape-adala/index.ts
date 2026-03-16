import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const { page_id = 1 } = body;

    const url = `https://adala.justice.gov.ma/resources/${page_id}`;
    console.log(`Testing: ${url}`);

    const controller = new AbortController();
    const tid = setTimeout(() => controller.abort(), 25000);

    try {
      const resp = await fetch(url, {
        signal: controller.signal,
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          "Accept": "text/html",
        },
      });
      clearTimeout(tid);

      const html = await resp.text();
      const pdfLinks: string[] = [];
      const regex = /href=["']([^"']*(?:\.pdf|uploads)[^"']*)/gi;
      let m;
      while ((m = regex.exec(html)) !== null) pdfLinks.push(m[1]);

      return new Response(JSON.stringify({
        ok: true, status: resp.status, len: html.length,
        preview: html.slice(0, 1500), pdfLinks: pdfLinks.slice(0, 10),
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

    } catch (e) {
      clearTimeout(tid);
      return new Response(JSON.stringify({ ok: false, error: String(e) }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
