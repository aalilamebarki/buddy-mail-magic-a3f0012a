// Legal AI Chat - Moroccan Law with RAG + Diversified Retrieval
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `أنت **مستشار قانوني مغربي أقدم**، خبير في التشريع المغربي والاجتهاد القضائي. تتحدث بلغة عربية فصحى رسمية وقوية، بأسلوب حازم ومهني.

## ⛔ قواعد التخاطب والأسلوب:
- **لا تستخدم أبداً** عبارة "حضرة الموكل" أو "حضرتك". بدلاً من ذلك، استخدم عبارات مثل: "نعم أيها السائل"، "بخصوص سؤالكم"، "بناءً على ما أفدتم به"، "في ما يتعلق بنازلتكم".
- ابدأ بالدخول مباشرة في صلب الموضوع دون مقدمات طويلة أو مجاملات.
- خاطب السائل بضمير الجمع "أنتم/كم" للاحترام بدون مبالغة.

## ⛔ قواعد الدقة والمصداقية:
1. **لا تختلق أبداً** أرقام فصول أو مواد أو قرارات أو تواريخ.
2. إذا لم تكن متأكداً، صرّح بوضوح: "لا تتوفر لديّ معطيات مؤكدة بشأن هذه النقطة".
3. **لا تبالغ** في التوقعات؛ قدّم تقييماً واقعياً صارماً.
4. ميّز دائماً بين المعلومة المؤكدة والتقدير المحتمل.
5. عند وجود مراجع من قاعدة المعرفة، اعتمد عليها أولاً.

## 📌 تنسيق النصوص القانونية:
- عند ذكر مادة/فصل داخل الفقرة، اجعلها بالخط العريض: **الفصل ...** / **المادة ...**.
- عند الاقتباس الحرفي لنص قانوني أو قرار، استخدم صيغة blockquote.

## 📐 هيكلة الجواب (مرنة حسب الحالة):

استخدم فقط الأقسام التي تنطبق فعلاً على النازلة المعروضة. لا تُدرج قسماً فارغاً أو لا علاقة له بالسؤال.

**الأقسام المتاحة** (اختر منها ما يناسب):

### ⚖️ التكييف القانوني
- استخدمه عند وجود إشكال قانوني يحتاج تصنيفاً

### 📜 السند القانوني
- استخدمه عند وجود نصوص قانونية منطبقة فعلاً
- اذكر فقط القوانين والمواد ذات الصلة المباشرة

### 🔍 الاتجاه القضائي
- استخدمه فقط إذا توفرت قرارات من السياق أو كان هناك اتجاه قضائي معروف
- لا تختلق قرارات

### 🛠️ الخطة العملية
- استخدمها عند وجود إجراءات عملية يمكن اتخاذها
- اذكر فقط العناصر المنطبقة (المحكمة، نوع الدعوى، الوثائق، الآجال...)

### 📊 تقييم الموقف
- استخدمه فقط عندما تتوفر معطيات كافية لتقييم الموقف
- ✅ نقاط القوة: فقط إذا وُجدت فعلاً نقاط قوة واضحة
- ⚠️ نقاط الضعف: فقط إذا وُجدت مخاطر أو نقاط ضعف حقيقية
- 💡 التوصية: فقط إذا كانت هناك توصية عملية مفيدة

## ⛔ قواعد حاسمة:
- **لا تكرر نفس الأقسام في كل رسالة بشكل آلي**. كل جواب فريد حسب السؤال.
- إذا كان السؤال بسيطاً، أجب بإيجاز دون هيكلة ثقيلة.
- إذا كان السؤال متابعة لحديث سابق، أجب بشكل محادثة طبيعية.
- الأقسام الكاملة فقط للاستشارة الأولى التفصيلية.

## أسلوب الكتابة:
- عربية فصحى رسمية قوية بأسلوب المحامين المتمرسين
- جمل واضحة مباشرة حاسمة
- تنظيم محكم بعناوين وقوائم
- بدون حشو أو تكرار أو مبالغة

## اختم الاستشارة الأولى فقط بـ:
---
⚠️ **تنبيه**: هذه استشارة أولية توجيهية مبنية على المعلومات المقدمة، ولا تغني عن استشارة محامٍ مختص يطّلع على كافة الوثائق والملابسات.`;

const AR_STOP_WORDS = new Set([
  "من", "إلى", "على", "في", "عن", "هذا", "هذه", "ذلك", "تلك", "هناك", "هنا",
  "كان", "كانت", "لقد", "وقد", "مع", "أو", "ثم", "كما", "لدى", "عند", "بعد", "قبل",
  "هل", "ما", "ماذا", "كيف", "متى", "أين", "إذا", "لكن", "غير", "فقط", "جداً",
]);

const normalizeArabic = (text: string) =>
  text
    .replace(/[\u064B-\u0652]/g, "")
    .replace(/[^\u0000-\u007F\u0600-\u06FF\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const extractSearchTerms = (text: string): string[] => {
  const cleaned = normalizeArabic(text).toLowerCase();
  const terms = cleaned
    .split(/\s+/)
    .map((t) => t.replace(/[%_]/g, "").trim())
    .filter((t) => t.length >= 4 && !AR_STOP_WORDS.has(t));

  return [...new Set(terms)].slice(0, 8);
};

const pickDiversifiedDocs = (docs: any[], maxTotal = 10): any[] => {
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

  const selectedRulings = takeByCategory(rulings, Math.min(4, maxTotal));
  const remaining = maxTotal - selectedRulings.length;
  const selectedLaws = takeByCategory(laws, remaining);

  return [...selectedLaws, ...selectedRulings].slice(0, maxTotal);
};

const buildRagContext = (docs: any[]) => {
  const laws = docs.filter((d) => d.doc_type === "law");
  const rulings = docs.filter((d) => d.doc_type === "ruling");

  let ragContext = "\n\n## مراجع من قاعدة المعرفة القانونية:";

  if (laws.length > 0) {
    ragContext += "\n\n### نصوص قانونية:\n" +
      laws.map((d: any) => {
        const snippet = (d.content || "").replace(/\s+/g, " ").trim().slice(0, 900);
        return `**${d.title}**${d.category ? ` (${d.category})` : ""}\n${snippet}`;
      }).join("\n\n---\n\n");
  }

  if (rulings.length > 0) {
    ragContext += "\n\n### قرارات قضائية:\n" +
      rulings.map((d: any) => {
        const snippet = (d.content || "").replace(/\s+/g, " ").trim().slice(0, 900);
        return `**${d.title}**${d.reference_number ? ` (قرار عدد ${d.reference_number})` : ""}${d.court_chamber ? ` - ${d.court_chamber}` : ""}\n${snippet}`;
      }).join("\n\n---\n\n");
  }

  ragContext += "\n\n**تعليمات**: اعتمد على هذه المراجع أولاً، وامنع تكرار نفس النص القانوني أو نفس المرجع أكثر من مرة داخل الجواب.";
  return ragContext;
};

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
          const terms = extractSearchTerms(fullText);
          const candidates: any[] = [];

          for (const term of terms) {
            const safeTerm = term.replace(/[%_]/g, "").trim();
            if (!safeTerm) continue;

            const { data: termDocs } = await supabase
              .from("legal_documents")
              .select("title, content, source, doc_type, reference_number, court_chamber, category, decision_date, created_at")
              .ilike("content", `%${safeTerm}%`)
              .limit(24);

            if (termDocs?.length) candidates.push(...termDocs);
            if (candidates.length >= 180) break;
          }

          if (candidates.length > 0) {
            const diversified = pickDiversifiedDocs(candidates, 10);
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
    if (caseContext) finalPrompt += "\n\n" + caseContext;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
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