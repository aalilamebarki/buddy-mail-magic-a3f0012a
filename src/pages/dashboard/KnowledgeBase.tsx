import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { BookOpen, Plus, Upload, Search, Trash2, FileText, Scale, Database, Globe, Loader2 } from 'lucide-react';
import { Progress } from '@/components/ui/progress';

interface LegalDocument {
  id: string;
  title: string;
  content: string;
  doc_type: string;
  category: string | null;
  source: string | null;
  reference_number: string | null;
  court_chamber: string | null;
  decision_date: string | null;
  created_at: string;
}

const DOC_TYPES = [
  { value: 'law', label: 'نص قانوني' },
  { value: 'ruling', label: 'قرار محكمة النقض' },
  { value: 'decree', label: 'مرسوم' },
  { value: 'circular', label: 'دورية / منشور' },
  { value: 'doctrine', label: 'فقه / شرح' },
];

const CATEGORIES = [
  'القانون المدني',
  'القانون الجنائي',
  'مدونة الأسرة',
  'القانون التجاري',
  'قانون الشغل',
  'القانون العقاري',
  'القانون الإداري',
  'المسطرة المدنية',
  'المسطرة الجنائية',
  'قانون الكراء',
  'أخرى',
];

const COURT_CHAMBERS = [
  'الغرفة المدنية',
  'الغرفة الجنائية',
  'الغرفة التجارية',
  'الغرفة الاجتماعية',
  'الغرفة الإدارية',
  'غرفة الأحوال الشخصية والميراث',
  'جميع الغرف',
];

const KnowledgeBase = () => {
  const [documents, setDocuments] = useState<LegalDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Single document form
  const [form, setForm] = useState({
    title: '',
    content: '',
    doc_type: 'ruling',
    category: '',
    source: '',
    reference_number: '',
    court_chamber: '',
    decision_date: '',
  });

  // Bulk text input
  const [bulkText, setBulkText] = useState('');
  const [bulkType, setBulkType] = useState('ruling');
  const [bulkCategory, setBulkCategory] = useState('');

  // Scraping state
  const [scrapeDialogOpen, setScrapeDialogOpen] = useState(false);
  const [scraping, setScraping] = useState(false);
  const [scrapeStep, setScrapeStep] = useState<'idle' | 'mapping' | 'scraping' | 'done'>('idle');
  const [discoveredUrls, setDiscoveredUrls] = useState<string[]>([]);
  const [scrapeProgress, setScrapeProgress] = useState(0);
  const [scrapeResults, setScrapeResults] = useState<any[]>([]);
  const [scrapeUrl, setScrapeUrl] = useState('https://juriscassation.cspj.ma');

  // Auto-ingest state
  const [autoIngestOpen, setAutoIngestOpen] = useState(false);
  const [autoIngesting, setAutoIngesting] = useState(false);
  const [autoIngestSource, setAutoIngestSource] = useState<'sgg' | 'cassation' | 'all'>('all');
  const [autoIngestLog, setAutoIngestLog] = useState<string[]>([]);
  const [autoIngestProgress, setAutoIngestProgress] = useState(0);
  const [autoIngestTotal, setAutoIngestTotal] = useState(0);
  const [autoIngestDocs, setAutoIngestDocs] = useState(0);
  const fetchDocuments = async () => {
    setLoading(true);
    let query = supabase
      .from('legal_documents')
      .select('id, title, content, doc_type, category, source, reference_number, court_chamber, decision_date, created_at')
      .order('created_at', { ascending: false })
      .limit(50);

    if (filterType !== 'all') {
      query = query.eq('doc_type', filterType);
    }
    if (searchQuery.trim()) {
      query = query.ilike('title', `%${searchQuery}%`);
    }

    const { data, error } = await query;
    if (error) {
      toast.error('خطأ في تحميل المستندات');
    } else {
      setDocuments(data || []);
    }

    // Get total count
    const { count } = await supabase
      .from('legal_documents')
      .select('*', { count: 'exact', head: true });
    setTotalCount(count || 0);

    setLoading(false);
  };

  useEffect(() => {
    fetchDocuments();
  }, [filterType, searchQuery]);

  const handleAddDocument = async () => {
    if (!form.title.trim() || !form.content.trim()) {
      toast.error('العنوان والمحتوى مطلوبان');
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase.functions.invoke('legal-knowledge', {
        body: {
          action: 'ingest',
          documents: [{
            title: form.title,
            content: form.content,
            doc_type: form.doc_type,
            category: form.category || null,
            source: form.source || null,
            reference_number: form.reference_number || null,
            court_chamber: form.court_chamber || null,
            decision_date: form.decision_date || null,
          }],
        },
      });

      if (error) throw error;

      toast.success('تم إضافة المستند بنجاح');
      setForm({ title: '', content: '', doc_type: 'ruling', category: '', source: '', reference_number: '', court_chamber: '', decision_date: '' });
      setAddDialogOpen(false);
      fetchDocuments();
    } catch (e) {
      toast.error('خطأ في إضافة المستند');
      console.error(e);
    }
    setSubmitting(false);
  };

  const handleBulkAdd = async () => {
    if (!bulkText.trim()) {
      toast.error('الرجاء إدخال النصوص');
      return;
    }

    // Split by separator "---" or "==="
    const rawDocs = bulkText.split(/\n(?:---+|===+)\n/).filter(t => t.trim());
    if (rawDocs.length === 0) {
      toast.error('لم يتم العثور على مستندات');
      return;
    }

    setSubmitting(true);
    try {
      const documents = rawDocs.map((text, i) => {
        const lines = text.trim().split('\n');
        const title = lines[0].replace(/^#+\s*/, '').trim() || `مستند ${i + 1}`;
        const content = lines.slice(1).join('\n').trim() || text.trim();
        return {
          title,
          content,
          doc_type: bulkType,
          category: bulkCategory || null,
        };
      });

      const { error } = await supabase.functions.invoke('legal-knowledge', {
        body: { action: 'ingest', documents },
      });

      if (error) throw error;

      toast.success(`تم إضافة ${documents.length} مستند بنجاح`);
      setBulkText('');
      setBulkDialogOpen(false);
      fetchDocuments();
    } catch (e) {
      toast.error('خطأ في الإضافة بالجملة');
      console.error(e);
    }
    setSubmitting(false);
  };

  // Step 1: Discover URLs from the website
  const handleMapWebsite = async () => {
    setScraping(true);
    setScrapeStep('mapping');
    setScrapeResults([]);
    setDiscoveredUrls([]);

    try {
      const { data, error } = await supabase.functions.invoke('scrape-rulings', {
        body: { action: 'map', url: scrapeUrl, limit: 500 },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'فشل في اكتشاف الروابط');

      const urls = (data.links || []).filter((u: string) => 
        u.includes('juriscassation') || u.includes('adala') || u.includes('decision') || u.includes('arret')
      );
      
      setDiscoveredUrls(urls);
      setScrapeStep('idle');
      toast.success(`تم اكتشاف ${urls.length} رابط`);
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || 'خطأ في اكتشاف الروابط');
      setScrapeStep('idle');
    }
    setScraping(false);
  };

  // Step 2: Scrape discovered URLs in batches
  const handleScrapeUrls = async () => {
    if (discoveredUrls.length === 0) {
      toast.error('لا توجد روابط لجلبها');
      return;
    }

    setScraping(true);
    setScrapeStep('scraping');
    setScrapeProgress(0);
    const allResults: any[] = [];
    const batchSize = 10;
    const total = discoveredUrls.length;

    for (let i = 0; i < total; i += batchSize) {
      const batch = discoveredUrls.slice(i, i + batchSize);
      
      try {
        const { data, error } = await supabase.functions.invoke('scrape-rulings', {
          body: { action: 'batch', urls: batch },
        });

        if (!error && data?.results) {
          allResults.push(...data.results);
        }
      } catch (e) {
        console.error('Batch error:', e);
      }

      setScrapeProgress(Math.round(((i + batch.length) / total) * 100));
      setScrapeResults([...allResults]);
    }

    setScrapeStep('done');
    setScraping(false);
    
    const successCount = allResults.filter(r => r.success).length;
    toast.success(`تم جلب ${successCount} قرار من أصل ${total} رابط`);
    fetchDocuments();
  };

  // Scrape a single URL
  const handleScrapeSingle = async (url: string) => {
    setScraping(true);
    try {
      const { data, error } = await supabase.functions.invoke('scrape-rulings', {
        body: { action: 'scrape', url },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'فشل الجلب');

      toast.success(`تم جلب: ${data.title} (${data.ingested} أجزاء)`);
      fetchDocuments();
    } catch (e: any) {
      toast.error(e.message || 'خطأ في الجلب');
    }
    setScraping(false);
  };

  // Auto-ingest from sources
  const handleAutoIngest = async () => {
    setAutoIngesting(true);
    setAutoIngestLog([]);
    setAutoIngestDocs(0);
    
    const sources: ('sgg' | 'cassation')[] = autoIngestSource === 'all' 
      ? ['sgg', 'cassation'] 
      : [autoIngestSource];
    
    const sourceNames: Record<string, string> = {
      sgg: 'الجريدة الرسمية',
      cassation: 'محكمة النقض',
    };

    // Get totals first
    let totalSearches = 0;
    for (const src of sources) {
      try {
        const { data } = await supabase.functions.invoke('auto-ingest', {
          body: { action: 'status' },
        });
        if (data?.sources?.[src]) {
          totalSearches += data.sources[src].total;
        }
      } catch {}
    }
    setAutoIngestTotal(totalSearches);
    
    let completed = 0;
    let totalDocsAdded = 0;
    
    for (const src of sources) {
      setAutoIngestLog(prev => [...prev, `🔍 بدء الجلب من ${sourceNames[src]}...`]);
      
      let nextIndex = 0;
      let remaining = 1;
      
      while (remaining > 0) {
        try {
          const { data, error } = await supabase.functions.invoke('auto-ingest', {
            body: { action: 'batch_search', source: src, start_index: nextIndex, count: 2 },
          });
          
          if (error) {
            setAutoIngestLog(prev => [...prev, `❌ خطأ: ${error.message}`]);
            break;
          }
          
          if (data?.ingested?.length > 0) {
            for (const doc of data.ingested) {
              setAutoIngestLog(prev => [...prev, `✅ ${doc.title} (${doc.chunks} أجزاء)`]);
            }
            totalDocsAdded += data.documentsAdded || 0;
            setAutoIngestDocs(totalDocsAdded);
          } else {
            setAutoIngestLog(prev => [...prev, `📄 تم فحص ${data?.processed || 0} استعلامات - لا جديد`]);
          }
          
          remaining = data?.remaining ?? 0;
          nextIndex = data?.nextIndex ?? nextIndex + 2;
          completed += data?.processed || 0;
          setAutoIngestProgress(Math.round((completed / Math.max(totalSearches, 1)) * 100));
          
          // Small delay
          await new Promise(r => setTimeout(r, 500));
        } catch (err: any) {
          setAutoIngestLog(prev => [...prev, `❌ خطأ: ${err.message}`]);
          break;
        }
      }
      
      setAutoIngestLog(prev => [...prev, `✨ انتهى الجلب من ${sourceNames[src]}`]);
    }
    
    setAutoIngestLog(prev => [...prev, `🎉 تم الانتهاء! أُضيف ${totalDocsAdded} مستند جديد`]);
    setAutoIngesting(false);
    fetchDocuments();
    toast.success(`تم إضافة ${totalDocsAdded} مستند جديد لقاعدة المعرفة`);
  };



  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <BookOpen className="h-6 w-6 text-primary" />
            قاعدة المعرفة القانونية
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            النصوص القانونية وقرارات محكمة النقض التي يعتمد عليها المستشار الذكي
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Database className="h-8 w-8 text-primary" />
            <div>
              <p className="text-2xl font-bold text-foreground">{totalCount}</p>
              <p className="text-xs text-muted-foreground">إجمالي المستندات</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Scale className="h-8 w-8 text-primary" />
            <div>
              <p className="text-2xl font-bold text-foreground">
                {documents.filter(d => d.doc_type === 'ruling').length}
              </p>
              <p className="text-xs text-muted-foreground">قرارات قضائية</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <FileText className="h-8 w-8 text-primary" />
            <div>
              <p className="text-2xl font-bold text-foreground">
                {documents.filter(d => d.doc_type === 'law').length}
              </p>
              <p className="text-xs text-muted-foreground">نصوص قانونية</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <BookOpen className="h-8 w-8 text-primary" />
            <div>
              <p className="text-2xl font-bold text-foreground">
                {new Set(documents.map(d => d.category).filter(Boolean)).size}
              </p>
              <p className="text-xs text-muted-foreground">تصنيفات</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Actions & Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex gap-2 flex-1">
              <div className="relative flex-1">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="بحث في العناوين..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pr-9"
                />
              </div>
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">الكل</SelectItem>
                  {DOC_TYPES.map(t => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" className="gap-1">
                    <Plus className="h-4 w-4" />
                    إضافة مستند
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>إضافة مستند قانوني</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 mt-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label>نوع المستند *</Label>
                        <Select value={form.doc_type} onValueChange={v => setForm(f => ({ ...f, doc_type: v }))}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {DOC_TYPES.map(t => (
                              <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label>التصنيف</Label>
                        <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
                          <SelectTrigger><SelectValue placeholder="اختر التصنيف" /></SelectTrigger>
                          <SelectContent>
                            {CATEGORIES.map(c => (
                              <SelectItem key={c} value={c}>{c}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label>العنوان *</Label>
                      <Input
                        value={form.title}
                        onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                        placeholder="مثال: قرار محكمة النقض عدد 1234 بشأن فسخ عقد الكراء"
                      />
                    </div>
                    {form.doc_type === 'ruling' && (
                      <div className="grid grid-cols-3 gap-3">
                        <div className="space-y-1">
                          <Label>رقم القرار</Label>
                          <Input
                            value={form.reference_number}
                            onChange={e => setForm(f => ({ ...f, reference_number: e.target.value }))}
                            placeholder="1234/2024"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label>الغرفة</Label>
                          <Select value={form.court_chamber} onValueChange={v => setForm(f => ({ ...f, court_chamber: v }))}>
                            <SelectTrigger><SelectValue placeholder="الغرفة" /></SelectTrigger>
                            <SelectContent>
                              {COURT_CHAMBERS.map(c => (
                                <SelectItem key={c} value={c}>{c}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <Label>تاريخ القرار</Label>
                          <Input
                            type="date"
                            value={form.decision_date}
                            onChange={e => setForm(f => ({ ...f, decision_date: e.target.value }))}
                          />
                        </div>
                      </div>
                    )}
                    <div className="space-y-1">
                      <Label>المصدر</Label>
                      <Input
                        value={form.source}
                        onChange={e => setForm(f => ({ ...f, source: e.target.value }))}
                        placeholder="مثال: الجريدة الرسمية عدد 7050 / موقع محكمة النقض"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>المحتوى *</Label>
                      <Textarea
                        value={form.content}
                        onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
                        placeholder="الصق هنا نص القرار أو النص القانوني كاملاً..."
                        rows={12}
                      />
                    </div>
                    <Button onClick={handleAddDocument} disabled={submitting} className="w-full">
                      {submitting ? 'جاري الإضافة...' : 'إضافة المستند'}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>

              <Dialog open={bulkDialogOpen} onOpenChange={setBulkDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" variant="outline" className="gap-1">
                    <Upload className="h-4 w-4" />
                    إضافة بالجملة
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>إضافة مستندات بالجملة</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 mt-4">
                    <p className="text-sm text-muted-foreground">
                      الصق عدة مستندات مفصولة بـ <code className="bg-muted px-1 rounded">---</code> أو <code className="bg-muted px-1 rounded">===</code>.
                      السطر الأول من كل مستند يُعتبر العنوان.
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label>نوع المستندات</Label>
                        <Select value={bulkType} onValueChange={setBulkType}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {DOC_TYPES.map(t => (
                              <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label>التصنيف</Label>
                        <Select value={bulkCategory} onValueChange={setBulkCategory}>
                          <SelectTrigger><SelectValue placeholder="اختر" /></SelectTrigger>
                          <SelectContent>
                            {CATEGORIES.map(c => (
                              <SelectItem key={c} value={c}>{c}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label>المستندات</Label>
                      <Textarea
                        value={bulkText}
                        onChange={e => setBulkText(e.target.value)}
                        placeholder={`قرار محكمة النقض عدد 1234\nنص القرار الأول هنا...\n---\nقرار محكمة النقض عدد 5678\nنص القرار الثاني هنا...`}
                        rows={15}
                      />
                    </div>
                    <Button onClick={handleBulkAdd} disabled={submitting} className="w-full">
                      {submitting ? 'جاري الإضافة...' : `إضافة المستندات`}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>

              <Dialog open={scrapeDialogOpen} onOpenChange={setScrapeDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" variant="outline" className="gap-1 text-primary border-primary">
                    <Globe className="h-4 w-4" />
                    جلب تلقائي
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      <Globe className="h-5 w-5 text-primary" />
                      جلب النصوص القانونية والقرارات تلقائياً
                    </DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 mt-4">
                    <p className="text-sm text-muted-foreground">
                      اختر المصدر ثم ابدأ الجلب. سيتم حفظ كل شيء في قاعدة المعرفة تلقائياً.
                    </p>

                    {/* Quick source buttons */}
                    <div className="space-y-2">
                      <Label>اختر المصدر</Label>
                      <div className="grid grid-cols-1 gap-2">
                        <Button
                          variant={scrapeUrl.includes('sgg.gov.ma') ? 'default' : 'outline'}
                          size="sm"
                          className="justify-start gap-2 h-auto py-3"
                          onClick={() => setScrapeUrl('https://www.sgg.gov.ma/arabe/BulletinOfficiel.aspx')}
                        >
                          <FileText className="h-4 w-4 shrink-0" />
                          <div className="text-right">
                            <div className="font-medium">الجريدة الرسمية - النصوص القانونية</div>
                            <div className="text-xs opacity-70">sgg.gov.ma - القوانين والمراسيم والظهائر</div>
                          </div>
                        </Button>
                        <Button
                          variant={scrapeUrl.includes('juriscassation') ? 'default' : 'outline'}
                          size="sm"
                          className="justify-start gap-2 h-auto py-3"
                          onClick={() => setScrapeUrl('https://juriscassation.cspj.ma')}
                        >
                          <Scale className="h-4 w-4 shrink-0" />
                          <div className="text-right">
                            <div className="font-medium">محكمة النقض - القرارات القضائية</div>
                            <div className="text-xs opacity-70">juriscassation.cspj.ma - اجتهادات محكمة النقض</div>
                          </div>
                        </Button>
                        <Button
                          variant={scrapeUrl.includes('adala.justice') ? 'default' : 'outline'}
                          size="sm"
                          className="justify-start gap-2 h-auto py-3"
                          onClick={() => setScrapeUrl('https://adala.justice.gov.ma')}
                        >
                          <BookOpen className="h-4 w-4 shrink-0" />
                          <div className="text-right">
                            <div className="font-medium">بوابة عدالة - النصوص والاجتهادات</div>
                            <div className="text-xs opacity-70">adala.justice.gov.ma - قوانين واجتهادات قضائية</div>
                          </div>
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>أو أدخل رابطاً مخصصاً</Label>
                      <Input
                        value={scrapeUrl}
                        onChange={e => setScrapeUrl(e.target.value)}
                        placeholder="https://..."
                        dir="ltr"
                      />
                    </div>

                    {/* Step 1: Map */}
                    <div className="space-y-2">
                      <Button
                        onClick={handleMapWebsite}
                        disabled={scraping}
                        variant="outline"
                        className="w-full gap-2"
                      >
                        {scrapeStep === 'mapping' ? (
                          <><Loader2 className="h-4 w-4 animate-spin" /> جاري اكتشاف الروابط...</>
                        ) : (
                          <><Search className="h-4 w-4" /> الخطوة 1: اكتشاف روابط القرارات</>
                        )}
                      </Button>

                      {discoveredUrls.length > 0 && (
                        <div className="bg-muted/50 rounded-lg p-3 space-y-2">
                          <p className="text-sm font-medium text-foreground">
                            تم اكتشاف {discoveredUrls.length} رابط
                          </p>
                          <div className="max-h-32 overflow-y-auto text-xs text-muted-foreground space-y-1">
                            {discoveredUrls.slice(0, 20).map((u, i) => (
                              <div key={i} className="flex items-center justify-between gap-2">
                                <span className="truncate flex-1" dir="ltr">{u}</span>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-6 text-xs shrink-0"
                                  onClick={() => handleScrapeSingle(u)}
                                  disabled={scraping}
                                >
                                  جلب
                                </Button>
                              </div>
                            ))}
                            {discoveredUrls.length > 20 && (
                              <p className="text-muted-foreground">... و {discoveredUrls.length - 20} رابط آخر</p>
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Step 2: Scrape All */}
                    {discoveredUrls.length > 0 && (
                      <div className="space-y-2">
                        <Button
                          onClick={handleScrapeUrls}
                          disabled={scraping}
                          className="w-full gap-2"
                        >
                          {scrapeStep === 'scraping' ? (
                            <><Loader2 className="h-4 w-4 animate-spin" /> جاري الجلب...</>
                          ) : (
                            <>الخطوة 2: جلب كل القرارات ({discoveredUrls.length})</>
                          )}
                        </Button>

                        {scrapeStep === 'scraping' && (
                          <div className="space-y-1">
                            <Progress value={scrapeProgress} className="h-2" />
                            <p className="text-xs text-muted-foreground text-center">{scrapeProgress}%</p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Results */}
                    {scrapeResults.length > 0 && (
                      <div className="bg-muted/50 rounded-lg p-3 space-y-1">
                        <p className="text-sm font-medium text-foreground">
                          النتائج: {scrapeResults.filter(r => r.success).length} ناجح من {scrapeResults.length}
                        </p>
                        <div className="max-h-40 overflow-y-auto text-xs space-y-1">
                          {scrapeResults.map((r, i) => (
                            <div key={i} className={`flex items-center gap-2 ${r.success ? 'text-green-600' : 'text-destructive'}`}>
                              <span>{r.success ? '✅' : '❌'}</span>
                              <span className="truncate">{r.title || r.url}</span>
                              {r.success && <span className="text-muted-foreground">({r.ingested} أجزاء)</span>}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {scrapeStep === 'done' && (
                      <Button
                        onClick={() => {
                          setScrapeDialogOpen(false);
                          setScrapeStep('idle');
                          setDiscoveredUrls([]);
                          setScrapeResults([]);
                        }}
                        variant="outline"
                        className="w-full"
                      >
                        إغلاق
                      </Button>
                    )}
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Documents Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-muted-foreground">جاري التحميل...</div>
          ) : documents.length === 0 ? (
            <div className="p-12 text-center space-y-3">
              <BookOpen className="h-12 w-12 text-muted-foreground/30 mx-auto" />
              <p className="text-muted-foreground">لا توجد مستندات بعد</p>
              <p className="text-sm text-muted-foreground">ابدأ بإضافة النصوص القانونية وقرارات محكمة النقض لتغذية المستشار الذكي</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">العنوان</TableHead>
                  <TableHead className="text-right">النوع</TableHead>
                  <TableHead className="text-right">التصنيف</TableHead>
                  <TableHead className="text-right">المرجع</TableHead>
                  <TableHead className="text-right">التاريخ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {documents.map(doc => (
                  <TableRow key={doc.id}>
                    <TableCell className="font-medium max-w-[300px] truncate">{doc.title}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="text-xs">
                        {getTypeLabel(doc.doc_type)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{doc.category || '-'}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{doc.reference_number || '-'}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {doc.decision_date || new Date(doc.created_at).toLocaleDateString('ar-MA')}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default KnowledgeBase;
