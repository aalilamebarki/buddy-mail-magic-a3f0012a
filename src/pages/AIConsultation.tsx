import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Scale, Brain, ArrowLeft, Send, Bot, User, FileText, ClipboardList, ChevronLeft, ChevronRight, AlertTriangle } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { toast } from 'sonner';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface CaseIntake {
  caseType: string;
  subCategory: string;
  partyRole: string;
  otherParty: string;
  facts: string;
  timeline: string;
  previousActions: string;
  documents: string;
  desiredOutcome: string;
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

async function streamChat({
  messages,
  caseContext,
  onDelta,
  onDone,
  onError,
}: {
  messages: Message[];
  caseContext?: string;
  onDelta: (text: string) => void;
  onDone: () => void;
  onError: (err: string) => void;
}) {
  const resp = await fetch(CHAT_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
    },
    body: JSON.stringify({ messages, caseContext }),
  });

  if (!resp.ok) {
    if (resp.status === 429) { onError('تم تجاوز حد الطلبات، يرجى المحاولة لاحقاً.'); return; }
    if (resp.status === 402) { onError('يرجى إضافة رصيد لحساب Lovable AI.'); return; }
    onError('حدث خطأ في الاتصال بخدمة الذكاء الاصطناعي');
    return;
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
      } catch {
        textBuffer = line + '\n' + textBuffer;
        break;
      }
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
    caseType: '',
    subCategory: '',
    partyRole: '',
    otherParty: '',
    facts: '',
    timeline: '',
    previousActions: '',
    documents: '',
    desiredOutcome: '',
  });

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [caseContext, setCaseContext] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const selectedType = CASE_TYPES.find(t => t.value === intake.caseType);

  const buildCaseContext = (): string => {
    const typeLabel = selectedType?.label || intake.caseType;
    return `## بيانات النازلة المجمعة من الاستمارة:
- **نوع القضية**: ${typeLabel} - ${intake.subCategory}
- **صفة الشخص**: ${PARTY_ROLES.find(r => r.value === intake.partyRole)?.label || intake.partyRole}
- **الطرف الآخر**: ${intake.otherParty || 'غير محدد'}
- **الوقائع**: ${intake.facts}
- **التسلسل الزمني**: ${intake.timeline || 'غير محدد'}
- **الإجراءات السابقة**: ${intake.previousActions || 'لا يوجد'}
- **الوثائق المتوفرة**: ${intake.documents || 'غير محددة'}
- **النتيجة المرجوة**: ${intake.desiredOutcome || 'غير محددة'}`;
  };

  const startConsultation = () => {
    if (!intake.caseType || !intake.facts.trim()) {
      toast.error('يرجى اختيار نوع القضية وذكر الوقائع على الأقل');
      return;
    }

    const context = buildCaseContext();
    setCaseContext(context);

    const welcomeMsg: Message = {
      role: 'assistant',
      content: `✅ تم استلام بيانات النازلة. سأقوم الآن بتحليلها وإعطائك استشارة دقيقة بناءً على **القانون المغربي** واجتهادات **محكمة النقض**.\n\nجاري التحليل...`,
    };
    setMessages([welcomeMsg]);
    setMode('chat');

    // Auto-send the first analysis
    setTimeout(() => {
      autoAnalyze(context);
    }, 500);
  };

  const autoAnalyze = async (context: string) => {
    setLoading(true);
    const analyzeMsg: Message = {
      role: 'user',
      content: `حلل هذه النازلة القانونية وأعطني استشارة دقيقة ومفصلة:\n\n${context}`,
    };

    let assistantSoFar = '';
    const upsertAssistant = (chunk: string) => {
      assistantSoFar += chunk;
      setMessages(prev => {
        const last = prev[prev.length - 1];
        if (last?.role === 'assistant' && assistantSoFar.length > chunk.length) {
          return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: assistantSoFar } : m));
        }
        return [...prev, { role: 'assistant', content: assistantSoFar }];
      });
    };

    try {
      await streamChat({
        messages: [analyzeMsg],
        caseContext: context,
        onDelta: (chunk) => upsertAssistant(chunk),
        onDone: () => setLoading(false),
        onError: (err) => { toast.error(err); setLoading(false); },
      });
    } catch (e) {
      console.error(e);
      toast.error('حدث خطأ غير متوقع');
      setLoading(false);
    }
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
        if (last?.role === 'assistant' && assistantSoFar.length > chunk.length) {
          return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: assistantSoFar } : m));
        }
        return [...prev, { role: 'assistant', content: assistantSoFar }];
      });
    };

    try {
      await streamChat({
        messages: [...messages, userMsg].map(m => ({ role: m.role, content: m.content })),
        caseContext,
        onDelta: (chunk) => upsertAssistant(chunk),
        onDone: () => setLoading(false),
        onError: (err) => { toast.error(err); setLoading(false); },
      });
    } catch (e) {
      console.error(e);
      toast.error('حدث خطأ غير متوقع');
      setLoading(false);
    }
  };

  const resetConsultation = () => {
    setMode('intake');
    setStep(0);
    setMessages([]);
    setCaseContext('');
    setIntake({ caseType: '', subCategory: '', partyRole: '', otherParty: '', facts: '', timeline: '', previousActions: '', documents: '', desiredOutcome: '' });
  };

  // Intake form steps
  const steps = [
    {
      title: 'نوع القضية',
      icon: <Scale className="h-5 w-5" />,
      valid: !!intake.caseType && !!intake.subCategory,
      content: (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-base font-semibold">ما نوع قضيتك؟ *</Label>
            <div className="grid grid-cols-2 gap-2">
              {CASE_TYPES.map(t => (
                <Button
                  key={t.value}
                  variant={intake.caseType === t.value ? 'default' : 'outline'}
                  size="sm"
                  className="h-auto py-3 justify-start text-right"
                  onClick={() => setIntake(f => ({ ...f, caseType: t.value, subCategory: '' }))}
                >
                  {t.label}
                </Button>
              ))}
            </div>
          </div>
          {selectedType && (
            <div className="space-y-2">
              <Label className="text-base font-semibold">تحديد أدق *</Label>
              <div className="grid grid-cols-2 gap-2">
                {selectedType.sub.map(s => (
                  <Button
                    key={s}
                    variant={intake.subCategory === s ? 'default' : 'outline'}
                    size="sm"
                    className="h-auto py-2 text-sm"
                    onClick={() => setIntake(f => ({ ...f, subCategory: s }))}
                  >
                    {s}
                  </Button>
                ))}
              </div>
            </div>
          )}
        </div>
      ),
    },
    {
      title: 'صفتك في القضية',
      icon: <User className="h-5 w-5" />,
      valid: !!intake.partyRole,
      content: (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-base font-semibold">ما هي صفتك؟ *</Label>
            <div className="space-y-2">
              {PARTY_ROLES.map(r => (
                <Button
                  key={r.value}
                  variant={intake.partyRole === r.value ? 'default' : 'outline'}
                  className="w-full justify-start h-auto py-3 text-right"
                  onClick={() => setIntake(f => ({ ...f, partyRole: r.value }))}
                >
                  {r.label}
                </Button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label>من هو الطرف الآخر؟ (اختياري)</Label>
            <Input
              value={intake.otherParty}
              onChange={e => setIntake(f => ({ ...f, otherParty: e.target.value }))}
              placeholder="مثال: المكري / الزوج / المشغل / الشركة..."
            />
          </div>
        </div>
      ),
    },
    {
      title: 'وقائع النازلة',
      icon: <FileText className="h-5 w-5" />,
      valid: intake.facts.trim().length >= 30,
      content: (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-base font-semibold">اشرح الوقائع بالتفصيل *</Label>
            <p className="text-xs text-muted-foreground">كلما كانت المعلومات أكثر تفصيلاً، كانت الاستشارة أدق (30 حرف على الأقل)</p>
            <Textarea
              value={intake.facts}
              onChange={e => setIntake(f => ({ ...f, facts: e.target.value }))}
              placeholder="اشرح ماذا حدث بالتفصيل... مثال: أنا مكتري لمحل تجاري منذ 10 سنوات، المكري يريد إفراغي بدون سبب مشروع، أرسل لي إنذاراً عبر المفوض القضائي..."
              rows={6}
              className="min-h-[120px]"
            />
            <p className="text-xs text-muted-foreground text-left" dir="ltr">{intake.facts.length} / 30+</p>
          </div>
          <div className="space-y-2">
            <Label>التسلسل الزمني (اختياري)</Label>
            <Textarea
              value={intake.timeline}
              onChange={e => setIntake(f => ({ ...f, timeline: e.target.value }))}
              placeholder="مثال: في يناير 2024 توصلت بالإنذار، في مارس 2024 رفعت دعوى..."
              rows={3}
            />
          </div>
        </div>
      ),
    },
    {
      title: 'معلومات إضافية',
      icon: <ClipboardList className="h-5 w-5" />,
      valid: true,
      content: (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>هل قمت بأي إجراءات سابقة؟</Label>
            <Textarea
              value={intake.previousActions}
              onChange={e => setIntake(f => ({ ...f, previousActions: e.target.value }))}
              placeholder="مثال: رفعت دعوى أمام المحكمة الابتدائية / أرسلت إنذاراً / لا شيء بعد..."
              rows={3}
            />
          </div>
          <div className="space-y-2">
            <Label>ما هي الوثائق المتوفرة لديك؟</Label>
            <Textarea
              value={intake.documents}
              onChange={e => setIntake(f => ({ ...f, documents: e.target.value }))}
              placeholder="مثال: عقد الكراء، وصولات الأداء، الإنذار، حكم ابتدائي..."
              rows={2}
            />
          </div>
          <div className="space-y-2">
            <Label>ما النتيجة التي تريد الوصول إليها؟</Label>
            <Select value={intake.desiredOutcome} onValueChange={v => setIntake(f => ({ ...f, desiredOutcome: v }))}>
              <SelectTrigger><SelectValue placeholder="اختر..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="معرفة حقوقي فقط">معرفة حقوقي فقط</SelectItem>
                <SelectItem value="رفع دعوى قضائية">رفع دعوى قضائية</SelectItem>
                <SelectItem value="الدفاع عن نفسي في دعوى مرفوعة ضدي">الدفاع عن نفسي</SelectItem>
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
        <title>الاستشارة الذكية - محاماة ذكية</title>
        <meta name="description" content="استشارة قانونية ذكية بالذكاء الاصطناعي متخصصة في القانون المغربي واجتهادات محكمة النقض" />
      </Helmet>
      <div className="min-h-screen bg-background flex flex-col">
        <nav className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
          <div className="container mx-auto px-4 flex items-center justify-between h-16">
            <Link to="/" className="flex items-center gap-2">
              <Scale className="h-6 w-6 text-primary" />
              <span className="text-lg font-bold">محاماة ذكية</span>
            </Link>
            {mode === 'chat' ? (
              <Button variant="ghost" size="sm" onClick={resetConsultation} className="gap-1">
                استشارة جديدة <ArrowLeft className="h-3 w-3" />
              </Button>
            ) : (
              <Link to="/" className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1">
                الرئيسية <ArrowLeft className="h-3 w-3" />
              </Link>
            )}
          </div>
        </nav>

        <main className="flex-1 container mx-auto px-4 py-6 max-w-3xl flex flex-col">
          {mode === 'intake' ? (
            /* ===== INTAKE FORM ===== */
            <div className="space-y-6">
              <div className="text-center space-y-2">
                <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                  <Brain className="h-7 w-7 text-primary" />
                </div>
                <h1 className="text-2xl font-bold text-foreground">الاستشارة الذكية</h1>
                <p className="text-sm text-muted-foreground">أجب على الأسئلة التالية للحصول على استشارة دقيقة ومبنية على القانون المغربي</p>
              </div>

              {/* Progress */}
              <div className="flex items-center gap-1 justify-center">
                {steps.map((s, i) => (
                  <div key={i} className="flex items-center gap-1">
                    <button
                      onClick={() => setStep(i)}
                      className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                        i === step
                          ? 'bg-primary text-primary-foreground'
                          : i < step && steps[i].valid
                          ? 'bg-primary/20 text-primary'
                          : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      {i + 1}
                    </button>
                    {i < steps.length - 1 && (
                      <div className={`w-8 h-0.5 ${i < step ? 'bg-primary/40' : 'bg-muted'}`} />
                    )}
                  </div>
                ))}
              </div>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    {steps[step].icon}
                    {steps[step].title}
                    <span className="text-xs font-normal text-muted-foreground mr-auto">الخطوة {step + 1} من {steps.length}</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {steps[step].content}

                  <div className="flex gap-2 pt-4">
                    {step > 0 && (
                      <Button variant="outline" onClick={() => setStep(s => s - 1)} className="gap-1">
                        <ChevronRight className="h-4 w-4" />
                        السابق
                      </Button>
                    )}
                    {step < steps.length - 1 ? (
                      <Button
                        onClick={() => setStep(s => s + 1)}
                        disabled={!steps[step].valid}
                        className="gap-1 mr-auto"
                      >
                        التالي
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                    ) : (
                      <Button
                        onClick={startConsultation}
                        disabled={!intake.caseType || intake.facts.trim().length < 30}
                        className="gap-2 mr-auto bg-green-600 hover:bg-green-700"
                      >
                        <Brain className="h-4 w-4" />
                        ابدأ الاستشارة
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Warning */}
              <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/50 rounded-lg p-3">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-500" />
                <span>هذه استشارة أولية توجيهية بالذكاء الاصطناعي ولا تغني عن استشارة محامٍ مختص. المعلومات المقدمة مبنية على القانون المغربي واجتهادات محكمة النقض.</span>
              </div>

              {/* Quick chat option */}
              <div className="text-center">
                <Button
                  variant="link"
                  className="text-xs text-muted-foreground"
                  onClick={() => {
                    setCaseContext('');
                    setMessages([{
                      role: 'assistant',
                      content: 'مرحباً! أنا المستشار القانوني الذكي. اطرح سؤالك القانوني وسأحاول مساعدتك.\n\n⚠️ *للحصول على استشارة أدق، استخدم الاستمارة أعلاه.*'
                    }]);
                    setMode('chat');
                  }}
                >
                  أو اطرح سؤالاً مباشراً بدون استمارة →
                </Button>
              </div>
            </div>
          ) : (
            /* ===== CHAT MODE ===== */
            <Card className="flex-1 flex flex-col overflow-hidden">
              <div ref={scrollRef} className="flex-1 overflow-y-auto p-4" style={{ maxHeight: 'calc(100vh - 200px)' }}>
                <div className="space-y-4">
                  {messages.map((msg, i) => (
                    <div
                      key={i}
                      className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
                    >
                      <div
                        className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${
                          msg.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'
                        }`}
                      >
                        {msg.role === 'user' ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                      </div>
                      <div
                        className={`rounded-xl px-4 py-3 max-w-[85%] text-sm ${
                          msg.role === 'user'
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted text-foreground'
                        }`}
                      >
                        {msg.role === 'assistant' ? (
                          <div className="prose prose-sm dark:prose-invert max-w-none">
                            <ReactMarkdown>{msg.content}</ReactMarkdown>
                          </div>
                        ) : (
                          <span className="whitespace-pre-wrap">{msg.content}</span>
                        )}
                      </div>
                    </div>
                  ))}
                  {loading && messages[messages.length - 1]?.role !== 'assistant' && (
                    <div className="flex gap-3">
                      <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                        <Bot className="h-4 w-4" />
                      </div>
                      <div className="bg-muted rounded-xl px-4 py-3">
                        <div className="flex gap-1">
                          <span className="w-2 h-2 bg-muted-foreground/40 rounded-full animate-bounce" />
                          <span className="w-2 h-2 bg-muted-foreground/40 rounded-full animate-bounce" style={{ animationDelay: '0.15s' }} />
                          <span className="w-2 h-2 bg-muted-foreground/40 rounded-full animate-bounce" style={{ animationDelay: '0.3s' }} />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <CardContent className="border-t border-border p-4">
                <div className="flex gap-2">
                  <Textarea
                    placeholder="اطرح سؤالاً إضافياً أو اطلب توضيحاً..."
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSend();
                      }
                    }}
                    className="min-h-[44px] max-h-32 resize-none"
                    rows={1}
                  />
                  <Button onClick={handleSend} disabled={loading || !input.trim()} size="icon" className="shrink-0">
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </main>
      </div>
    </>
  );
};

export default AIConsultation;
