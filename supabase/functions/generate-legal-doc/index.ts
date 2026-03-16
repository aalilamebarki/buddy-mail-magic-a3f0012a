import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `أنت **محامٍ مغربي متمرس ومساعد ذكي لصياغة المستندات القانونية**. تعمل كمولّد مستندات قانونية احترافي.

## 🧠 طريقة العمل:
1. عندما يصف لك المستخدم ما يريد (حتى بجملة واحدة)، تفهم نوع المستند المطلوب تلقائياً وتصوغه مباشرة
2. لديك بيانات الموكل والمحكمة جاهزة (ستُعطى لك في السياق). استخدمها تلقائياً في المستند
3. إذا كان هناك سياق سابق (مستندات سابقة في نفس القضية)، ابنِ عليه
4. إذا رد الخصم بمذكرة (ستُلصق في الرسالة)، عقّب عليها نقطة بنقطة

## 📋 أنواع المستندات:
- **مقال افتتاحي**: ديباجة، هوية الأطراف الكاملة، وقائع، أساس قانوني، مناقشة، طلبات
- **مذكرة جوابية**: ملخص ادعاءات الخصم، رد مفصل، نصوص قانونية
- **مذكرة تعقيبية**: دحض حجج الخصم نقطة بنقطة، حجج إضافية
- **مقال بالاستئناف**: بيانات الحكم المستأنف، أسباب الاستئناف المفصلة
- **مقال بالنقض**: وسائل النقض، مناقشة مفصلة
- **إنذار بالإفراغ/بالأداء**: بيانات الأطراف، السبب، المهلة، التحذير
- **رسالة صلح**: بيانات الحادث، الأضرار، طلب التعويض
- **مذكرة المطالبة المدنية**: الوقائع الجرمية، الأضرار، طلبات التعويض

## ⛔ قواعد صارمة:
- اكتب بالعربية الفصحى القانونية المغربية الرسمية
- استخدم المصطلحات القانونية المعتمدة في المحاكم المغربية
- لا تستخدم markdown (لا # ولا ** ولا *). اكتب نصاً قانونياً عادياً جاهزاً للطباعة
- ادخل مباشرة في صياغة المستند. لا مقدمات ولا شروحات
- استخدم بيانات الموكل والمحكمة المقدمة تلقائياً (الاسم، العنوان، CIN، المحكمة، الموجه إليه)
- إذا كانت معلومة ناقصة، ضع [...] مكانها
- حافظ على نفس الأطراف والوقائع عبر كل مستندات نفس القضية
- استشهد بالفصول والمواد القانونية المنطبقة

## 📚 المرجعية القانونية:
- ق.ل.ع (ظهير 12 غشت 1913) - المسؤولية والعقود
- مدونة الأسرة (70.03) - الأحوال الشخصية
- مدونة الشغل (65.99) - علاقات العمل
- القانون الجنائي + المسطرة الجنائية
- المسطرة المدنية (ظهير 28 شتنبر 1974)
- القانون العقاري + ظهير التحفيظ
- مدونة التجارة (15.95)
- القانون 67.12 (الكراء السكني) + ظهير 24 ماي 1955 (الكراء التجاري)
- القانون 41.90 (المحاكم الإدارية)`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, threadContext } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    let finalSystemPrompt = SYSTEM_PROMPT;

    if (threadContext) {
      finalSystemPrompt += `\n\n## 📂 بيانات القضية الحالية (استخدمها تلقائياً في المستند):`;
      
      // Client info
      if (threadContext.clientName) {
        finalSystemPrompt += `\n\n### بيانات الموكل:`;
        finalSystemPrompt += `\n- الاسم الكامل: ${threadContext.clientName}`;
        if (threadContext.clientCIN) finalSystemPrompt += `\n- رقم البطاقة الوطنية (CIN): ${threadContext.clientCIN}`;
        if (threadContext.clientAddress) finalSystemPrompt += `\n- العنوان: ${threadContext.clientAddress}`;
        if (threadContext.clientPhone) finalSystemPrompt += `\n- الهاتف: ${threadContext.clientPhone}`;
      }

      // Opposing party
      if (threadContext.opposingParty) {
        finalSystemPrompt += `\n\n### بيانات الخصم:`;
        finalSystemPrompt += `\n- الاسم: ${threadContext.opposingParty}`;
      }

      // Court info
      if (threadContext.court) {
        finalSystemPrompt += `\n\n### بيانات المحكمة:`;
        finalSystemPrompt += `\n- المحكمة: ${threadContext.court}`;
        if (threadContext.courtAddress) finalSystemPrompt += `\n- عنوان المحكمة: ${threadContext.courtAddress}`;
        if (threadContext.courtAddressee) finalSystemPrompt += `\n- يوجه الطلب إلى: ${threadContext.courtAddressee}`;
      }

      if (threadContext.caseNumber) {
        finalSystemPrompt += `\n- رقم الملف: ${threadContext.caseNumber}`;
      }

      // Previous documents in thread
      if (threadContext.previousDocs && threadContext.previousDocs.length > 0) {
        finalSystemPrompt += `\n\n## 📜 المستندات السابقة في هذه المسطرة (ابنِ عليها):`;
        for (const doc of threadContext.previousDocs) {
          finalSystemPrompt += `\n\n--- [الخطوة ${doc.step}] ${doc.docType} ---`;
          if (doc.content) finalSystemPrompt += `\n${doc.content}`;
          if (doc.opponentMemo) finalSystemPrompt += `\n\n📨 مذكرة الخصم:\n${doc.opponentMemo}`;
        }
        finalSystemPrompt += `\n\nيجب أن تكون المستندات الجديدة متسلسلة ومترابطة مع السياق أعلاه. حافظ على نفس الأطراف والوقائع.`;
      }

      // Style learning from previous finalized docs
      if (threadContext.styleReference && threadContext.styleReference.length > 0) {
        finalSystemPrompt += `\n\n## 🎨 الأسلوب المفضل (تعلّم من المستندات السابقة):`;
        finalSystemPrompt += `\nهذه مقتطفات من مستندات سابقة للمستخدم. حاكِ أسلوبها في الصياغة والتنسيق:`;
        for (const snippet of threadContext.styleReference) {
          if (snippet) finalSystemPrompt += `\n---\n${snippet}\n`;
        }
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
