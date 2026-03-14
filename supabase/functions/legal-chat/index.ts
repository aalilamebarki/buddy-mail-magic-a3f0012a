// Legal AI Chat with real-time web search for Moroccan court decisions
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `أنت مستشار قانوني متخصص في القانون المغربي ذو خبرة عالية. مهمتك هي تقديم استشارات قانونية دقيقة ومفصلة تقارب مستوى ما يقدمه المحامي المتخصص.

## منهجيتك في الإجابة:

### 1. تحليل النازلة (الوقائع)
- حدد الوقائع الجوهرية من سؤال المستخدم
- صنّف النازلة (مدني، جنائي، أسري، تجاري، عقاري، شغل، إداري)
- حدد الأطراف والعلاقة القانونية بينهم

### 2. التأطير القانوني
- حدد النصوص القانونية المنطبقة مع ذكر أرقام الفصول والمواد بدقة
- اشرح كيف تنطبق هذه النصوص على النازلة المعروضة
- ميّز بين النصوص العامة والخاصة

### 3. الاجتهاد القضائي
- استحضر قرارات محكمة النقض ذات الصلة
- اذكر الغرفة المختصة (مدنية، تجارية، جنائية، أحوال شخصية، إدارية، اجتماعية)
- وضّح المبدأ القانوني المستخلص من كل قرار
- قارن بين النازلة المعروضة والنوازل المماثلة في الاجتهاد القضائي

### 4. المسطرة العملية
- اشرح الخطوات الإجرائية بالتفصيل وبالترتيب
- حدد المحكمة المختصة نوعياً ومحلياً
- اذكر الآجال القانونية الواجب احترامها
- حدد الوثائق والمستندات المطلوبة
- قدّر التكاليف والرسوم القضائية إن أمكن

### 5. النصيحة القانونية
- قدم رأيك القانوني بوضوح
- نبّه إلى المخاطر القانونية
- اقترح البدائل الممكنة
- حدد فرص النجاح بشكل واقعي

## القوانين الأساسية التي تعتمد عليها:
- **ق.ل.ع** (قانون الالتزامات والعقود - ظهير 12 أغسطس 1913)
- **القانون الجنائي** (ظهير 26 نونبر 1962)
- **قانون المسطرة المدنية** (ظهير 28 شتنبر 1974)
- **قانون المسطرة الجنائية** (قانون 22.01)
- **مدونة الأسرة** (قانون 70.03)
- **مدونة التجارة** (قانون 15.95)
- **مدونة الشغل** (قانون 65.99)
- **القانون العقاري**: ظهير التحفيظ العقاري + مدونة الحقوق العينية (قانون 39.08)
- **قانون الكراء السكني والمهني** (قانون 67.12)
- **قانون الكراء التجاري** (قانون 49.16)
- **قانون المحاكم الإدارية** (قانون 41.90)
- **قانون المحاكم التجارية** (قانون 53.95)

## غرف محكمة النقض:
- الغرفة المدنية | الغرفة التجارية | الغرفة الجنائية
- غرفة الأحوال الشخصية والميراث | الغرفة الإدارية | الغرفة الاجتماعية

## قواعد صارمة:
1. أجب باللغة العربية الفصحى (اقبل الدارجة المغربية من السائل)
2. لا تختلق أرقام قرارات أو أحكام - إذا لم تكن متأكداً، قل "هناك اجتهاد قضائي مستقر في هذا الاتجاه" دون اختلاق أرقام
3. استخدم السياق المقدم من قاعدة المعرفة القانونية إن وُجد
4. كن دقيقاً في أرقام الفصول والمواد
5. في نهاية كل إجابة، ذكّر أن هذه استشارة أولية توجيهية

## إذا تم تزويدك بسياق من قاعدة المعرفة:
- اعتمد عليه بشكل أساسي في إجابتك
- اذكر المصادر والمراجع الواردة فيه
- قارن النازلة المعروضة بالقرارات الواردة في السياق`;

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

    // Get the last user message for context enrichment
    const lastUserMessage = [...messages].reverse().find((m: any) => m.role === "user");
    let ragContext = "";

    // Search local knowledge base
    if (lastUserMessage) {
      try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const supabase = createClient(supabaseUrl, supabaseKey);

        // Check if we have any documents at all
        const { count } = await supabase
          .from("legal_documents")
          .select("*", { count: "exact", head: true });

        if (count && count > 0) {
          // Simple text search as fallback (more reliable than vector search without proper embeddings)
          const searchTerms = lastUserMessage.content.split(/\s+/).filter((t: string) => t.length > 3).slice(0, 5);
          
          if (searchTerms.length > 0) {
            const { data: docs } = await supabase
              .from("legal_documents")
              .select("title, content, source, doc_type, reference_number, court_chamber")
              .or(searchTerms.map((t: string) => `content.ilike.%${t}%`).join(","))
              .limit(5);

            if (docs && docs.length > 0) {
              ragContext = "\n\n## سياق من قاعدة المعرفة القانونية المحلية:\n" +
                docs.map((d: any) =>
                  `### ${d.title}${d.reference_number ? ' (رقم: ' + d.reference_number + ')' : ''}${d.court_chamber ? ' - ' + d.court_chamber : ''}\nالنوع: ${d.doc_type}\n${d.content.slice(0, 1500)}`
                ).join("\n\n---\n\n");
            }
          }
        }
      } catch (err) {
        console.error("RAG search error (non-fatal):", err);
      }
    }

    // Step 1: Use a separate AI call to research the legal question
    let researchContext = "";
    if (lastUserMessage) {
      try {
        const researchResponse = await fetch(
          "https://ai.gateway.lovable.dev/v1/chat/completions",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${LOVABLE_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "google/gemini-2.5-flash",
              messages: [
                {
                  role: "system",
                  content: `أنت باحث قانوني مغربي. مهمتك هي البحث عن:
1. النصوص القانونية المغربية المنطبقة (مع أرقام الفصول)
2. قرارات محكمة النقض المغربية ذات الصلة (مع أرقام القرارات والتواريخ إن أمكن)
3. المبادئ القضائية المستقرة في الموضوع

أجب بشكل مختصر ومنظم. ركز فقط على المعلومات القانونية الدقيقة.`,
                },
                {
                  role: "user",
                  content: `ابحث عن النصوص القانونية المغربية وقرارات محكمة النقض المتعلقة بهذه النازلة: ${lastUserMessage.content}`,
                },
              ],
            }),
          }
        );

        if (researchResponse.ok) {
          const researchData = await researchResponse.json();
          researchContext = researchData.choices?.[0]?.message?.content || "";
          if (researchContext) {
            researchContext = "\n\n## نتائج البحث القانوني:\n" + researchContext;
          }
        }
      } catch (err) {
        console.error("Research step error (non-fatal):", err);
      }
    }

    const enrichedSystemPrompt = SYSTEM_PROMPT + ragContext + researchContext;

    // Step 2: Generate the final response with all context
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
            { role: "system", content: enrichedSystemPrompt },
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
