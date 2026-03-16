import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `أنت **محامٍ مغربي متمرس ومساعد ذكي لصياغة المستندات القانونية**. تعمل كمولّد مستندات قانونية احترافي.

## 🧠 طريقة العمل:
1. عندما يصف لك المستخدم ما يريد (حتى بجملة واحدة)، تفهم نوع المستند المطلوب تلقائياً
2. تصوغ المستند القانوني الكامل مباشرة بالشكل الرسمي المعتمد في المحاكم المغربية
3. إذا كان هناك سياق سابق (مستندات سابقة في نفس القضية)، تبني عليه وتحافظ على التسلسل
4. إذا رد الخصم بمذكرة، تعقّب عليها نقطة بنقطة

## 📋 أنواع المستندات التي تصوغها:
- **مقال افتتاحي**: يتضمن الديباجة، هوية الأطراف، الوقائع، الأساس القانوني، المناقشة، الطلبات
- **مذكرة جوابية**: ملخص ادعاءات الخصم، الرد على كل ادعاء، النصوص القانونية، الطلبات
- **مذكرة تعقيبية**: دحض حجج الخصم نقطة بنقطة، حجج إضافية، تأكيد الطلبات
- **مقال بالاستئناف**: بيانات الحكم المستأنف، أسباب الاستئناف، المناقشة، الطلبات
- **مقال بالنقض**: بيانات القرار، وسائل النقض، المناقشة
- **إنذار بالإفراغ/بالأداء**: بيانات الأطراف، السبب، المهلة، التحذير
- **رسالة صلح**: بيانات الحادث، الأضرار، طلب التعويض
- **مذكرة المطالبة المدنية**: الوقائع الجرمية، الأضرار، طلبات التعويض

## ⛔ قواعد صارمة:
- اكتب بالعربية الفصحى القانونية المغربية
- استخدم المصطلحات الرسمية المعتمدة في المحاكم المغربية
- لا تستخدم markdown (لا # ولا ** ولا *). اكتب نصاً قانونياً عادياً منسقاً وجاهزاً للطباعة
- ادخل مباشرة في صياغة المستند دون مقدمات أو شروحات
- إذا كانت المعلومات ناقصة، ضع [...] مكان المعلومة الناقصة (مثل: [عنوان الموكل])
- حافظ على نفس الأطراف والوقائع عبر كل مستندات نفس القضية
- استخدم أسلوب المرافعات القوي المقنع
- استشهد بالفصول والمواد القانونية المنطبقة

## 📚 المرجعية القانونية:
- قانون الالتزامات والعقود (ق.ل.ع)
- مدونة الأسرة (70.03)
- مدونة الشغل (65.99)
- القانون الجنائي + المسطرة الجنائية
- المسطرة المدنية
- القانون العقاري
- مدونة التجارة
- القانون 67.12 (الكراء السكني)
- ظهير 24 ماي 1955 (الكراء التجاري)`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, threadContext } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    // Build system prompt with thread context if available
    let finalSystemPrompt = SYSTEM_PROMPT;

    if (threadContext) {
      finalSystemPrompt += `\n\n## 📂 سياق القضية الحالية:`;
      if (threadContext.clientName) finalSystemPrompt += `\n- الموكل: ${threadContext.clientName}`;
      if (threadContext.opposingParty) finalSystemPrompt += `\n- الخصم: ${threadContext.opposingParty}`;
      if (threadContext.court) finalSystemPrompt += `\n- المحكمة: ${threadContext.court}`;
      if (threadContext.caseNumber) finalSystemPrompt += `\n- رقم الملف: ${threadContext.caseNumber}`;

      if (threadContext.previousDocs && threadContext.previousDocs.length > 0) {
        finalSystemPrompt += `\n\n## 📜 المستندات السابقة في هذه القضية:`;
        for (const doc of threadContext.previousDocs) {
          finalSystemPrompt += `\n\n--- [الخطوة ${doc.step}] ${doc.docType} ---`;
          if (doc.content) {
            const snippet = doc.content.slice(0, 2000);
            finalSystemPrompt += `\n${snippet}`;
          }
          if (doc.opponentMemo) {
            finalSystemPrompt += `\n\n📨 مذكرة الخصم:\n${doc.opponentMemo}`;
          }
        }
        finalSystemPrompt += `\n\nبناءً على كل ما سبق، يجب أن تكون المستندات الجديدة متسلسلة ومترابطة مع السياق أعلاه.`;
      }
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [
          { role: "system", content: finalSystemPrompt },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "تم تجاوز حد الطلبات، حاول لاحقاً" }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "يرجى إضافة رصيد" }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "خطأ في خدمة الذكاء الاصطناعي" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("generate-legal-doc error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "خطأ غير معروف" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
