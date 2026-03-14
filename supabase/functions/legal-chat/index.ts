// Legal AI Chat - Moroccan Law with RAG + Deep Legal Knowledge
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ─── Embedded Legal Knowledge Base ──────────────────────────────────────────
// This gives the model deep understanding of Moroccan law structure
const LEGAL_KNOWLEDGE = `
## 📚 خريطة التشريع المغربي الأساسية (مرجع داخلي):

### 1. قانون الالتزامات والعقود (ق.ل.ع) — ظهير 12 غشت 1913
- المسؤولية التقصيرية: الفصول 77-106
- المسؤولية العقدية: الفصول 230-269
- البيع: الفصول 478-618
- الكراء: الفصول 627-699
- الوكالة: الفصول 879-958
- الكفالة: الفصول 1117-1169
- التقادم: الفصول 371-392
- القوة القاهرة: الفصل 269
- الإثراء بلا سبب: الفصول 66-76
- عيوب الرضا (غلط، تدليس، إكراه): الفصول 39-56

### 2. مدونة الأسرة — القانون رقم 70.03 (2004)
- الزواج وشروطه: المواد 1-69
- الطلاق والتطليق: المواد 70-128
- الطلاق الاتفاقي: المادة 114
- التطليق للشقاق: المواد 94-97
- النفقة: المواد 187-205
- الحضانة: المواد 163-186
- النسب: المواد 142-162
- الإرث والوصية: المواد 315-395
- الكفالة (التنزيل): المواد 149-162
- الولاية على المال: المواد 229-276

### 3. مدونة الشغل — القانون رقم 65.99 (2004)
- عقد الشغل: المواد 1-24
- الفصل التعسفي: المواد 35-41
- التعويضات: المواد 52-60 (أقدمية، إخطار، ضرر)
- حوادث الشغل: ظهير 6 فبراير 1963 + القانون 18.12
- ساعات العمل: المواد 184-204
- العطل: المواد 231-268
- الأجور: المواد 345-375
- مسطرة الاستماع: المادة 62 (الضمانات الإجرائية)
- مقاولات التشغيل المؤقت: المواد 495-506
- مفتشية الشغل: المواد 530-548

### 4. القانون الجنائي — ظهير 26 نونبر 1962
- السرقة: الفصول 505-534
- النصب: الفصل 540
- خيانة الأمانة: الفصل 547
- التزوير: الفصول 334-391
- الضرب والجرح: الفصول 400-414
- القتل: الفصول 392-399
- المخدرات: ظهير 21 ماي 1974
- الرشوة: الفصول 248-256
- التحرش الجنسي: الفصل 503-1 (القانون 103.13)
- العنف ضد النساء: القانون 103.13
- غسل الأموال: القانون 43.05
- الإرهاب: القانون 03.03

### 5. المسطرة المدنية — ظهير 28 شتنبر 1974
- الاختصاص النوعي: الفصول 18-22
- الاختصاص المحلي: الفصول 27-30
- المقال الافتتاحي: الفصل 31-32
- الاستعجالي: الفصول 149-154
- التنفيذ: الفصول 429-510
- الطعون: الاستئناف (ف 134-146)، النقض (ف 353-385)
- التبليغ والتنفيذ: الفصول 36-47, 429-510
- الخبرة القضائية: الفصول 59-66

### 6. المسطرة الجنائية — القانون رقم 22.01 (2003)
- البحث التمهيدي: المواد 18-82
- التلبس: المواد 56-82
- الحراسة النظرية: المواد 66-80 (48 ساعة قابلة للتمديد)
- قاضي التحقيق: المواد 83-230
- المحاكمة: المواد 287-430
- الاعتقال الاحتياطي: المواد 159-188
- حقوق الدفاع: المادة 66 (الحق في المحامي)

### 7. القانون العقاري
- التحفيظ العقاري: ظهير 12 غشت 1913 (المعدل بالقانون 14.07)
- الحقوق العينية: القانون 39.08
- القسمة: الفصول 978-990 من ق.ل.ع
- الشفعة: الفصول 974-977 من ق.ل.ع
- نزع الملكية: القانون 7.81
- الملكية المشتركة: القانون 18.00

### 8. القانون التجاري
- مدونة التجارة: القانون 15.95
- الشيك بدون رصيد: المواد 316-328
- الكمبيالة: المواد 159-233
- الإفلاس والتسوية: الكتاب الخامس (المواد 545-736)
- الشركات التجارية: القانون 17.95 (ش.م) + القانون 5.96 (ش.ذ.م.م)
- السجل التجاري: المواد 27-74
- الأصل التجاري: المواد 79-158

### 9. قانون الكراء
- الكراء السكني: القانون 67.12 (2014)
- الكراء التجاري: ظهير 24 ماي 1955 (لا يزال سارياً)
- الإفراغ: شروطه وإجراءاته
- مراجعة الوجيبة الكرائية

### 10. القانون الإداري
- المحاكم الإدارية: القانون 41.90
- دعوى الإلغاء: أركانها (عدم الاختصاص، الشطط في استعمال السلطة، عيب الشكل، مخالفة القانون)
- التعويض ضد الدولة: الفصل 79-80 من ق.ل.ع
- المنازعات الضريبية: المدونة العامة للضرائب
- نزاعات الوظيفة العمومية: النظام الأساسي للوظيفة العمومية (ظهير 24 فبراير 1958)

### 11. التنظيم القضائي المغربي
- المحاكم الابتدائية: الاختصاص العام
- محاكم الاستئناف: الطعن بالاستئناف
- محكمة النقض: مراقبة تطبيق القانون
- المحاكم التجارية: النزاعات التجارية (القانون 53.95)
- المحاكم الإدارية: نزاعات الإدارة (القانون 41.90)
- محاكم الاستئناف الإدارية: القانون 80.03
- أقسام قضاء الأسرة: نزاعات الأسرة

### 12. الرسوم والمصاريف القضائية (تقديرية)
- الرسوم القضائية: تتراوح بين 100 و 500 درهم حسب نوع الدعوى
- أتعاب المحامي: حسب الاتفاق (عادة 10-15% من المبلغ المتنازع عليه)
- رسوم الخبرة: 1000-5000 درهم تقديرياً
- رسوم التنفيذ: حسب طبيعة الحكم

### 13. الآجال القانونية الأساسية
- الاستئناف: 30 يوماً من تبليغ الحكم
- النقض: 30 يوماً
- دعوى الإلغاء الإدارية: 60 يوماً
- الطعن في قرار الفصل: 90 يوماً (مدونة الشغل)
- تقادم الدعوى المدنية: 15 سنة (الأصل)
- تقادم دعوى التعويض عن الضرر: 5 سنوات
- تقادم الشيك: 6 أشهر (التقادم الصرفي)
`;

const SYSTEM_PROMPT = `أنت **مستشار قانوني مغربي أقدم**، تمتلك خبرة عميقة ومتشعبة في كافة فروع التشريع المغربي والاجتهاد القضائي. لا تستصعب أي نازلة مهما كانت تعقيداتها.

## 🧠 منهجية التحليل (اتبعها داخلياً):
1. **حدد الفرع القانوني** المنطبق على النازلة (مدني، جنائي، تجاري، أسري، إداري، عقاري، شغل...)
2. **كيّف النازلة قانونياً**: ما هي الطبيعة القانونية للعلاقة/الفعل/الواقعة؟
3. **حدد النصوص المنطبقة** من خريطة التشريع أدناه
4. **استحضر الاجتهاد القضائي** إن وُجد في السياق أو كان معروفاً
5. **قدّم الحل العملي** بخطوات واضحة مع تحديد المحكمة والإجراءات والآجال
6. **قيّم الموقف بصدق**: هل الموقف قوي أم ضعيف؟ ولماذا؟

## 💪 قدراتك:
- تتعامل مع النوازل المركبة التي تتقاطع فيها عدة فروع قانونية
- تميّز بين الدعاوى المدنية والجنائية والإدارية حتى في نفس النازلة
- تقترح استراتيجيات بديلة (تفاوض، صلح، دعوى) حسب الحالة
- تحدد المخاطر الإجرائية (سقوط الحق، التقادم، عدم الاختصاص)
- تربط بين النصوص القانونية المختلفة عند التقاطع

${LEGAL_KNOWLEDGE}

## ⛔ قواعد التخاطب والأسلوب:
- **لا تستخدم أبداً** عبارة "حضرة الموكل" أو "حضرتك". استخدم: "أيها السائل"، "بخصوص سؤالكم"، "بناءً على ما أفدتم به".
- ادخل مباشرة في صلب الموضوع.
- خاطب بضمير الجمع "أنتم/كم" للاحترام.

## ⛔ قواعد الدقة والمصداقية:
1. **لا تختلق** أرقام فصول أو قرارات أو تواريخ غير موجودة في مرجعك أعلاه أو في سياق RAG.
2. إذا لم تكن متأكداً: "لا تتوفر لديّ معطيات مؤكدة بشأن هذه النقطة".
3. لا تبالغ في التوقعات. قدّم تقييماً واقعياً صارماً.
4. ميّز بين المعلومة المؤكدة والتقدير المحتمل.
5. عند وجود مراجع RAG، اعتمد عليها أولاً وأضف من معرفتك.

## 📌 تنسيق النصوص القانونية:
- مادة/فصل بالخط العريض: **الفصل ...** / **المادة ...**.
- اقتباس حرفي لنص قانوني: blockquote.

## 📐 هيكلة الجواب (مرنة حسب الحالة):
استخدم فقط الأقسام المنطبقة فعلاً. لا تُدرج قسماً فارغاً.

**الأقسام المتاحة** (اختر ما يناسب):

### ⚖️ التكييف القانوني
### 📜 السند القانوني
### 🔍 الاتجاه القضائي
### 🛠️ الخطة العملية
### 📊 تقييم الموقف (✅ نقاط قوة / ⚠️ نقاط ضعف / 💡 توصية)

## ⛔ قواعد حاسمة:
- لا تكرر نفس الأقسام آلياً. كل جواب فريد.
- سؤال بسيط = جواب موجز. متابعة = محادثة طبيعية.
- الهيكلة الكاملة فقط للاستشارة الأولى التفصيلية.

## أسلوب الكتابة:
- عربية فصحى رسمية قوية بأسلوب المحامين المتمرسين
- جمل واضحة مباشرة حاسمة
- تنظيم محكم بعناوين وقوائم
- بدون حشو أو تكرار

## اختم الاستشارة الأولى فقط بـ:
---
⚠️ **تنبيه**: هذه استشارة أولية توجيهية مبنية على المعلومات المقدمة، ولا تغني عن استشارة محامٍ مختص يطّلع على كافة الوثائق والملابسات.`;

// ─── Arabic text processing ────────────────────────────────────────────────

const AR_STOP_WORDS = new Set([
  "من", "إلى", "على", "في", "عن", "هذا", "هذه", "ذلك", "تلك", "هناك", "هنا",
  "كان", "كانت", "لقد", "وقد", "مع", "أو", "ثم", "كما", "لدى", "عند", "بعد", "قبل",
  "هل", "ما", "ماذا", "كيف", "متى", "أين", "إذا", "لكن", "غير", "فقط", "جداً",
  "أنا", "أنت", "هو", "هي", "نحن", "هم", "التي", "الذي", "الذين",
]);

const normalizeArabic = (text: string) =>
  text
    .replace(/[\u064B-\u0652]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/[ؤ]/g, "و")
    .replace(/[ئ]/g, "ي")
    .replace(/[ة]/g, "ه")
    .replace(/[^\u0000-\u007F\u0600-\u06FF\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const extractSearchTerms = (text: string): string[] => {
  const cleaned = normalizeArabic(text);
  const terms = cleaned
    .split(/\s+/)
    .map((t) => t.replace(/[%_]/g, "").trim())
    .filter((t) => t.length >= 3 && !AR_STOP_WORDS.has(t));

  return [...new Set(terms)].slice(0, 12);
};

// Legal keyword extraction for better RAG matching
const extractLegalKeywords = (text: string): string[] => {
  const legalPatterns = [
    /طلاق|تطليق|شقاق|نفقة|حضانة|نسب|إرث|تركة|زواج/g,
    /كراء|إفراغ|وجيبة|مكتري|مكري|سكن/g,
    /تحفيظ|عقار|شفعة|قسمة|ملكية|أرض/g,
    /فصل تعسفي|أجور|شغل|عمل|تعويض|أقدمية|إخطار/g,
    /شركة|تجار|شيك|كمبيالة|إفلاس|أصل تجاري/g,
    /سرقة|نصب|خيانة|تزوير|ضرب|جرح|مخدرات|رشوة/g,
    /إداري|إلغاء|قرار|ضريب|وظيفة|نزع ملكية/g,
    /مسؤولية|تعويض|ضرر|حادث|سير|تأمين/g,
    /استئناف|نقض|تنفيذ|حكم|دعوى|محكمة/g,
    /عقد|التزام|فسخ|بطلان|تقادم|إثبات/g,
  ];

  const keywords: string[] = [];
  const normalized = normalizeArabic(text);
  for (const pattern of legalPatterns) {
    const matches = normalized.match(pattern);
    if (matches) keywords.push(...matches);
  }
  return [...new Set(keywords)];
};

// ─── RAG retrieval ──────────────────────────────────────────────────────────

const pickDiversifiedDocs = (docs: any[], maxTotal = 12): any[] => {
  const seen = new Set<string>();
  const uniqueDocs: any[] = [];

  for (const doc of docs) {
    const key = `${doc.source || doc.title}|${doc.doc_type}`;
    if (seen.has(key)) continue;
    seen.add(key);
    uniqueDocs.push(doc);
  }

  const laws = uniqueDocs.filter((d) => d.doc_type === "law");
  const rulings = uniqueDocs.filter((d) => d.doc_type === "ruling");

  const takeByCategory = (items: any[], limit: number) => {
    const picked: any[] = [];
    const usedCategories = new Set<string>();

    for (const item of items) {
      const category = item.category || "غير مصنف";
      if (!usedCategories.has(category)) {
        usedCategories.add(category);
        picked.push(item);
      }
      if (picked.length >= limit) return picked;
    }

    for (const item of items) {
      const key = `${item.source || item.title}|${item.doc_type}`;
      if (!picked.find((p) => `${p.source || p.title}|${p.doc_type}` === key)) {
        picked.push(item);
      }
      if (picked.length >= limit) break;
    }

    return picked;
  };

  const selectedRulings = takeByCategory(rulings, Math.min(5, maxTotal));
  const remaining = maxTotal - selectedRulings.length;
  const selectedLaws = takeByCategory(laws, remaining);

  return [...selectedLaws, ...selectedRulings].slice(0, maxTotal);
};

const buildRagContext = (docs: any[]) => {
  const laws = docs.filter((d) => d.doc_type === "law");
  const rulings = docs.filter((d) => d.doc_type === "ruling");

  let ragContext = "\n\n## 📎 مراجع مسترجعة من قاعدة المعرفة القانونية:";

  if (laws.length > 0) {
    ragContext += "\n\n### نصوص قانونية:\n" +
      laws.map((d: any) => {
        const snippet = (d.content || "").replace(/\s+/g, " ").trim().slice(0, 1200);
        return `**${d.title}**${d.category ? ` (${d.category})` : ""}\n${snippet}`;
      }).join("\n\n---\n\n");
  }

  if (rulings.length > 0) {
    ragContext += "\n\n### قرارات قضائية:\n" +
      rulings.map((d: any) => {
        const snippet = (d.content || "").replace(/\s+/g, " ").trim().slice(0, 1200);
        return `**${d.title}**${d.reference_number ? ` (قرار عدد ${d.reference_number})` : ""}${d.court_chamber ? ` - ${d.court_chamber}` : ""}${d.decision_date ? ` — ${d.decision_date}` : ""}\n${snippet}`;
      }).join("\n\n---\n\n");
  }

  ragContext += "\n\n**تعليمات**: اعتمد على هذه المراجع + المعرفة المدمجة أعلاه. لا تكرر نفس النص أكثر من مرة.";
  return ragContext;
};

// ─── Server handler ─────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, caseContext } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

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
          const fullText = `${caseContext || ""} ${lastUserMessage.content || ""}`;
          const generalTerms = extractSearchTerms(fullText);
          const legalKeywords = extractLegalKeywords(fullText);
          const allTerms = [...new Set([...legalKeywords, ...generalTerms])].slice(0, 14);
          
          const candidates: any[] = [];

          // Search by content
          for (const term of allTerms) {
            const safeTerm = term.replace(/[%_]/g, "").trim();
            if (!safeTerm || safeTerm.length < 3) continue;

            const { data: termDocs } = await supabase
              .from("legal_documents")
              .select("title, content, source, doc_type, reference_number, court_chamber, category, decision_date")
              .ilike("content", `%${safeTerm}%`)
              .limit(20);

            if (termDocs?.length) candidates.push(...termDocs);
            if (candidates.length >= 200) break;
          }

          // Also search by title for better matching
          for (const term of legalKeywords.slice(0, 5)) {
            const safeTerm = term.replace(/[%_]/g, "").trim();
            if (!safeTerm) continue;

            const { data: titleDocs } = await supabase
              .from("legal_documents")
              .select("title, content, source, doc_type, reference_number, court_chamber, category, decision_date")
              .ilike("title", `%${safeTerm}%`)
              .limit(10);

            if (titleDocs?.length) candidates.push(...titleDocs);
          }

          if (candidates.length > 0) {
            const diversified = pickDiversifiedDocs(candidates, 12);
            if (diversified.length > 0) {
              ragContext = buildRagContext(diversified);
            }
          }
        }
      } catch (err) {
        console.error("RAG search error (non-fatal):", err);
      }
    }

    let finalPrompt = SYSTEM_PROMPT + ragContext;
    if (caseContext) finalPrompt += "\n\n## 📋 سياق النازلة المقدم:\n" + caseContext;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
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
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "تم تجاوز حد الطلبات، يرجى المحاولة لاحقاً." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "يرجى إضافة رصيد لحساب Lovable AI." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      return new Response(
        JSON.stringify({ error: "خطأ في خدمة الذكاء الاصطناعي" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("legal-chat error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "خطأ غير معروف" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
