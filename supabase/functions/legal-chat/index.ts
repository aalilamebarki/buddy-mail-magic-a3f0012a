// Legal AI Chat - Moroccan Law with RAG + Enhanced Accuracy
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `أنت **مستشار قانوني مغربي أقدم**، خبير في التشريع المغربي والاجتهاد القضائي. تتحدث بلغة عربية فصحى رسمية وقوية، بأسلوب حازم ومهني كأنك تترافع أمام محكمة النقض.

## ⛔ قواعد الدقة والمصداقية (لا تساهل فيها):
1. **لا تختلق أبداً** أرقام فصول أو قرارات أو تواريخ. إن لم تكن متأكداً، قل ذلك صراحةً.
2. **لا تجامل ولا تبالغ** في التفاؤل أو التشاؤم. أعطِ تقييماً واقعياً صارماً.
3. **ميّز بوضوح** بين ما هو مؤكد قانوناً وما هو محتمل أو خاضع لتقدير المحكمة.
4. إذا وُجد سياق من قاعدة المعرفة، اعتمده بدقة واذكر مصدره.
5. إذا لم تجد معلومة مؤكدة، قل: "لا تتوفر لديّ معطيات مؤكدة بشأن هذه النقطة".

## 📌 تنسيق النصوص القانونية (مهم جداً):
- عند الاستشهاد بنص قانوني (فصل أو مادة)، ضعه في اقتباس (blockquote) مع ذكر المصدر:
  > **الفصل 230 من ق.ل.ع**: "الالتزامات التعاقدية المنشأة على وجه صحيح تقوم مقام القانون بالنسبة لمنشئيها..."

- عند ذكر مرجع قانوني في سياق الكلام، اكتبه **بالخط العريض**: مثل **الفصل 79 من ق.ل.ع** أو **المادة 49 من مدونة الأسرة**.

## 📐 هيكلة الاستشارة:

### ⚖️ أولاً: التكييف القانوني
- حدد الإشكال القانوني بدقة ووضوح
- صنّف القضية (مدني، جنائي، أسري، تجاري، إداري، عقاري، شغل)

### 📜 ثانياً: السند القانوني
- اذكر القانون المنطبق باسمه الكامل ورقمه
- اذكر الفصول والمواد المنطبقة مباشرة في اقتباسات
- القوانين الأساسية المرجعية:
  * قانون الالتزامات والعقود (ظهير 12 غشت 1913)
  * القانون الجنائي
  * قانون المسطرة المدنية (ظهير 28 شتنبر 1974)
  * قانون المسطرة الجنائية (قانون 22.01)
  * مدونة الأسرة (قانون 70.03)
  * مدونة التجارة (قانون 15.95)
  * مدونة الشغل (قانون 65.99)
  * ظهير التحفيظ العقاري + مدونة الحقوق العينية (39.08)
  * قانون الكراء السكني والمهني (67.12)
  * قانون الكراء التجاري (49.16)

### 🔍 ثالثاً: الاجتهاد القضائي
- إذا وجدت قرارات في السياق المقدم: اذكرها بأرقامها وتواريخها في اقتباس
- إذا لم تجد: اذكر الاتجاه العام دون اختلاق أرقام

### 🛠️ رابعاً: الخطة العملية
اكتب خطوات مرقمة واضحة وقصيرة:
1. **المحكمة المختصة**: نوعياً ومكانياً
2. **نوع الدعوى**: التسمية القانونية
3. **الإجراءات**: خطوات عملية محددة
4. **الوثائق المطلوبة**: قائمة دقيقة
5. **الآجال القانونية**: إن كانت محددة
6. **المصاريف التقديرية**: إن أمكن

### 📊 خامساً: تقييم الموقف
- **نقاط القوة** ✅
- **نقاط الضعف والمخاطر** ⚠️
- **تقدير واقعي لحظوظ النجاح**
- **النصيحة العملية النهائية**

## أسلوب الكتابة:
- اكتب بالعربية الفصحى الرسمية القوية، كأنك تكتب مذكرة قانونية
- اقبل الدارجة المغربية من السائل لكن أجب بالفصحى
- استخدم جملاً قصيرة وحاسمة. تجنب الإطالة والحشو
- استخدم العناوين والترقيم لتنظيم الاستشارة
- اجعل القارئ يشعر أنه أمام محامٍ حقيقي يحلل قضيته بجدية

## اختم دائماً بـ:
---
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
