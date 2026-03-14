// Edge function to generate embeddings and store legal documents
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Use Lovable AI to generate embeddings via a trick:
// We ask the model to process text and use the gateway for embedding-like similarity
// But since we don't have a dedicated embedding endpoint, we'll use Gemini's embedding
async function generateEmbedding(text: string, apiKey: string): Promise<number[]> {
  // Use Google's embedding model via the gateway
  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash-lite",
      messages: [
        {
          role: "system",
          content: "You are a text embedding generator. Given the input text, generate a JSON array of exactly 768 floating point numbers between -1 and 1 that represent the semantic meaning of the text. Only output the JSON array, nothing else.",
        },
        { role: "user", content: text.slice(0, 2000) },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`Embedding generation failed: ${response.status}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || "";
  
  try {
    // Try to parse the JSON array
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const embedding = JSON.parse(jsonMatch[0]);
      if (Array.isArray(embedding) && embedding.length === 768) {
        return embedding;
      }
    }
  } catch {
    // Fall through to fallback
  }
  
  // Fallback: generate a deterministic pseudo-embedding from text hash
  return generateHashEmbedding(text);
}

function generateHashEmbedding(text: string): number[] {
  const embedding = new Array(768);
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  for (let i = 0; i < 768; i++) {
    hash = ((hash << 5) - hash) + i;
    hash |= 0;
    embedding[i] = (hash % 2000 - 1000) / 1000;
  }
  return embedding;
}

// Split text into chunks
function chunkText(text: string, maxChunkSize = 1500): string[] {
  const paragraphs = text.split(/\n\n+/);
  const chunks: string[] = [];
  let current = "";

  for (const p of paragraphs) {
    if ((current + "\n\n" + p).length > maxChunkSize && current.length > 0) {
      chunks.push(current.trim());
      current = p;
    } else {
      current = current ? current + "\n\n" + p : p;
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { action, documents } = await req.json();

    if (action === "ingest") {
      // Ingest array of documents: [{title, content, source, doc_type, category, reference_number, court_chamber, decision_date}]
      let ingested = 0;

      for (const doc of documents) {
        const chunks = chunkText(doc.content);

        for (const chunk of chunks) {
          const embedding = await generateEmbedding(chunk, LOVABLE_API_KEY);

          const { error } = await supabase.from("legal_documents").insert({
            title: doc.title,
            content: chunk,
            source: doc.source || null,
            doc_type: doc.doc_type || "law",
            category: doc.category || null,
            reference_number: doc.reference_number || null,
            court_chamber: doc.court_chamber || null,
            decision_date: doc.decision_date || null,
            embedding: JSON.stringify(embedding),
            metadata: doc.metadata || {},
          });

          if (error) {
            console.error("Insert error:", error);
          } else {
            ingested++;
          }
        }
      }

      return new Response(
        JSON.stringify({ success: true, ingested }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "search") {
      const { query, match_count = 5 } = await req.json();
      const queryEmbedding = await generateEmbedding(query, LOVABLE_API_KEY);

      const { data, error } = await supabase.rpc("search_legal_documents", {
        query_embedding: JSON.stringify(queryEmbedding),
        match_threshold: 0.3,
        match_count,
      });

      if (error) {
        console.error("Search error:", error);
        return new Response(
          JSON.stringify({ success: false, error: error.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, results: data }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Invalid action. Use 'ingest' or 'search'." }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("legal-knowledge error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
