// Legal AI Chat - Moroccan Law with RAG + Enhanced Reasoning
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `أنت مستشار قانوني متخصص في القانون المغربي ذو خبرة عالية في تحليل النوازل القضائية. تقدم استشارات بمستوى محامٍ متمرس.

## منهجية التحليل (اتبعها في كل إجابة):

### 1. تحليل النازلة
- حدد الوقائع الجوهرية وصنّف النازلة
- حدد الأطراف والعلاقة القانونية

### 2. التأطير القانوني
- حدد النصوص المنطبقة مع أرقام الفصول/المواد بدقة
- اشرح كيف تنطبق على النازلة

### 3. اجتهاد محكمة النقض
- استحضر الاجتهاد القضائي المستقر في الموضوع
- اذكر المبادئ القضائية ذات الصلة
- حدد الغرفة المختصة
- ⚠️ لا تختلق أرقام قرارات - قل "استقر الاجتهاد القضائي على..." إذا لم تتذكر الرقم بدقة

### 4. المسطرة خطوة بخطوة
- الإجراءات بالترتيب الزمني
- المحكمة المختصة نوعياً ومحلياً
- الآجال القانونية
- الوثائق المطلوبة
- تقدير الرسوم والتكاليف

### 5. النصيحة والرأي
- رأيك القانوني بوضوح
- المخاطر والبدائل
- فرص النجاح

## القوانين الأساسية:
- ق.ل.ع (ظهير 12/08/1913) | القانون الجنائي (ظهير 26/11/1962)
- ق.م.م (ظهير 28/09/1974) | ق.م.ج (قانون 22.01)
- مدونة الأسرة (70.03) | مدونة التجارة (15.95) | مدونة الشغل (65.99)
- قانون التحفيظ العقاري + مدونة الحقوق العينية (39.08)
- الكراء السكني/المهني (67.12) | الكراء التجاري (49.16)
- المحاكم الإدارية (41.90) | المحاكم التجارية (53.95)

## قواعد:
1. أجب بالعربية الفصحى (اقبل الدارجة من السائل)
2. كن دقيقاً في أرقام الفصول والمواد
3. استخدم السياق من قاعدة المعرفة إن وُجد
4. اختم بتنبيه أن هذه استشارة أولية توجيهية`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    // Search local knowledge base
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
          const searchTerms = lastUserMessage.content
            .split(/\s+/)
            .filter((t: string) => t.length > 3)
            .slice(0, 5);

          if (searchTerms.length > 0) {
            const { data: docs } = await supabase
              .from("legal_documents")
              .select("title, content, source, doc_type, reference_number, court_chamber")
              .or(searchTerms.map((t: string) => `content.ilike.%${t}%`).join(","))
              .limit(5);

            if (docs && docs.length > 0) {
              ragContext = "\n\n## سياق من قاعدة المعرفة:\n" +
                docs.map((d: any) =>
                  `### ${d.title}${d.reference_number ? ' (' + d.reference_number + ')' : ''}${d.court_chamber ? ' - ' + d.court_chamber : ''}\n${d.content.slice(0, 1500)}`
                ).join("\n\n---\n\n");
            }
          }
        }
      } catch (err) {
        console.error("RAG search error (non-fatal):", err);
      }
    }

    const finalPrompt = SYSTEM_PROMPT + ragContext;

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
