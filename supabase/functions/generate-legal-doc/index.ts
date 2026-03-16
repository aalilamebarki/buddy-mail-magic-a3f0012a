import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const DOC_TYPE_PROMPTS: Record<string, string> = {
  "مقال افتتاحي": `أنت محامٍ مغربي متمرس ذو خبرة واسعة أمام المحاكم المغربية. أنشئ مقالاً افتتاحياً (requête introductive d'instance) وفق الشكل الرسمي المعتمد في المحاكم المغربية. يجب أن يتضمن:
- الديباجة (بسم الله الرحمن الرحيم، الحمد لله وحده)
- إلى السيد رئيس المحكمة / السيد القاضي المقرر
- هوية الأطراف (المدعي والمدعى عليه) بشكل كامل
- عرض الوقائع بشكل مفصل ومتسلسل زمنياً
- الأساس القانوني مع الإشارة إلى النصوص القانونية المطبقة (الفصول والمواد)
- المناقشة القانونية
- الطلبات (بناءً عليه / لهذه الأسباب)
- التوقيع والمرفقات`,

  "مذكرة جوابية": `أنت محامٍ مغربي متمرس. أنشئ مذكرة جوابية (mémoire en réponse) للرد على ادعاءات الخصم بأسلوب قانوني محكم. يجب أن تتضمن:
- الديباجة الرسمية مع بيانات الملف
- ملخص دقيق لادعاءات الخصم
- مناقشة تفصيلية لكل ادعاء والرد عليه بالحجج القانونية والواقعية
- الاستشهاد بالنصوص القانونية والاجتهاد القضائي لمحكمة النقض
- دحض أدلة الخصم
- الطلبات الختامية`,

  "مذكرة تعقيبية": `أنت محامٍ مغربي متمرس. أنشئ مذكرة تعقيبية (mémoire en réplique) للتعقيب على المذكرة الجوابية للخصم بأسلوب قوي ومقنع. يجب أن تتضمن:
- الإشارة إلى كون هذه المذكرة تأتي تعقيباً على مذكرة الخصم
- ملخص ما جاء في مذكرة الخصم الجوابية
- دحض حججه نقطة بنقطة بأدلة قانونية وواقعية
- تعزيز الموقف بحجج إضافية وسوابق قضائية
- الإشارة إلى تناقضات الخصم إن وجدت
- تأكيد الطلبات السابقة أو تعديلها`,

  "مقال بالاستئناف": `أنت محامٍ مغربي متمرس. أنشئ مقالاً استئنافياً (requête d'appel) وفق الشكل الرسمي. يجب أن يتضمن:
- الديباجة الرسمية
- بيانات الحكم المستأنف (رقمه، تاريخه، المحكمة المصدرة)
- أسباب الاستئناف مفصلة (خرق القانون، سوء التطبيق، التعليل الناقص، الخطأ في تقدير الوقائع...)
- مناقشة تفصيلية لكل سبب مع الاستشهاد بالنصوص والاجتهاد
- الطلبات (إلغاء الحكم أو تعديله)`,

  "مقال بالنقض": `أنت محامٍ مغربي متمرس. أنشئ عريضة نقض (pourvoi en cassation) وفق الشكل الرسمي المعتمد أمام محكمة النقض المغربية. يجب أن تتضمن:
- الديباجة الرسمية
- بيانات القرار المطعون فيه
- وسائل النقض (خرق القانون، انعدام الأساس القانوني، خرق حقوق الدفاع، انعدام التعليل، تحريف الوقائع...)
- مناقشة مفصلة لكل وسيلة مع الإشارة إلى السوابق القضائية
- الطلبات`,

  "مذكرة المطالبة المدنية": `أنت محامٍ مغربي متمرس. أنشئ مذكرة مطالبة مدنية (constitution de partie civile) أمام القضاء الجنائي. يجب أن تتضمن:
- بيانات المشتكي (الطرف المدني)
- عرض الوقائع الجرمية
- الأضرار المادية والمعنوية
- الأساس القانوني (القانون الجنائي + قانون المسطرة الجنائية)
- طلبات التعويض المفصلة`,

  "مقال الدخل الارادي": `أنت محامٍ مغربي متمرس. أنشئ مقال التدخل الإرادي في الدعوى (requête d'intervention volontaire). يجب أن يتضمن:
- بيانات الدعوى الأصلية (رقم الملف، الأطراف)
- صفة المتدخل ومصلحته
- أسباب التدخل
- الطلبات`,

  "إنذار بالإفراغ": `أنت محامٍ مغربي متمرس. أنشئ إنذاراً بالإفراغ للاحتلال بدون سند قانوني (mise en demeure de quitter les lieux). يجب أن يتضمن:
- بيانات المالك والمحتل
- وصف العقار
- الإشارة إلى انعدام أي سند قانوني للاحتلال
- المهلة الممنوحة للإفراغ
- التحذير باللجوء إلى القضاء`,

  "إنذار بالأداء": `أنت محامٍ مغربي متمرس. أنشئ إنذاراً بالأداء (mise en demeure de payer). يجب أن يتضمن:
- بيانات الدائن والمدين
- أصل الدين وسببه
- المبلغ المطالب به
- المهلة الممنوحة للأداء
- التحذير باللجوء إلى القضاء مع المطالبة بالتعويض عن التماطل`,

  "رسالة صلح تأمين": `أنت محامٍ مغربي متمرس. أنشئ رسالة صلح موجهة إلى شركة تأمين (lettre de règlement amiable). يجب أن تتضمن:
- بيانات المؤمَّن له ورقم البوليصة
- ظروف الحادث أو الواقعة
- الأضرار المادية والجسدية
- المستندات المرفقة
- طلب التعويض مع تفصيل المبالغ
- الإشارة إلى إمكانية اللجوء للقضاء في حالة عدم الاستجابة`,
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { docType, formData, attachmentContents, opponentMemo, threadHistory } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const systemPrompt = DOC_TYPE_PROMPTS[docType] || DOC_TYPE_PROMPTS["مقال افتتاحي"];

    // Build context-rich prompt
    let userPrompt = `بيانات المستند:\n`;
    if (formData.clientName) userPrompt += `- الموكل: ${formData.clientName}\n`;
    if (formData.opposingParty) userPrompt += `- الخصم: ${formData.opposingParty}\n`;
    if (formData.court) userPrompt += `- المحكمة: ${formData.court}\n`;
    if (formData.caseNumber) userPrompt += `- رقم الملف: ${formData.caseNumber}\n`;
    if (formData.subject) userPrompt += `- الموضوع: ${formData.subject}\n`;
    if (formData.facts) userPrompt += `\nالوقائع:\n${formData.facts}\n`;
    if (formData.requests) userPrompt += `\nالطلبات:\n${formData.requests}\n`;
    if (formData.additionalNotes) userPrompt += `\nملاحظات إضافية:\n${formData.additionalNotes}\n`;

    // Include full thread history for context
    if (threadHistory && threadHistory.length > 0) {
      userPrompt += `\n\n========== سياق القضية - المستندات السابقة ==========\n`;
      for (const entry of threadHistory) {
        userPrompt += `\n--- [الخطوة ${entry.step}] ${entry.docType} ---\n`;
        if (entry.content) {
          userPrompt += `محتوى المستند:\n${entry.content}\n`;
        }
        if (entry.opponentMemo) {
          userPrompt += `\nرد الخصم / مذكرة الخصم:\n${entry.opponentMemo}\n`;
        }
      }
      userPrompt += `\n========== نهاية السياق ==========\n`;
      userPrompt += `\nبناءً على كل ما سبق من مستندات ومذكرات في هذه القضية، قم بصياغة ${docType} يأخذ بعين الاعتبار جميع الحجج السابقة ويرد على آخر مذكرة للخصم بشكل محكم ومقنع.\n`;
      userPrompt += `يجب أن تكون الردود متسلسلة ومترابطة مع ما سبق، وأن تبني على الحجج القانونية التي تم تقديمها سابقاً.\n`;
    }

    if (attachmentContents && attachmentContents.length > 0) {
      userPrompt += `\n--- وثائق مرفقة ---\n`;
      for (const att of attachmentContents) {
        userPrompt += `\n[${att.name}]:\n${att.content}\n`;
      }
      userPrompt += `\nقم بدراسة هذه الوثائق واعتمد عليها في صياغة المستند.\n`;
    }

    if (opponentMemo) {
      userPrompt += `\n--- مذكرة الخصم الحالية المطلوب الرد عليها ---\n${opponentMemo}\n`;
      userPrompt += `\nقم بالرد على هذه المذكرة نقطة بنقطة وتفنيد جميع حججها بأدلة قانونية وواقعية قوية.\n`;
    }

    const messages = [
      { 
        role: "system", 
        content: systemPrompt + `\n\nتعليمات مهمة:
- اكتب المستند بالعربية الفصحى القانونية المعتمدة في المحاكم المغربية.
- استخدم المصطلحات القانونية الدقيقة المعتمدة في القضاء المغربي.
- لا تستخدم markdown أو أي ترميز. اكتب نصاً قانونياً منسقاً جاهزاً للطباعة.
- استخدم الأسلوب القانوني الرسمي المعتمد في المرافعات.
- إذا كان هناك سياق قضية سابق، يجب أن تكون المذكرة متسلسلة ومترابطة مع المستندات السابقة.
- حافظ على نفس الأطراف والوقائع والطلبات عبر كل مستندات القضية.`
      },
      { role: "user", content: userPrompt },
    ];

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages,
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
