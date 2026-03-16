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

    // Try different endpoints
    const urls = [
      `https://adala.justice.gov.ma/api/resources/${page_id}`,
      `https://adala.justice.gov.ma/api/v1/resources/${page_id}`,
      `https://adala.justice.gov.ma/resources/${page_id}.json`,
    ];

    const results: any[] = [];
    for (const url of urls) {
      try {
        const controller = new AbortController();
        const tid = setTimeout(() => controller.abort(), 10000);
        const resp = await fetch(url, {
          signal: controller.signal,
          headers: { "Accept": "application/json, text/html", "User-Agent": "Mozilla/5.0" },
        });
        clearTimeout(tid);
        const text = await resp.text();
        results.push({ url, status: resp.status, len: text.length, preview: text.slice(0, 500) });
      } catch (e) {
        results.push({ url, error: String(e).slice(0, 100) });
      }
    }

    // Also try the main domain
    try {
      const controller = new AbortController();
      const tid = setTimeout(() => controller.abort(), 10000);
      const resp = await fetch("https://adala.justice.gov.ma/", {
        signal: controller.signal,
        headers: { "User-Agent": "Mozilla/5.0" },
      });
      clearTimeout(tid);
      const text = await resp.text();
      results.push({ url: "homepage", status: resp.status, len: text.length, preview: text.slice(0, 300) });
    } catch (e) {
      results.push({ url: "homepage", error: String(e).slice(0, 100) });
    }

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
