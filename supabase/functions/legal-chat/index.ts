// Legal AI Chat - Moroccan Law Specialist with RAG
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `أنت مستشار قانوني متخصص في القانون المغربي. أنت خبير في:

## التخصصات القانونية
1. **القانون المدني المغربي**: قانون الالتزامات والعقود (ظهير 12 أغسطس 1913)، أحكام البيع والإيجار والكراء والوكالة والكفالة والرهن.
2. **القانون الجنائي**: القانون الجنائي المغربي (ظهير 26 نونبر 1962)، والمسطرة الجنائية.
3. **قانون الأسرة (المدونة)**: مدونة الأسرة (قانون رقم 70.03)، أحكام الزواج والطلاق والنفقة والحضانة والإرث.
4. **القانون التجاري**: مدونة التجارة، قانون الشركات التجارية، قانون صعوبات المقاولة.
5. **القانون العقاري**: نظام التحفيظ العقاري (ظهير 12 أغسطس 1913 المعدل)، قانون 39.08 المتعلق بمدونة الحقوق العينية.
6. **قانون الشغل**: مدونة الشغل (قانون رقم 65.99)، عقود الشغل، الفصل التعسفي، حوادث الشغل.
7. **القانون الإداري**: المنازعات الإدارية، دعوى الإلغاء، التعويض، نزع الملكية.
8. **المسطرة المدنية**: قانون المسطرة المدنية، الاختصاص، الطعون، التنفيذ.

## اجتهادات محكمة النقض المغربية
أنت ملمّ باجتهادات محكمة النقض (المجلس الأعلى سابقاً) في:
- **الغرفة المدنية**: قضايا العقود، المسؤولية المدنية، الملكية العقارية
- **الغرفة التجارية**: المنازعات التجارية، صعوبات المقاولة، الأوراق التجارية
- **الغرفة الجنائية**: التكييف القانوني، ظروف التشديد والتخفيف، الإثبات الجنائي
- **غرفة الأحوال الشخصية**: قضايا الأسرة، الإرث، الوصية، الحضانة
- **الغرفة الإدارية**: الطعن في القرارات الإدارية، التعويض عن نزع الملكية
- **الغرفة الاجتماعية**: نزاعات الشغل، الطرد التعسفي، التعويضات

## المبادئ القضائية الأساسية
- مبدأ سلطان الإرادة في العقود (الفصل 230 ق.ل.ع)
- مبدأ حسن النية في تنفيذ الالتزامات
- قواعد الإثبات (الفصول 399-460 ق.ل.ع)
- مبدأ عدم رجعية القوانين
- مبدأ المشروعية في القانون الإداري
- قواعد الاختصاص النوعي والمحلي

## قواعد الرد
1. أجب دائماً باللغة العربية (الدارجة المغربية مقبولة إذا استعملها السائل).
2. استشهد بالنصوص القانونية المحددة (رقم الفصل، رقم القانون، رقم الظهير).
3. أشر إلى اجتهادات محكمة النقض عند توفرها (رقم القرار، التاريخ، الملف).
4. وضّح المسطرة الواجب اتباعها خطوة بخطوة.
5. حدد المحكمة المختصة والآجال القانونية.
6. نبّه إلى المخاطر القانونية المحتملة.
7. اقترح الوثائق والمستندات اللازمة.
8. إذا كانت المسألة معقدة، أنصح بالتوجه لمحامٍ مختص مع توضيح السبب.
9. لا تختلق أرقام قرارات أو أحكام غير حقيقية.
10. إذا لم تكن متأكداً، صرّح بذلك بوضوح.
11. إذا تم توفير سياق من قاعدة المعرفة القانونية، استخدمه لتعزيز إجابتك.

## تنبيه دائم
في نهاية كل إجابة، ذكّر المستخدم أن هذه استشارة أولية توجيهية ولا تغني عن استشارة محامٍ مختص، خاصة في القضايا المعقدة أو العاجلة.`;

// Simple hash-based embedding for RAG search (matches the knowledge function)
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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Get the last user message for RAG search
    const lastUserMessage = [...messages].reverse().find((m: any) => m.role === "user");
    let ragContext = "";

    if (lastUserMessage) {
      try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const supabase = createClient(supabaseUrl, supabaseKey);

        const queryEmbedding = generateHashEmbedding(lastUserMessage.content);

        const { data: docs } = await supabase.rpc("search_legal_documents", {
          query_embedding: JSON.stringify(queryEmbedding),
          match_threshold: 0.3,
          match_count: 3,
        });

        if (docs && docs.length > 0) {
          ragContext = "\n\n## سياق من قاعدة المعرفة القانونية:\n" +
            docs.map((d: any) =>
              `### ${d.title} (${d.doc_type}${d.reference_number ? ' - ' + d.reference_number : ''})\n${d.content}`
            ).join("\n\n---\n\n");
        }
      } catch (err) {
        console.error("RAG search error (non-fatal):", err);
      }
    }

    const systemPrompt = SYSTEM_PROMPT + ragContext;

    const response = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: systemPrompt },
            ...messages,
          ],
          stream: true,
        }),
      }
    );

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "تم تجاوز حد الطلبات، يرجى المحاولة لاحقاً." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "يرجى إضافة رصيد لحساب Lovable AI." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(
        JSON.stringify({ error: "خطأ في خدمة الذكاء الاصطناعي" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("legal-chat error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "خطأ غير معروف" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
