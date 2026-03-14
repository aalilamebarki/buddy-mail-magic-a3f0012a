// Legal AI Chat - Moroccan Law with RAG + Enhanced Accuracy
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `أنت مستشار قانوني مغربي متمرس ودقيق جداً. مهمتك تحليل النازلة القانونية المعروضة عليك وإعطاء استشارة **صحيحة وموثوقة** مبنية حصرياً على القانون المغربي.

## ⛔ قواعد الدقة والمصداقية (أهم القواعد):
1. **لا تختلق أبداً**: لا تختلق أرقام فصول أو مواد أو قرارات قضائية أو تواريخ. إذا لم تكن متأكداً من رقم فصل معين، قل "ينص القانون على..." بدون ذكر رقم خاطئ.
2. **لا تبالغ في التفاؤل أو التشاؤم**: أعطِ تقييماً واقعياً لفرص النجاح مبنياً على القانون والاجتهاد.
3. **ميّز بين المؤكد والمحتمل**: استخدم "من المرجح" و"قد" عندما لا تكون متأكداً 100%.
4. **إذا وُجد سياق من قاعدة المعرفة**: اعتمد عليه أولاً وبدقة، واذكر مصدره.
5. **إذا لم تجد معلومة**: قل بصراحة "لا أملك معلومة مؤكدة حول هذه النقطة" بدل الاختلاق.

## منهجية الاستشارة:

### 1. تشخيص النازلة
- حدد الإشكال القانوني الرئيسي بدقة
- صنّف القضية (مدني، جنائي، أسري، تجاري، إداري، عقاري، شغل)

### 2. السند القانوني
- اذكر القانون المنطبق (الاسم الكامل ورقمه إن كنت متأكداً)
- اذكر الفصول/المواد المنطبقة مباشرة فقط
- القوانين الأساسية المؤكدة:
  * قانون الالتزامات والعقود (ظهير 12 غشت 1913)
  * القانون الجنائي (مجموعة القانون الجنائي)
  * قانون المسطرة المدنية (ظهير 28 شتنبر 1974)
  * قانون المسطرة الجنائية (قانون 22.01)
  * مدونة الأسرة (قانون 70.03)
  * مدونة التجارة (قانون 15.95)
  * مدونة الشغل (قانون 65.99)
  * ظهير التحفيظ العقاري + مدونة الحقوق العينية (39.08)
  * قانون الكراء السكني والمهني (67.12)
  * قانون الكراء التجاري (49.16)

### 3. الاجتهاد القضائي
- إذا وجدت قرارات في السياق المقدم: اذكرها بأرقامها وتواريخها كما هي
- إذا لم تجد: قل "استقر الاجتهاد القضائي المغربي على..." مع ذكر الاتجاه العام بدون اختلاق أرقام
- لا تذكر أبداً رقم قرار من عندك

### 4. التحليل العملي (الأهم للمستشير):
- **المحكمة المختصة**: نوعياً ومكانياً
- **نوع الدعوى**: التسمية القانونية الدقيقة
- **الإجراءات**: خطوات عملية مرقمة
- **الوثائق المطلوبة**: قائمة محددة
- **الآجال**: المدد القانونية المهمة (إن كنت متأكداً منها)
- **المصاريف التقريبية**: إن أمكن

### 5. تقييم واقعي:
- نقاط القوة في الموقف
- نقاط الضعف والمخاطر
- تقييم واقعي لفرص النجاح (لا تبالغ)
- نصيحة عملية

## أسلوب الكتابة:
- اكتب بالعربية الفصحى الواضحة
- اقبل الدارجة المغربية من السائل
- استخدم العناوين والتنظيم بالماركداون
- كن مفصلاً بما يكفي لكن بدون حشو

## اختم دائماً بـ:
⚠️ **تنبيه**: هذه استشارة أولية توجيهية مبنية على المعلومات المقدمة، ولا تغني عن استشارة محامٍ مختص يطّلع على كافة الوثائق والملابسات.`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, caseContext } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    // Build RAG context
    const lastUserMessage = [...messages].reverse().find((m: any) => m.role === "user");
    let ragContext = "";

    if (lastUserMessage) {
      try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const supabase = createClient(supabaseUrl, supabaseKey);

        const { count } = await supabase
          .from("legal_documents")
          .select("*", { count: "exact", head: true });

        if (count && count > 0) {
          // Extract meaningful search terms
          const fullText = (caseContext || "") + " " + lastUserMessage.content;
          const searchTerms = fullText
            .split(/\s+/)
            .filter((t: string) => t.length > 3)
            .slice(0, 8);

          if (searchTerms.length > 0) {
            // Search with OR conditions across multiple terms
            const { data: docs } = await supabase
              .from("legal_documents")
              .select("title, content, source, doc_type, reference_number, court_chamber, category")
              .or(searchTerms.map((t: string) => `content.ilike.%${t}%`).join(","))
              .order("created_at", { ascending: false })
              .limit(8);

            if (docs && docs.length > 0) {
              // Separate laws and rulings
              const laws = docs.filter((d: any) => d.doc_type === "law");
              const rulings = docs.filter((d: any) => d.doc_type === "ruling");

              ragContext = "\n\n## مراجع من قاعدة المعرفة القانونية:";

              if (laws.length > 0) {
                ragContext += "\n\n### نصوص قانونية:\n" +
                  laws.map((d: any) =>
                    `**${d.title}** ${d.category ? '(' + d.category + ')' : ''}\n${d.content.slice(0, 1200)}`
                  ).join("\n\n---\n\n");
              }

              if (rulings.length > 0) {
                ragContext += "\n\n### قرارات قضائية:\n" +
                  rulings.map((d: any) =>
                    `**${d.title}**${d.reference_number ? ' (قرار عدد ' + d.reference_number + ')' : ''}${d.court_chamber ? ' - ' + d.court_chamber : ''}\n${d.content.slice(0, 1200)}`
                  ).join("\n\n---\n\n");
              }

              ragContext += "\n\n**تعليمات**: اعتمد على هذه المراجع في إجابتك. إذا ذكرت قراراً قضائياً، اذكر رقمه وتاريخه كما ورد أعلاه فقط. لا تختلق أرقام قرارات غير موجودة.";
            }
          }
        }
      } catch (err) {
        console.error("RAG search error (non-fatal):", err);
      }
    }

    // Build final system prompt
    let finalPrompt = SYSTEM_PROMPT + ragContext;

    // Add case context if provided from intake form
    if (caseContext) {
      finalPrompt += "\n\n" + caseContext;
    }

    const response = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-pro",
          messages: [
            { role: "system", content: finalPrompt },
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
