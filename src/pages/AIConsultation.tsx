import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Scale, Brain, ArrowLeft, Send, Bot, User, FileText, ClipboardList, ChevronLeft, ChevronRight, AlertTriangle, Menu, X, Sparkles, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import type { Components } from 'react-markdown';
import { toast } from 'sonner';

interface Message { role: 'user' | 'assistant'; content: string; }

interface CaseIntake {
  caseType: string; subCategory: string; partyRole: string; otherParty: string;
  facts: string; timeline: string; previousActions: string; documents: string; desiredOutcome: string;
}

const CASE_TYPES = [
  { value: 'family', label: 'قضايا الأسرة', sub: ['طلاق اتفاقي', 'طلاق للشقاق', 'نفقة', 'حضانة', 'إرث / تركة', 'زواج قاصر', 'نسب', 'أخرى'] },
  { value: 'rental', label: 'قضايا الكراء', sub: ['كراء سكني', 'كراء تجاري', 'كراء مهني', 'إفراغ', 'مراجعة الوجيبة', 'أخرى'] },
  { value: 'property', label: 'قضايا عقارية', sub: ['تحفيظ عقاري', 'تعرض', 'بيع عقار', 'قسمة عقار', 'حقوق عينية', 'نزع ملكية', 'أخرى'] },
  { value: 'labor', label: 'قضايا الشغل', sub: ['فصل تعسفي', 'أجور متأخرة', 'حوادث شغل', 'عقد شغل', 'تعويضات', 'أخرى'] },
  { value: 'commercial', label: 'قضايا تجارية', sub: ['شركات', 'كمبيالة / شيك', 'إفلاس', 'تسوية قضائية', 'عقود تجارية', 'أخرى'] },
  { value: 'criminal', label: 'قضايا جنائية', sub: ['سرقة', 'نصب', 'خيانة أمانة', 'ضرب وجرح', 'تزوير', 'مخدرات', 'أخرى'] },
  { value: 'admin', label: 'قضايا إدارية', sub: ['إلغاء قرار إداري', 'تعويض ضد الدولة', 'منازعات ضريبية', 'أخرى'] },
  { value: 'civil', label: 'قضايا مدنية', sub: ['مسؤولية مدنية', 'تعويض عن ضرر', 'عقود مدنية', 'حوادث سير', 'أخرى'] },
];

const PARTY_ROLES = [
  { value: 'plaintiff', label: 'مدعي (أنا من يرفع الدعوى)' },
  { value: 'defendant', label: 'مدعى عليه (رُفعت ضدي دعوى)' },
  { value: 'third_party', label: 'طرف ثالث / مستشار' },
  { value: 'not_sure', label: 'لم أرفع دعوى بعد / أستفسر فقط' },
];

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/legal-chat`;

async function streamChat({ messages, caseContext, onDelta, onDone, onError }: {
  messages: Message[]; caseContext?: string;
  onDelta: (text: string) => void; onDone: () => void; onError: (err: string) => void;
}) {
  const resp = await fetch(CHAT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
    body: JSON.stringify({ messages, caseContext }),
  });
  if (!resp.ok) {
    if (resp.status === 429) { onError('تم تجاوز حد الطلبات، يرجى المحاولة لاحقاً.'); return; }
    if (resp.status === 402) { onError('يرجى إضافة رصيد لحساب Lovable AI.'); return; }
    onError('حدث خطأ في الاتصال بخدمة الذكاء الاصطناعي'); return;
  }
  if (!resp.body) { onError('لا توجد استجابة'); return; }

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let textBuffer = '';
  let streamDone = false;

  while (!streamDone) {
    const { done, value } = await reader.read();
    if (done) break;
    textBuffer += decoder.decode(value, { stream: true });
    let newlineIndex: number;
    while ((newlineIndex = textBuffer.indexOf('\n')) !== -1) {
      let line = textBuffer.slice(0, newlineIndex);
      textBuffer = textBuffer.slice(newlineIndex + 1);
      if (line.endsWith('\r')) line = line.slice(0, -1);
      if (line.startsWith(':') || line.trim() === '') continue;
      if (!line.startsWith('data: ')) continue;
      const jsonStr = line.slice(6).trim();
      if (jsonStr === '[DONE]') { streamDone = true; break; }
      try {
        const parsed = JSON.parse(jsonStr);
        const content = parsed.choices?.[0]?.delta?.content as string | undefined;
        if (content) onDelta(content);
      } catch { textBuffer = line + '\n' + textBuffer; break; }
    }
  }

  if (textBuffer.trim()) {
    for (let raw of textBuffer.split('\n')) {
      if (!raw) continue;
      if (raw.endsWith('\r')) raw = raw.slice(0, -1);
      if (raw.startsWith(':') || raw.trim() === '') continue;
      if (!raw.startsWith('data: ')) continue;
      const jsonStr = raw.slice(6).trim();
      if (jsonStr === '[DONE]') continue;
      try {
        const parsed = JSON.parse(jsonStr);
        const content = parsed.choices?.[0]?.delta?.content as string | undefined;
        if (content) onDelta(content);
      } catch { /* ignore */ }
    }
  }
  onDone();
}

const AIConsultation = () => {
  const [mode, setMode] = useState<'intake' | 'chat'>('intake');
  const [step, setStep] = useState(0);
  const [intake, setIntake] = useState<CaseIntake>({
    caseType: '', subCategory: '', partyRole: '', otherParty: '',
    facts: '', timeline: '', previousActions: '', documents: '', desiredOutcome: '',
  });
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [caseContext, setCaseContext] = useState('');
  const [mobileNav, setMobileNav] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, [messages]);

  const selectedType = CASE_TYPES.find(t => t.value === intake.caseType);

  const buildCaseContext = (): string => {
    const typeLabel = selectedType?.label || intake.caseType;
    return `## بيانات النازلة:\n- **نوع القضية**: ${typeLabel} - ${intake.subCategory}\n- **صفة الشخص**: ${PARTY_ROLES.find(r => r.value === intake.partyRole)?.label || intake.partyRole}\n- **الطرف الآخر**: ${intake.otherParty || 'غير محدد'}\n- **الوقائع**: ${intake.facts}\n- **التسلسل الزمني**: ${intake.timeline || 'غير محدد'}\n- **الإجراءات السابقة**: ${intake.previousActions || 'لا يوجد'}\n- **الوثائق**: ${intake.documents || 'غير محددة'}\n- **النتيجة المرجوة**: ${intake.desiredOutcome || 'غير محددة'}`;
  };

  const startConsultation = () => {
    if (!intake.caseType || !intake.facts.trim()) { toast.error('يرجى اختيار نوع القضية وذكر الوقائع'); return; }
    const context = buildCaseContext();
    setCaseContext(context);
    setMessages([{ role: 'assistant', content: '✅ تم استلام بيانات النازلة. جاري التحليل...' }]);
    setMode('chat');
    setTimeout(() => autoAnalyze(context), 500);
  };

  const autoAnalyze = async (context: string) => {
    setLoading(true);
    const analyzeMsg: Message = { role: 'user', content: `حلل هذه النازلة القانونية:\n\n${context}` };
    let assistantSoFar = '';
    const upsertAssistant = (chunk: string) => {
      assistantSoFar += chunk;
      setMessages(prev => {
        const last = prev[prev.length - 1];
        if (last?.role === 'assistant' && assistantSoFar.length > chunk.length)
          return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: assistantSoFar } : m));
        return [...prev, { role: 'assistant', content: assistantSoFar }];
      });
    };
    try {
      await streamChat({ messages: [analyzeMsg], caseContext: context, onDelta: upsertAssistant, onDone: () => setLoading(false), onError: (err) => { toast.error(err); setLoading(false); } });
    } catch { toast.error('حدث خطأ غير متوقع'); setLoading(false); }
  };

  const handleSend = async () => {
    if (!input.trim() || loading) return;
    const userMessage = input.trim();
    setInput('');
    const userMsg: Message = { role: 'user', content: userMessage };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);
    let assistantSoFar = '';
    const upsertAssistant = (chunk: string) => {
      assistantSoFar += chunk;
      setMessages(prev => {
        const last = prev[prev.length - 1];
        if (last?.role === 'assistant' && assistantSoFar.length > chunk.length)
          return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: assistantSoFar } : m));
        return [...prev, { role: 'assistant', content: assistantSoFar }];
      });
    };
    try {
      await streamChat({ messages: [...messages, userMsg].map(m => ({ role: m.role, content: m.content })), caseContext, onDelta: upsertAssistant, onDone: () => setLoading(false), onError: (err) => { toast.error(err); setLoading(false); } });
    } catch { toast.error('حدث خطأ غير متوقع'); setLoading(false); }
  };

  const resetConsultation = () => {
    setMode('intake'); setStep(0); setMessages([]); setCaseContext('');
    setIntake({ caseType: '', subCategory: '', partyRole: '', otherParty: '', facts: '', timeline: '', previousActions: '', documents: '', desiredOutcome: '' });
  };

  const steps = [
    {
      title: 'نوع القضية', icon: <Scale className="h-5 w-5" />, valid: !!intake.caseType && !!intake.subCategory,
      content: (
        <div className="space-y-5">
          <div className="space-y-2">
            <Label className="text-sm font-semibold">ما نوع قضيتك؟ *</Label>
            <div className="grid grid-cols-2 gap-2">
              {CASE_TYPES.map(t => (
                <button key={t.value}
                  className={`flex items-center gap-2 p-3 rounded-xl border text-sm text-right transition-all ${
                    intake.caseType === t.value
                      ? 'border-primary bg-primary/5 text-primary font-semibold shadow-sm'
                      : 'border-border/30 text-muted-foreground hover:border-border hover:bg-muted/30'
                  }`}
                  onClick={() => setIntake(f => ({ ...f, caseType: t.value, subCategory: '' }))}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>
          {selectedType && (
            <div className="space-y-2">
              <Label className="text-sm font-semibold">تحديد أدق *</Label>
              <div className="grid grid-cols-2 gap-2">
                {selectedType.sub.map(s => (
                  <button key={s}
                    className={`p-2.5 rounded-xl border text-xs transition-all ${
                      intake.subCategory === s
                        ? 'border-primary bg-primary/5 text-primary font-semibold'
                        : 'border-border/30 text-muted-foreground hover:border-border hover:bg-muted/30'
                    }`}
                    onClick={() => setIntake(f => ({ ...f, subCategory: s }))}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      ),
    },
    {
      title: 'صفتك في القضية', icon: <User className="h-5 w-5" />, valid: !!intake.partyRole,
      content: (
        <div className="space-y-5">
          <div className="space-y-2">
            <Label className="text-sm font-semibold">ما هي صفتك؟ *</Label>
            <div className="space-y-2">
              {PARTY_ROLES.map(r => (
                <button key={r.value}
                  className={`w-full text-right p-4 rounded-xl border transition-all ${
                    intake.partyRole === r.value
                      ? 'border-primary bg-primary/5 text-primary font-semibold'
                      : 'border-border/30 text-muted-foreground hover:border-border hover:bg-muted/30'
                  }`}
                  onClick={() => setIntake(f => ({ ...f, partyRole: r.value }))}>
                  {r.label}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-xs">من هو الطرف الآخر؟ (اختياري)</Label>
            <Input value={intake.otherParty} onChange={e => setIntake(f => ({ ...f, otherParty: e.target.value }))}
              placeholder="مثال: المكري / الزوج / المشغل..." className="h-11 rounded-xl" />
          </div>
        </div>
      ),
    },
    {
      title: 'وقائع النازلة', icon: <FileText className="h-5 w-5" />, valid: intake.facts.trim().length >= 30,
      content: (
        <div className="space-y-5">
          <div className="space-y-2">
            <Label className="text-sm font-semibold">اشرح الوقائع بالتفصيل *</Label>
            <p className="text-[11px] text-muted-foreground">كلما كانت التفاصيل أكثر، كانت الاستشارة أدق (30 حرف على الأقل)</p>
            <Textarea value={intake.facts} onChange={e => setIntake(f => ({ ...f, facts: e.target.value }))}
              placeholder="اشرح ماذا حدث بالتفصيل..."
              rows={6} className="min-h-[120px] rounded-xl" />
            <p className="text-[10px] text-muted-foreground text-left" dir="ltr">{intake.facts.length} / 30+</p>
          </div>
          <div className="space-y-2">
            <Label className="text-xs">التسلسل الزمني (اختياري)</Label>
            <Textarea value={intake.timeline} onChange={e => setIntake(f => ({ ...f, timeline: e.target.value }))}
              placeholder="مثال: في يناير 2024 توصلت بالإنذار..." rows={3} className="rounded-xl" />
          </div>
        </div>
      ),
    },
    {
      title: 'معلومات إضافية', icon: <ClipboardList className="h-5 w-5" />, valid: true,
      content: (
        <div className="space-y-5">
          <div className="space-y-2">
            <Label className="text-xs">هل قمت بأي إجراءات سابقة؟</Label>
            <Textarea value={intake.previousActions} onChange={e => setIntake(f => ({ ...f, previousActions: e.target.value }))}
              placeholder="مثال: رفعت دعوى / أرسلت إنذاراً..." rows={3} className="rounded-xl" />
          </div>
          <div className="space-y-2">
            <Label className="text-xs">ما هي الوثائق المتوفرة؟</Label>
            <Textarea value={intake.documents} onChange={e => setIntake(f => ({ ...f, documents: e.target.value }))}
              placeholder="مثال: عقد الكراء، وصولات الأداء..." rows={2} className="rounded-xl" />
          </div>
          <div className="space-y-2">
            <Label className="text-xs">ما النتيجة المرجوة؟</Label>
            <Select value={intake.desiredOutcome} onValueChange={v => setIntake(f => ({ ...f, desiredOutcome: v }))}>
              <SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder="اختر..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="معرفة حقوقي فقط">معرفة حقوقي فقط</SelectItem>
                <SelectItem value="رفع دعوى قضائية">رفع دعوى قضائية</SelectItem>
                <SelectItem value="الدفاع عن نفسي">الدفاع عن نفسي</SelectItem>
                <SelectItem value="حل ودي / صلح">حل ودي / صلح</SelectItem>
                <SelectItem value="استئناف حكم">استئناف حكم</SelectItem>
                <SelectItem value="تنفيذ حكم">تنفيذ حكم</SelectItem>
                <SelectItem value="أخرى">أخرى</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      ),
    },
  ];

  return (
    <>
      <Helmet>
        <title>المستشار الذكي - محاماة ذكية</title>
        <meta name="description" content="استشارة قانونية ذكية مبنية على القانون المغربي" />
      </Helmet>

      <div className="min-h-screen bg-background flex flex-col relative overflow-hidden">
        {/* Background */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[700px] rounded-full bg-primary/[0.03] blur-[120px]" />
          <div className="absolute bottom-0 right-0 w-[500px] h-[500px] rounded-full bg-legal-gold/[0.04] blur-[100px]" />
        </div>

        {/* Nav */}
        <nav className="sticky top-0 z-50 bg-background/80 backdrop-blur-2xl border-b border-border/30 relative">
          <div className="container mx-auto px-4 flex items-center justify-between h-16">
            <Link to="/" className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-legal-navy to-primary flex items-center justify-center">
                <Scale className="h-4 w-4 text-primary-foreground" />
              </div>
              <span className="text-sm font-bold text-foreground">محاماة ذكية</span>
            </Link>
            {mode === 'chat' ? (
              <Button variant="ghost" size="sm" onClick={resetConsultation} className="gap-1.5 text-xs rounded-lg">
                استشارة جديدة <ArrowLeft className="h-3 w-3" />
              </Button>
            ) : (
              <div className="hidden md:flex items-center gap-1">
                <Link to="/blog" className="px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground rounded-lg hover:bg-accent transition-colors">المقالات</Link>
                <Link to="/" className="flex items-center gap-1 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground">الرئيسية <ArrowLeft className="h-3 w-3" /></Link>
              </div>
            )}
            <button className="md:hidden p-2 rounded-lg hover:bg-accent" onClick={() => setMobileNav(!mobileNav)}>
              {mobileNav ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </nav>

        <main className="flex-1 container mx-auto px-4 py-6 md:py-10 max-w-3xl flex flex-col relative z-10">
          {mode === 'intake' ? (
            <div className="space-y-8">
              {/* Hero */}
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                className="text-center space-y-4">
                <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center mx-auto shadow-xl shadow-primary/25">
                  <Brain className="h-8 w-8 text-primary-foreground" />
                </div>
                <Badge className="bg-primary/10 text-primary border-primary/20 px-4 py-1 text-xs rounded-full gap-1.5">
                  <Sparkles className="h-3 w-3" /> مدعوم بالذكاء الاصطناعي
                </Badge>
                <h1 className="text-3xl md:text-4xl font-bold text-foreground">المستشار الذكي</h1>
                <p className="text-sm text-muted-foreground max-w-lg mx-auto">
                  أجب على الأسئلة التالية للحصول على تحليل دقيق مبني على القانون المغربي
                </p>
              </motion.div>

              {/* Progress Steps */}
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}
                className="flex items-center gap-1 justify-center">
                {steps.map((s, i) => (
                  <div key={i} className="flex items-center gap-1">
                    <button onClick={() => setStep(i)}
                      className={`h-9 w-9 rounded-xl flex items-center justify-center text-xs font-bold transition-all ${
                        i === step ? 'bg-primary text-primary-foreground shadow-md shadow-primary/25'
                          : i < step && steps[i].valid ? 'bg-primary/15 text-primary'
                          : 'bg-muted text-muted-foreground'
                      }`}>
                      {i + 1}
                    </button>
                    {i < steps.length - 1 && (
                      <div className={`w-8 h-[2px] rounded-full ${i < step ? 'bg-primary/30' : 'bg-border'}`} />
                    )}
                  </div>
                ))}
              </motion.div>

              {/* Step Card */}
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
                <Card className="border-border/20 shadow-xl shadow-foreground/[0.03] rounded-2xl overflow-hidden">
                  <div className="h-[3px] bg-gradient-to-l from-primary via-legal-gold to-primary" />
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2.5 text-lg">
                      <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                        {steps[step].icon}
                      </div>
                      {steps[step].title}
                      <span className="text-[11px] font-normal text-muted-foreground mr-auto bg-muted/40 px-2.5 py-1 rounded-full">
                        {step + 1} / {steps.length}
                      </span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {steps[step].content}

                    <div className="flex gap-2 pt-4 border-t border-border/15">
                      {step > 0 && (
                        <Button variant="outline" onClick={() => setStep(s => s - 1)} className="gap-1.5 rounded-xl">
                          <ChevronRight className="h-4 w-4" /> السابق
                        </Button>
                      )}
                      {step < steps.length - 1 ? (
                        <Button onClick={() => setStep(s => s + 1)} disabled={!steps[step].valid}
                          className="gap-1.5 mr-auto rounded-xl shadow-md shadow-primary/20">
                          التالي <ChevronLeft className="h-4 w-4" />
                        </Button>
                      ) : (
                        <Button onClick={startConsultation}
                          disabled={!intake.caseType || intake.facts.trim().length < 30}
                          className="gap-2 mr-auto rounded-xl bg-legal-emerald hover:bg-legal-emerald/90 shadow-md shadow-legal-emerald/20">
                          <Brain className="h-4 w-4" /> ابدأ الاستشارة
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

              {/* Warning */}
              <div className="flex items-start gap-2.5 text-xs text-muted-foreground bg-muted/30 rounded-xl p-4 border border-border/10">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-legal-gold" />
                <span>هذه استشارة توجيهية بالذكاء الاصطناعي ولا تغني عن استشارة متخصصة. المعلومات مبنية على القانون المغربي.</span>
              </div>

              {/* Quick Chat */}
              <div className="text-center">
                <button className="text-xs text-muted-foreground hover:text-primary transition-colors flex items-center gap-1.5 mx-auto"
                  onClick={() => {
                    setCaseContext('');
                    setMessages([{ role: 'assistant', content: 'مرحباً! اطرح سؤالك القانوني وسأحاول مساعدتك.\n\n⚠️ *للحصول على تحليل أدق، استخدم الاستمارة.*' }]);
                    setMode('chat');
                  }}>
                  <Zap className="h-3 w-3" /> أو اطرح سؤالاً مباشراً بدون استمارة
                </button>
              </div>
            </div>
          ) : (
            /* ===== CHAT MODE ===== */
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex-1 flex flex-col">
              <Card className="flex-1 flex flex-col overflow-hidden border-border/15 shadow-xl rounded-2xl">
                <div className="h-[3px] bg-gradient-to-l from-primary via-legal-gold to-legal-emerald" />
                <div ref={scrollRef} className="flex-1 overflow-y-auto p-5" style={{ maxHeight: 'calc(100vh - 220px)' }}>
                  <div className="space-y-4">
                    {messages.map((msg, i) => (
                      <motion.div key={i}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                        <div className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 shadow-sm ${
                          msg.role === 'user'
                            ? 'bg-gradient-to-br from-primary to-primary/80 text-primary-foreground'
                            : 'bg-gradient-to-br from-legal-navy/10 to-legal-gold/10 text-legal-navy'
                        }`}>
                          {msg.role === 'user' ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                        </div>
                        <div className={`rounded-2xl px-5 py-4 max-w-[85%] text-sm leading-relaxed ${
                          msg.role === 'user'
                            ? 'bg-primary text-primary-foreground rounded-tr-md'
                            : 'bg-muted/40 text-foreground border border-border/10 rounded-tl-md'
                        }`}>
                          {msg.role === 'assistant' ? (
                            <div className="prose prose-sm dark:prose-invert max-w-none prose-p:leading-[1.9] prose-li:leading-[1.9]">
                              <ReactMarkdown>{msg.content}</ReactMarkdown>
                            </div>
                          ) : (
                            <span className="whitespace-pre-wrap">{msg.content}</span>
                          )}
                        </div>
                      </motion.div>
                    ))}
                    {loading && messages[messages.length - 1]?.role !== 'assistant' && (
                      <div className="flex gap-3">
                        <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-legal-navy/10 to-legal-gold/10 flex items-center justify-center">
                          <Bot className="h-4 w-4 text-legal-navy" />
                        </div>
                        <div className="bg-muted/40 rounded-2xl rounded-tl-md px-5 py-4 border border-border/10">
                          <div className="flex gap-1.5">
                            <span className="w-2 h-2 bg-primary/40 rounded-full animate-bounce" />
                            <span className="w-2 h-2 bg-primary/40 rounded-full animate-bounce" style={{ animationDelay: '0.15s' }} />
                            <span className="w-2 h-2 bg-primary/40 rounded-full animate-bounce" style={{ animationDelay: '0.3s' }} />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <CardContent className="border-t border-border/15 p-4">
                  <div className="flex gap-2">
                    <Textarea placeholder="اطرح سؤالاً إضافياً..."
                      value={input} onChange={(e) => setInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                      className="min-h-[44px] max-h-32 resize-none rounded-xl" rows={1} />
                    <Button onClick={handleSend} disabled={loading || !input.trim()} size="icon"
                      className="shrink-0 rounded-xl h-11 w-11 shadow-md shadow-primary/20">
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </main>
      </div>
    </>
  );
};

export default AIConsultation;
