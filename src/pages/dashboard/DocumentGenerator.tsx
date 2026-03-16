import { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import {
  FileText, Plus, Search, Download, Upload, Loader2, Save, Eye,
  FileUp, Trash2, RefreshCw, History, Sparkles, BookOpen
} from 'lucide-react';
import { Document, Packer, Paragraph, TextRun, AlignmentType, HeadingLevel } from 'docx';
import { saveAs } from 'file-saver';

const DOC_TYPES = [
  { value: 'مقال افتتاحي', label: 'مقال افتتاحي', icon: '📋' },
  { value: 'مذكرة جوابية', label: 'مذكرة جوابية', icon: '📝' },
  { value: 'مذكرة تعقيبية', label: 'مذكرة تعقيبية', icon: '🔄' },
  { value: 'مقال بالاستئناف', label: 'مقال بالاستئناف', icon: '⚖️' },
  { value: 'مقال بالنقض', label: 'مقال بالنقض', icon: '🏛️' },
  { value: 'مذكرة المطالبة المدنية', label: 'مذكرة المطالبة المدنية', icon: '💰' },
  { value: 'مقال الدخل الارادي', label: 'مقال التدخل الإرادي', icon: '🤝' },
  { value: 'إنذار بالإفراغ', label: 'إنذار بالإفراغ', icon: '🏠' },
  { value: 'إنذار بالأداء', label: 'إنذار بالأداء', icon: '💳' },
  { value: 'رسالة صلح تأمين', label: 'رسالة صلح لشركة التأمين', icon: '🛡️' },
];

const COURTS = [
  'المحكمة الابتدائية', 'المحكمة التجارية', 'المحكمة الإدارية',
  'محكمة الاستئناف', 'محكمة الاستئناف التجارية', 'محكمة الاستئناف الإدارية',
  'محكمة النقض',
];

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

  // When client selected, auto-fill name
  useEffect(() => {
    if (selectedClientId) {
      const client = clients.find(c => c.id === selectedClientId);
      if (client) setFormData(prev => ({ ...prev, clientName: client.full_name }));
    }
  }, [selectedClientId, clients]);

  // When case selected, auto-fill case info
  useEffect(() => {
    if (selectedCaseId) {
      const c = cases.find(x => x.id === selectedCaseId);
      if (c) setFormData(prev => ({ ...prev, caseNumber: c.case_number || '', court: c.court || '' }));
    }
  }, [selectedCaseId, cases]);

  const updateField = (field: keyof FormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
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
            previousResponse: generatedContent || undefined,
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
  }, [docType, formData, opponentMemo, generatedContent, toast]);

  const handleSave = async (status: 'draft' | 'final') => {
    if (!generatedContent || !user) return;
    try {
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

      toast({ title: status === 'draft' ? 'تم حفظ المسودة' : 'تم حفظ المستند' });
      setSavedDocs(prev => [data, ...prev]);
    } catch (e: any) {
      toast({ title: 'خطأ في الحفظ', description: e.message, variant: 'destructive' });
    }
  };

  const handleExportWord = async () => {
    if (!generatedContent) return;
    const lines = generatedContent.split('\n').filter(l => l.trim());
    const paragraphs = lines.map(line => {
      const isHeader = line.startsWith('بسم') || line.includes('إلى السيد') || line.includes('بناءً عليه') || line.includes('الوقائع') || line.includes('في الموضوع') || line.includes('لهذه الأسباب');
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
        properties: {
          page: { margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 } },
        },
        children: paragraphs,
      }],
    });

    const blob = await Packer.toBlob(doc);
    saveAs(blob, `${docType}_${formData.clientName || 'document'}_${new Date().toISOString().slice(0, 10)}.docx`);
    toast({ title: 'تم تصدير الملف بنجاح' });
  };

  const filteredDocs = savedDocs.filter(d =>
    (d.client_name || '').includes(searchQuery) ||
    (d.opposing_party || '').includes(searchQuery) ||
    (d.case_number || '').includes(searchQuery) ||
    (d.title || '').includes(searchQuery) ||
    (d.doc_type || '').includes(searchQuery)
  );

  const handleLoadDoc = (doc: any) => {
    setDocType(doc.doc_type);
    setGeneratedContent(doc.content || '');
    setFormData({
      clientName: doc.client_name || '',
      opposingParty: doc.opposing_party || '',
      court: doc.court || '',
      nextCourt: doc.next_court || '',
      caseNumber: doc.case_number || '',
      subject: doc.metadata?.subject || '',
      facts: doc.metadata?.facts || '',
      requests: doc.metadata?.requests || '',
      additionalNotes: '',
    });
    setActiveTab('create');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-primary" />
            مولّد المستندات القانونية
          </h1>
          <p className="text-muted-foreground">إنشاء المقالات والمذكرات والإنذارات بالذكاء الاصطناعي</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="create" className="gap-2"><Plus className="h-4 w-4" /> إنشاء مستند</TabsTrigger>
          <TabsTrigger value="history" className="gap-2"><History className="h-4 w-4" /> السجل</TabsTrigger>
        </TabsList>

        {/* CREATE TAB */}
        <TabsContent value="create" className="space-y-4 mt-4">
          {/* Step 1: Document Type */}
          <Card>
            <CardHeader><CardTitle className="text-lg">1. نوع المستند</CardTitle></CardHeader>
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

          {/* Step 2: Form */}
          {docType && (
            <Card>
              <CardHeader><CardTitle className="text-lg">2. بيانات المستند</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Client */}
                  <div className="space-y-2">
                    <Label>الموكل *</Label>
                    {clients.length > 0 ? (
                      <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                        <SelectTrigger><SelectValue placeholder="اختر موكلاً أو اكتب الاسم" /></SelectTrigger>
                        <SelectContent>
                          {clients.map(c => (
                            <SelectItem key={c.id} value={c.id}>{c.full_name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : null}
                    <Input placeholder="اسم الموكل" value={formData.clientName} onChange={e => updateField('clientName', e.target.value)} />
                  </div>

                  {/* Opposing party */}
                  <div className="space-y-2">
                    <Label>الخصم</Label>
                    <Input placeholder="اسم الخصم" value={formData.opposingParty} onChange={e => updateField('opposingParty', e.target.value)} />
                  </div>

                  {/* Case */}
                  <div className="space-y-2">
                    <Label>ملف القضية</Label>
                    {cases.length > 0 ? (
                      <Select value={selectedCaseId} onValueChange={setSelectedCaseId}>
                        <SelectTrigger><SelectValue placeholder="ربط بقضية موجودة" /></SelectTrigger>
                        <SelectContent>
                          {cases.map(c => (
                            <SelectItem key={c.id} value={c.id}>{c.case_number} - {c.title}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : null}
                  </div>

                  {/* Case Number */}
                  <div className="space-y-2">
                    <Label>رقم الملف</Label>
                    <Input placeholder="رقم الملف" value={formData.caseNumber} onChange={e => updateField('caseNumber', e.target.value)} />
                  </div>

                  {/* Court */}
                  <div className="space-y-2">
                    <Label>المحكمة</Label>
                    <Select value={formData.court} onValueChange={v => updateField('court', v)}>
                      <SelectTrigger><SelectValue placeholder="اختر المحكمة" /></SelectTrigger>
                      <SelectContent>
                        {COURTS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Next Court (for appeals) */}
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

                <div className="space-y-2">
                  <Label>الوقائع</Label>
                  <Textarea rows={4} placeholder="اذكر الوقائع بشكل مفصل..." value={formData.facts} onChange={e => updateField('facts', e.target.value)} />
                </div>

                <div className="space-y-2">
                  <Label>الطلبات</Label>
                  <Textarea rows={3} placeholder="ما هي الطلبات المقدمة..." value={formData.requests} onChange={e => updateField('requests', e.target.value)} />
                </div>

                <div className="space-y-2">
                  <Label>ملاحظات إضافية</Label>
                  <Textarea rows={2} placeholder="أي معلومات إضافية..." value={formData.additionalNotes} onChange={e => updateField('additionalNotes', e.target.value)} />
                </div>
              </CardContent>
            </Card>
          )}

          {/* Step 3: Attachments & Opponent */}
          {docType && (
            <Card>
              <CardHeader><CardTitle className="text-lg">3. الوثائق المرفقة ومذكرة الخصم</CardTitle></CardHeader>
              <CardContent className="space-y-4">
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
                  <p className="text-xs text-muted-foreground">سيتم دراسة هذه الوثائق بالذكاء الاصطناعي لصياغة المستند</p>
                </div>

                {/* Opponent memo (for جوابية/تعقيبية) */}
                {(docType.includes('جوابية') || docType.includes('تعقيبية')) && (
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2"><BookOpen className="h-4 w-4" /> مذكرة الخصم</Label>
                    <Textarea
                      rows={5}
                      placeholder="الصق نص مذكرة الخصم هنا للرد عليها..."
                      value={opponentMemo}
                      onChange={e => setOpponentMemo(e.target.value)}
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Generate Button */}
          {docType && (
            <div className="flex gap-2 flex-wrap">
              <Button onClick={handleGenerate} disabled={isGenerating} className="gap-2" size="lg">
                {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                {isGenerating ? 'جاري التوليد...' : generatedContent ? 'إعادة التوليد' : 'توليد المستند'}
              </Button>
              {generatedContent && (
                <>
                  <Button variant="outline" onClick={() => handleSave('draft')} className="gap-2">
                    <Save className="h-4 w-4" /> حفظ كمسودة
                  </Button>
                  <Button variant="outline" onClick={() => handleSave('final')} className="gap-2">
                    <Save className="h-4 w-4" /> حفظ نهائي
                  </Button>
                  <Button variant="outline" onClick={handleExportWord} className="gap-2">
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
                    المستند المُنشأ
                  </span>
                  {generatedContent && (
                    <Badge variant={isGenerating ? 'secondary' : 'default'}>
                      {isGenerating ? 'جاري الكتابة...' : 'مكتمل'}
                    </Badge>
                  )}
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

        {/* HISTORY TAB */}
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

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>النوع</TableHead>
                    <TableHead>الموكل</TableHead>
                    <TableHead>الخصم</TableHead>
                    <TableHead>رقم الملف</TableHead>
                    <TableHead>المحكمة</TableHead>
                    <TableHead>الحالة</TableHead>
                    <TableHead>التاريخ</TableHead>
                    <TableHead>إجراءات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingDocs ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8">
                        <Loader2 className="h-5 w-5 animate-spin mx-auto" />
                      </TableCell>
                    </TableRow>
                  ) : filteredDocs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                        لا توجد مستندات محفوظة
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredDocs.map(doc => (
                      <TableRow key={doc.id}>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">{doc.doc_type}</Badge>
                        </TableCell>
                        <TableCell>{doc.client_name || '-'}</TableCell>
                        <TableCell>{doc.opposing_party || '-'}</TableCell>
                        <TableCell>{doc.case_number || '-'}</TableCell>
                        <TableCell>{doc.court || '-'}</TableCell>
                        <TableCell>
                          <Badge variant={doc.status === 'final' ? 'default' : 'secondary'}>
                            {doc.status === 'final' ? 'نهائي' : 'مسودة'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs">{new Date(doc.created_at).toLocaleDateString('ar-MA')}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button size="sm" variant="ghost" onClick={() => { setPreviewDoc(doc); setPreviewOpen(true); }}>
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => handleLoadDoc(doc)}>
                              <RefreshCw className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Preview Dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>{previewDoc?.doc_type} - {previewDoc?.client_name}</DialogTitle>
          </DialogHeader>
          <ScrollArea className="h-[60vh]">
            <div dir="rtl" className="whitespace-pre-wrap leading-8 p-4 font-serif" style={{ fontFamily: "'Traditional Arabic', 'Amiri', serif" }}>
              {previewDoc?.content}
            </div>
          </ScrollArea>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => { if (previewDoc) { setGeneratedContent(previewDoc.content); handleExportWord(); } }}>
              <Download className="h-4 w-4 ml-2" /> تصدير Word
            </Button>
            <Button variant="outline" onClick={() => { if (previewDoc) handleLoadDoc(previewDoc); setPreviewOpen(false); }}>
              <RefreshCw className="h-4 w-4 ml-2" /> تعديل وإعادة توليد
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DocumentGenerator;
