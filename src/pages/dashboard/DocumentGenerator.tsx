import { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import {
  FileText, Plus, Search, Download, Loader2, Save, Eye,
  FileUp, Trash2, RefreshCw, History, Sparkles, BookOpen,
  MessageSquareReply, ChevronDown, ChevronUp, Link2, ArrowLeft
} from 'lucide-react';
import { Document, Packer, Paragraph, TextRun, AlignmentType, HeadingLevel } from 'docx';
import { saveAs } from 'file-saver';

const DOC_TYPES = [
  { value: 'مقال افتتاحي', label: 'مقال افتتاحي', icon: '📋', isInitial: true },
  { value: 'مذكرة جوابية', label: 'مذكرة جوابية', icon: '📝', isInitial: false },
  { value: 'مذكرة تعقيبية', label: 'مذكرة تعقيبية', icon: '🔄', isInitial: false },
  { value: 'مقال بالاستئناف', label: 'مقال بالاستئناف', icon: '⚖️', isInitial: true },
  { value: 'مقال بالنقض', label: 'مقال بالنقض', icon: '🏛️', isInitial: true },
  { value: 'مذكرة المطالبة المدنية', label: 'مذكرة المطالبة المدنية', icon: '💰', isInitial: true },
  { value: 'مقال الدخل الارادي', label: 'مقال التدخل الإرادي', icon: '🤝', isInitial: true },
  { value: 'إنذار بالإفراغ', label: 'إنذار بالإفراغ', icon: '🏠', isInitial: true },
  { value: 'إنذار بالأداء', label: 'إنذار بالأداء', icon: '💳', isInitial: true },
  { value: 'رسالة صلح تأمين', label: 'رسالة صلح لشركة التأمين', icon: '🛡️', isInitial: true },
];

const COURTS = [
  'المحكمة الابتدائية', 'المحكمة التجارية', 'المحكمة الإدارية',
  'محكمة الاستئناف', 'محكمة الاستئناف التجارية', 'محكمة الاستئناف الإدارية',
  'محكمة النقض',
];

// Auto-suggest next doc type based on current
const getNextDocType = (current: string): string => {
  if (current === 'مقال افتتاحي') return 'مذكرة تعقيبية';
  if (current === 'مذكرة جوابية') return 'مذكرة تعقيبية';
  if (current === 'مذكرة تعقيبية') return 'مذكرة تعقيبية';
  if (current === 'مقال بالاستئناف') return 'مذكرة تعقيبية';
  return 'مذكرة تعقيبية';
};

interface FormData {
  clientName: string;
  opposingParty: string;
  court: string;
  nextCourt: string;
  caseNumber: string;
  subject: string;
  facts: string;
  requests: string;
  additionalNotes: string;
}

const emptyForm: FormData = {
  clientName: '', opposingParty: '', court: '', nextCourt: '',
  caseNumber: '', subject: '', facts: '', requests: '', additionalNotes: '',
};

interface ThreadDoc {
  id: string;
  doc_type: string;
  content: string;
  opponent_memo: string | null;
  step_number: number;
  status: string;
  created_at: string;
  thread_id: string | null;
}

const DocumentGenerator = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('create');
  const [docType, setDocType] = useState('');
  const [formData, setFormData] = useState<FormData>(emptyForm);
  const [generatedContent, setGeneratedContent] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [opponentMemo, setOpponentMemo] = useState('');
  const [savedDocs, setSavedDocs] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loadingDocs, setLoadingDocs] = useState(true);
  const [clients, setClients] = useState<any[]>([]);
  const [selectedClientId, setSelectedClientId] = useState('');
  const [selectedCaseId, setSelectedCaseId] = useState('');
  const [cases, setCases] = useState<any[]>([]);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<any>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  // Thread state
  const [currentThreadId, setCurrentThreadId] = useState<string | null>(null);
  const [threadDocs, setThreadDocs] = useState<ThreadDoc[]>([]);
  const [threadStep, setThreadStep] = useState(1);
  const [expandedSteps, setExpandedSteps] = useState<Set<number>>(new Set());

  // Load saved docs, clients, cases
  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const [docsRes, clientsRes, casesRes] = await Promise.all([
        supabase.from('generated_documents').select('*').order('created_at', { ascending: false }),
        supabase.from('clients').select('id, full_name'),
        supabase.from('cases').select('id, title, case_number, court'),
      ]);
      if (docsRes.data) setSavedDocs(docsRes.data);
      if (clientsRes.data) setClients(clientsRes.data);
      if (casesRes.data) setCases(casesRes.data);
      setLoadingDocs(false);
    };
    load();
  }, [user]);

  // Auto-fill from client/case selection
  useEffect(() => {
    if (selectedClientId) {
      const client = clients.find(c => c.id === selectedClientId);
      if (client) setFormData(prev => ({ ...prev, clientName: client.full_name }));
    }
  }, [selectedClientId, clients]);

  useEffect(() => {
    if (selectedCaseId) {
      const c = cases.find(x => x.id === selectedCaseId);
      if (c) setFormData(prev => ({ ...prev, caseNumber: c.case_number || '', court: c.court || '' }));
    }
  }, [selectedCaseId, cases]);

  const updateField = (field: keyof FormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // Load thread documents
  const loadThread = async (threadId: string) => {
    const { data } = await supabase
      .from('generated_documents')
      .select('*')
      .eq('thread_id', threadId)
      .order('step_number', { ascending: true });
    if (data) {
      setThreadDocs(data as any);
      setThreadStep(data.length + 1);
    }
  };

  // Start new thread
  const startNewThread = () => {
    const newThreadId = crypto.randomUUID();
    setCurrentThreadId(newThreadId);
    setThreadDocs([]);
    setThreadStep(1);
    setGeneratedContent('');
    setOpponentMemo('');
  };

  // Continue thread: opponent replied, prepare counter-response
  const continueThread = () => {
    if (!currentThreadId || !threadDocs.length) return;
    const lastDoc = threadDocs[threadDocs.length - 1];
    setDocType(getNextDocType(lastDoc.doc_type));
    setGeneratedContent('');
    // Keep form data (same case)
  };

  const handleGenerate = useCallback(async () => {
    if (!docType) {
      toast({ title: 'اختر نوع المستند', variant: 'destructive' });
      return;
    }
    if (!formData.clientName || !formData.subject) {
      toast({ title: 'يرجى ملء الحقول الإلزامية (الموكل والموضوع)', variant: 'destructive' });
      return;
    }

    setIsGenerating(true);
    setGeneratedContent('');

    // Build thread history for context
    const threadHistory = threadDocs.map(doc => ({
      step: doc.step_number,
      docType: doc.doc_type,
      content: doc.content,
      opponentMemo: doc.opponent_memo,
    }));

    try {
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-legal-doc`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            docType,
            formData,
            opponentMemo: opponentMemo || undefined,
            threadHistory: threadHistory.length > 0 ? threadHistory : undefined,
          }),
        }
      );

      if (!resp.ok) {
        const err = await resp.json();
        throw new Error(err.error || 'خطأ في التوليد');
      }

      const reader = resp.body?.getReader();
      if (!reader) throw new Error('No stream');
      const decoder = new TextDecoder();
      let buffer = '';
      let fullText = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let idx: number;
        while ((idx = buffer.indexOf('\n')) !== -1) {
          let line = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 1);
          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (!line.startsWith('data: ')) continue;
          const json = line.slice(6).trim();
          if (json === '[DONE]') break;
          try {
            const parsed = JSON.parse(json);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              fullText += content;
              setGeneratedContent(fullText);
            }
          } catch { /* partial */ }
        }
      }
    } catch (e: any) {
      toast({ title: 'خطأ', description: e.message, variant: 'destructive' });
    } finally {
      setIsGenerating(false);
    }
  }, [docType, formData, opponentMemo, threadDocs, toast]);

  const handleSave = async (status: 'draft' | 'final') => {
    if (!generatedContent || !user) return;

    // Ensure thread exists
    let threadId = currentThreadId;
    if (!threadId) {
      threadId = crypto.randomUUID();
      setCurrentThreadId(threadId);
    }

    try {
      const parentId = threadDocs.length > 0 ? threadDocs[threadDocs.length - 1].id : null;

      const { data, error } = await supabase.from('generated_documents').insert({
        user_id: user.id,
        client_id: selectedClientId || null,
        case_id: selectedCaseId || null,
        doc_type: docType,
        title: `${docType} - ${formData.clientName} - ${formData.subject}`.slice(0, 200),
        content: generatedContent,
        court: formData.court || null,
        next_court: formData.nextCourt || null,
        case_number: formData.caseNumber || null,
        opposing_party: formData.opposingParty || null,
        client_name: formData.clientName || null,
        status,
        thread_id: threadId,
        parent_id: parentId,
        step_number: threadStep,
        opponent_memo: opponentMemo || null,
        metadata: { subject: formData.subject, facts: formData.facts, requests: formData.requests },
      } as any).select().single();

      if (error) throw error;

      // Upload attachments
      if (data && attachments.length > 0) {
        for (const file of attachments) {
          const path = `${user.id}/${data.id}/${file.name}`;
          const { error: uploadErr } = await supabase.storage.from('document-attachments').upload(path, file);
          if (!uploadErr) {
            await supabase.from('document_attachments').insert({
              document_id: data.id,
              file_name: file.name,
              file_path: path,
              file_type: file.type,
            } as any);
          }
        }
      }

      toast({ title: status === 'draft' ? 'تم حفظ المسودة' : 'تم حفظ المستند في سلسلة القضية' });
      
      // Update thread docs
      setThreadDocs(prev => [...prev, data as any]);
      setThreadStep(prev => prev + 1);
      setSavedDocs(prev => [data, ...prev]);
      setAttachments([]);
    } catch (e: any) {
      toast({ title: 'خطأ في الحفظ', description: e.message, variant: 'destructive' });
    }
  };

  const handleExportWord = async (content?: string) => {
    const text = content || generatedContent;
    if (!text) return;
    const lines = text.split('\n').filter(l => l.trim());
    const paragraphs = lines.map(line => {
      const isHeader = line.startsWith('بسم') || line.includes('إلى السيد') || line.includes('بناءً عليه') || line.includes('الوقائع') || line.includes('في الموضوع') || line.includes('لهذه الأسباب') || line.includes('من حيث الشكل') || line.includes('من حيث الموضوع');
      return new Paragraph({
        children: [new TextRun({
          text: line,
          font: 'Traditional Arabic',
          size: isHeader ? 28 : 24,
          bold: isHeader,
          rightToLeft: true,
        })],
        alignment: AlignmentType.RIGHT,
        spacing: { after: 200, line: 360 },
        heading: isHeader ? HeadingLevel.HEADING_2 : undefined,
        bidirectional: true,
      });
    });

    const doc = new Document({
      sections: [{
        properties: { page: { margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 } } },
        children: paragraphs,
      }],
    });

    const blob = await Packer.toBlob(doc);
    saveAs(blob, `${docType}_${formData.clientName || 'document'}_${new Date().toISOString().slice(0, 10)}.docx`);
    toast({ title: 'تم تصدير الملف بنجاح' });
  };

  // Group saved docs by thread
  const threadGroups = savedDocs.reduce<Record<string, any[]>>((acc, doc) => {
    const tid = doc.thread_id || doc.id;
    if (!acc[tid]) acc[tid] = [];
    acc[tid].push(doc);
    return acc;
  }, {});

  const filteredThreads = Object.entries(threadGroups).filter(([, docs]) =>
    docs.some(d =>
      (d.client_name || '').includes(searchQuery) ||
      (d.opposing_party || '').includes(searchQuery) ||
      (d.case_number || '').includes(searchQuery) ||
      (d.title || '').includes(searchQuery)
    )
  );

  const handleLoadThread = async (threadId: string, docs: any[]) => {
    const sorted = docs.sort((a: any, b: any) => (a.step_number || 1) - (b.step_number || 1));
    const first = sorted[0];
    
    setCurrentThreadId(threadId);
    setThreadDocs(sorted);
    setThreadStep(sorted.length + 1);
    setDocType(getNextDocType(sorted[sorted.length - 1].doc_type));
    setGeneratedContent('');
    setOpponentMemo('');
    setFormData({
      clientName: first.client_name || '',
      opposingParty: first.opposing_party || '',
      court: first.court || '',
      nextCourt: first.next_court || '',
      caseNumber: first.case_number || '',
      subject: first.metadata?.subject || '',
      facts: first.metadata?.facts || '',
      requests: first.metadata?.requests || '',
      additionalNotes: '',
    });
    setActiveTab('create');
  };

  const toggleStep = (step: number) => {
    setExpandedSteps(prev => {
      const next = new Set(prev);
      if (next.has(step)) next.delete(step);
      else next.add(step);
      return next;
    });
  };

  const resetAll = () => {
    setCurrentThreadId(null);
    setThreadDocs([]);
    setThreadStep(1);
    setDocType('');
    setFormData(emptyForm);
    setGeneratedContent('');
    setOpponentMemo('');
    setAttachments([]);
    setSelectedClientId('');
    setSelectedCaseId('');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-primary" />
            مولّد المستندات القانونية
          </h1>
          <p className="text-muted-foreground">إنشاء المقالات والمذكرات مع تتبع سلسلة التقاضي</p>
        </div>
        <Button onClick={resetAll} variant="outline" className="gap-2">
          <Plus className="h-4 w-4" /> قضية جديدة
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="create" className="gap-2"><Plus className="h-4 w-4" /> إنشاء</TabsTrigger>
          <TabsTrigger value="thread" className="gap-2"><Link2 className="h-4 w-4" /> سلسلة القضية</TabsTrigger>
          <TabsTrigger value="history" className="gap-2"><History className="h-4 w-4" /> السجل</TabsTrigger>
        </TabsList>

        {/* ==================== CREATE TAB ==================== */}
        <TabsContent value="create" className="space-y-4 mt-4">
          {/* Thread indicator */}
          {currentThreadId && threadDocs.length > 0 && (
            <Card className="border-primary/30 bg-primary/5">
              <CardContent className="py-3 px-4">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2 text-sm">
                    <Link2 className="h-4 w-4 text-primary" />
                    <span className="font-medium text-foreground">
                      سلسلة قضية: {formData.clientName} ضد {formData.opposingParty}
                    </span>
                    <Badge variant="outline">{threadDocs.length} مستند(ات)</Badge>
                    <Badge variant="secondary">الخطوة {threadStep}</Badge>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => setActiveTab('thread')}>
                    عرض السلسلة
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Step 1: Document Type */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">1. نوع المستند</CardTitle>
              {currentThreadId && threadDocs.length > 0 && (
                <CardDescription>
                  الخطوة التالية المقترحة: {getNextDocType(threadDocs[threadDocs.length - 1]?.doc_type || '')}
                </CardDescription>
              )}
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
                {DOC_TYPES.map(dt => (
                  <button
                    key={dt.value}
                    onClick={() => setDocType(dt.value)}
                    className={`p-3 rounded-lg border text-center text-sm transition-all ${
                      docType === dt.value
                        ? 'border-primary bg-primary/10 text-primary font-medium'
                        : 'border-border hover:border-primary/50 text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <div className="text-xl mb-1">{dt.icon}</div>
                    {dt.label}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Step 2: Form - only show full form for first doc in thread */}
          {docType && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">2. بيانات المستند</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>الموكل *</Label>
                    {clients.length > 0 && (
                      <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                        <SelectTrigger><SelectValue placeholder="اختر موكلاً" /></SelectTrigger>
                        <SelectContent>
                          {clients.map(c => (
                            <SelectItem key={c.id} value={c.id}>{c.full_name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                    <Input placeholder="اسم الموكل" value={formData.clientName} onChange={e => updateField('clientName', e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>الخصم</Label>
                    <Input placeholder="اسم الخصم" value={formData.opposingParty} onChange={e => updateField('opposingParty', e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>ملف القضية</Label>
                    {cases.length > 0 && (
                      <Select value={selectedCaseId} onValueChange={setSelectedCaseId}>
                        <SelectTrigger><SelectValue placeholder="ربط بقضية موجودة" /></SelectTrigger>
                        <SelectContent>
                          {cases.map(c => (
                            <SelectItem key={c.id} value={c.id}>{c.case_number} - {c.title}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label>رقم الملف</Label>
                    <Input placeholder="رقم الملف" value={formData.caseNumber} onChange={e => updateField('caseNumber', e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>المحكمة</Label>
                    <Select value={formData.court} onValueChange={v => updateField('court', v)}>
                      <SelectTrigger><SelectValue placeholder="اختر المحكمة" /></SelectTrigger>
                      <SelectContent>
                        {COURTS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  {(docType.includes('استئناف') || docType.includes('نقض')) && (
                    <div className="space-y-2">
                      <Label>المحكمة المحال إليها</Label>
                      <Select value={formData.nextCourt} onValueChange={v => updateField('nextCourt', v)}>
                        <SelectTrigger><SelectValue placeholder="المحكمة التالية" /></SelectTrigger>
                        <SelectContent>
                          {COURTS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>الموضوع *</Label>
                  <Input placeholder="موضوع المستند" value={formData.subject} onChange={e => updateField('subject', e.target.value)} />
                </div>

                {/* Only show facts/requests for first doc or if not in thread */}
                {(threadDocs.length === 0) && (
                  <>
                    <div className="space-y-2">
                      <Label>الوقائع</Label>
                      <Textarea rows={4} placeholder="اذكر الوقائع بشكل مفصل..." value={formData.facts} onChange={e => updateField('facts', e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>الطلبات</Label>
                      <Textarea rows={3} placeholder="ما هي الطلبات المقدمة..." value={formData.requests} onChange={e => updateField('requests', e.target.value)} />
                    </div>
                  </>
                )}

                <div className="space-y-2">
                  <Label>ملاحظات إضافية</Label>
                  <Textarea rows={2} placeholder="أي معلومات إضافية..." value={formData.additionalNotes} onChange={e => updateField('additionalNotes', e.target.value)} />
                </div>
              </CardContent>
            </Card>
          )}

          {/* Step 3: Opponent's memo + attachments */}
          {docType && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <MessageSquareReply className="h-5 w-5" />
                  3. {threadDocs.length > 0 ? 'مذكرة الخصم الجديدة والمرفقات' : 'الوثائق المرفقة ومذكرة الخصم'}
                </CardTitle>
                {threadDocs.length > 0 && (
                  <CardDescription>
                    الصق مذكرة الخصم الأخيرة وسيقوم الذكاء الاصطناعي بالتعقيب عليها مع مراعاة كل المستندات السابقة في القضية
                  </CardDescription>
                )}
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Opponent memo - always visible for thread continuation */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-2 text-base font-medium">
                    <BookOpen className="h-4 w-4 text-primary" />
                    {threadDocs.length > 0 ? 'مذكرة الخصم (الرد الأخير)' : 'مذكرة الخصم (إن وجدت)'}
                  </Label>
                  <Textarea
                    rows={6}
                    placeholder={threadDocs.length > 0
                      ? 'الصق نص مذكرة الخصم الجوابية أو التعقيبية هنا... سيتم الرد عليها تلقائياً بناءً على كامل سياق القضية'
                      : 'الصق نص مذكرة الخصم هنا للرد عليها...'
                    }
                    value={opponentMemo}
                    onChange={e => setOpponentMemo(e.target.value)}
                    className="border-primary/30 focus:border-primary"
                  />
                </div>

                <Separator />

                {/* File upload */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-2"><FileUp className="h-4 w-4" /> إرفاق وثائق (PDF / Word)</Label>
                  <Input
                    type="file"
                    multiple
                    accept=".pdf,.doc,.docx"
                    onChange={e => {
                      if (e.target.files) setAttachments(prev => [...prev, ...Array.from(e.target.files!)]);
                    }}
                  />
                  {attachments.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {attachments.map((f, i) => (
                        <Badge key={i} variant="secondary" className="gap-1">
                          {f.name}
                          <button onClick={() => setAttachments(prev => prev.filter((_, j) => j !== i))}>
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Generate Button */}
          {docType && (
            <div className="flex gap-2 flex-wrap">
              <Button onClick={handleGenerate} disabled={isGenerating} className="gap-2" size="lg">
                {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                {isGenerating ? 'جاري التوليد...' :
                  threadDocs.length > 0 ? `توليد ${docType}` :
                  generatedContent ? 'إعادة التوليد' : 'توليد المستند'}
              </Button>
              {generatedContent && (
                <>
                  <Button variant="outline" onClick={() => handleSave('draft')} className="gap-2">
                    <Save className="h-4 w-4" /> حفظ كمسودة
                  </Button>
                  <Button onClick={() => handleSave('final')} className="gap-2">
                    <Save className="h-4 w-4" /> حفظ في سلسلة القضية
                  </Button>
                  <Button variant="outline" onClick={() => handleExportWord()} className="gap-2">
                    <Download className="h-4 w-4" /> تصدير Word
                  </Button>
                </>
              )}
            </div>
          )}

          {/* Generated Content */}
          {(generatedContent || isGenerating) && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    {docType} - الخطوة {threadStep}
                  </span>
                  <Badge variant={isGenerating ? 'secondary' : 'default'}>
                    {isGenerating ? 'جاري الكتابة...' : 'مكتمل'}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div
                  ref={contentRef}
                  dir="rtl"
                  className="bg-muted/30 rounded-lg p-6 min-h-[300px] whitespace-pre-wrap leading-8 text-foreground font-serif border border-border"
                  style={{ fontFamily: "'Traditional Arabic', 'Amiri', serif", fontSize: '16px' }}
                >
                  {generatedContent || (
                    <div className="flex items-center justify-center h-[200px] text-muted-foreground">
                      <Loader2 className="h-6 w-6 animate-spin ml-2" />
                      جاري صياغة المستند...
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ==================== THREAD TAB ==================== */}
        <TabsContent value="thread" className="space-y-4 mt-4">
          {!currentThreadId || threadDocs.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Link2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground text-lg mb-2">لا توجد سلسلة قضية نشطة</p>
                <p className="text-sm text-muted-foreground mb-4">أنشئ مقالاً افتتاحياً أولاً أو اختر قضية من السجل</p>
                <Button onClick={() => { startNewThread(); setActiveTab('create'); }} className="gap-2">
                  <Plus className="h-4 w-4" /> بدء قضية جديدة
                </Button>
              </CardContent>
            </Card>
          ) : (
            <>
              <Card className="border-primary/30">
                <CardContent className="py-3 px-4">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div>
                      <h3 className="font-bold text-foreground">
                        {formData.clientName} ضد {formData.opposingParty}
                      </h3>
                      <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
                        {formData.caseNumber && <span>ملف رقم: {formData.caseNumber}</span>}
                        {formData.court && <span>• {formData.court}</span>}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => { continueThread(); setActiveTab('create'); }} className="gap-1">
                        <MessageSquareReply className="h-4 w-4" /> إضافة رد / تعقيب
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Timeline */}
              <div className="space-y-3">
                {threadDocs.map((doc, idx) => (
                  <Card key={doc.id} className="relative">
                    {/* Timeline connector */}
                    {idx < threadDocs.length - 1 && (
                      <div className="absolute right-6 -bottom-3 w-0.5 h-6 bg-border z-10" />
                    )}
                    <CardContent className="py-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm shrink-0">
                            {doc.step_number}
                          </div>
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium text-foreground">{doc.doc_type}</span>
                              <Badge variant={doc.status === 'final' ? 'default' : 'secondary'} className="text-xs">
                                {doc.status === 'final' ? 'نهائي' : 'مسودة'}
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                {new Date(doc.created_at).toLocaleDateString('ar-MA')}
                              </span>
                            </div>
                            {doc.opponent_memo && (
                              <p className="text-xs text-muted-foreground mt-1">
                                📨 يتضمن رد الخصم
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-1">
                          <Button size="sm" variant="ghost" onClick={() => toggleStep(doc.step_number)}>
                            {expandedSteps.has(doc.step_number) ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => handleExportWord(doc.content)}>
                            <Download className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => { setPreviewDoc(doc); setPreviewOpen(true); }}>
                            <Eye className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      {expandedSteps.has(doc.step_number) && (
                        <div className="mt-3 space-y-3">
                          {doc.opponent_memo && (
                            <div className="bg-destructive/5 border border-destructive/20 rounded-lg p-3">
                              <p className="text-xs font-medium text-destructive mb-1">📨 مذكرة الخصم:</p>
                              <p className="text-sm text-foreground whitespace-pre-wrap line-clamp-6">{doc.opponent_memo}</p>
                            </div>
                          )}
                          <div
                            dir="rtl"
                            className="bg-muted/30 rounded-lg p-4 whitespace-pre-wrap leading-7 text-sm border border-border max-h-[300px] overflow-y-auto"
                            style={{ fontFamily: "'Traditional Arabic', 'Amiri', serif" }}
                          >
                            {doc.content}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}

                {/* Next step prompt */}
                <Card className="border-dashed border-2 border-primary/30">
                  <CardContent className="py-6 text-center">
                    <MessageSquareReply className="h-8 w-8 text-primary/50 mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground mb-3">
                      هل رد الخصم؟ أضف مذكرته وسيتم التعقيب عليها تلقائياً
                    </p>
                    <Button onClick={() => { continueThread(); setActiveTab('create'); }} variant="outline" className="gap-2">
                      <Plus className="h-4 w-4" /> إضافة رد الخصم والتعقيب
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </TabsContent>

        {/* ==================== HISTORY TAB ==================== */}
        <TabsContent value="history" className="space-y-4 mt-4">
          <div className="relative max-w-md">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="بحث بالاسم، رقم الملف، أو الخصم..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pr-10"
            />
          </div>

          {loadingDocs ? (
            <div className="text-center py-12"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></div>
          ) : filteredThreads.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                لا توجد مستندات محفوظة
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {filteredThreads.map(([threadId, docs]) => {
                const sorted = docs.sort((a: any, b: any) => (a.step_number || 1) - (b.step_number || 1));
                const first = sorted[0];
                return (
                  <Card key={threadId} className="hover:border-primary/30 transition-colors cursor-pointer" onClick={() => handleLoadThread(first.thread_id || threadId, sorted)}>
                    <CardContent className="py-4">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <Link2 className="h-4 w-4 text-primary" />
                            <span className="font-medium text-foreground">
                              {first.client_name || 'بدون موكل'} {first.opposing_party ? `ضد ${first.opposing_party}` : ''}
                            </span>
                            <Badge variant="outline" className="text-xs">{sorted.length} مستند</Badge>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            {first.case_number && <span>ملف: {first.case_number}</span>}
                            {first.court && <span>• {first.court}</span>}
                            <span>• {new Date(first.created_at).toLocaleDateString('ar-MA')}</span>
                          </div>
                          <div className="flex items-center gap-1 mt-2 flex-wrap">
                            {sorted.map((d: any) => (
                              <Badge key={d.id} variant="secondary" className="text-xs">
                                {d.step_number}. {d.doc_type}
                              </Badge>
                            ))}
                          </div>
                        </div>
                        <Button size="sm" variant="outline" className="gap-1" onClick={(e) => { e.stopPropagation(); handleLoadThread(first.thread_id || threadId, sorted); }}>
                          <RefreshCw className="h-3 w-3" /> متابعة
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Preview Dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>{previewDoc?.doc_type} - {previewDoc?.client_name}</DialogTitle>
          </DialogHeader>
          <ScrollArea className="h-[60vh]">
            {previewDoc?.opponent_memo && (
              <div className="bg-destructive/5 border border-destructive/20 rounded-lg p-3 mb-4 mx-4">
                <p className="text-xs font-medium text-destructive mb-1">📨 مذكرة الخصم:</p>
                <p className="text-sm whitespace-pre-wrap">{previewDoc.opponent_memo}</p>
              </div>
            )}
            <div dir="rtl" className="whitespace-pre-wrap leading-8 p-4 font-serif" style={{ fontFamily: "'Traditional Arabic', 'Amiri', serif" }}>
              {previewDoc?.content}
            </div>
          </ScrollArea>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => { if (previewDoc) handleExportWord(previewDoc.content); }}>
              <Download className="h-4 w-4 ml-2" /> تصدير Word
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DocumentGenerator;
