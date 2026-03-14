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
import { BookOpen, Plus, Upload, Search, FileText, Scale, Database, Globe, Loader2 } from 'lucide-react';
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
  'القانون المدني', 'القانون الجنائي', 'مدونة الأسرة', 'القانون التجاري',
  'قانون الشغل', 'القانون العقاري', 'القانون الإداري', 'المسطرة المدنية',
  'المسطرة الجنائية', 'قانون الكراء', 'أخرى',
];

const COURT_CHAMBERS = [
  'الغرفة المدنية', 'الغرفة الجنائية', 'الغرفة التجارية',
  'الغرفة الاجتماعية', 'الغرفة الإدارية', 'غرفة الأحوال الشخصية والميراث', 'جميع الغرف',
];

const KnowledgeBase = () => {
  const [documents, setDocuments] = useState<LegalDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Real stats from DB
  const [stats, setStats] = useState({ total: 0, rulings: 0, laws: 0, categories: 0 });

  // Single document form
  const [form, setForm] = useState({
    title: '', content: '', doc_type: 'ruling', category: '', source: '',
    reference_number: '', court_chamber: '', decision_date: '',
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

  // Fetch real stats from DB
  const fetchStats = async () => {
    const [totalRes, rulingsRes, lawsRes, categoriesRes] = await Promise.all([
      supabase.from('legal_documents').select('*', { count: 'exact', head: true }),
      supabase.from('legal_documents').select('*', { count: 'exact', head: true }).eq('doc_type', 'ruling'),
      supabase.from('legal_documents').select('*', { count: 'exact', head: true }).eq('doc_type', 'law'),
      supabase.from('legal_documents').select('category').not('category', 'is', null),
    ]);

    const uniqueCategories = new Set((categoriesRes.data || []).map(d => d.category).filter(Boolean));

    setStats({
      total: totalRes.count || 0,
      rulings: rulingsRes.count || 0,
      laws: lawsRes.count || 0,
      categories: uniqueCategories.size,
    });
  };

  const fetchDocuments = async () => {
    setLoading(true);
    let query = supabase
      .from('legal_documents')
      .select('id, title, content, doc_type, category, source, reference_number, court_chamber, decision_date, created_at')
      .order('created_at', { ascending: false })
      .limit(50);

    if (filterType !== 'all') query = query.eq('doc_type', filterType);
    if (searchQuery.trim()) query = query.ilike('title', `%${searchQuery}%`);

    const { data, error } = await query;
    if (error) toast.error('خطأ في تحميل المستندات');
    else setDocuments(data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchDocuments();
    fetchStats();
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
            title: form.title, content: form.content, doc_type: form.doc_type,
            category: form.category || null, source: form.source || null,
            reference_number: form.reference_number || null,
            court_chamber: form.court_chamber || null, decision_date: form.decision_date || null,
          }],
        },
      });
      if (error) throw error;
      toast.success('تم إضافة المستند بنجاح');
      setForm({ title: '', content: '', doc_type: 'ruling', category: '', source: '', reference_number: '', court_chamber: '', decision_date: '' });
      setAddDialogOpen(false);
      fetchDocuments();
      fetchStats();
    } catch (e) {
      toast.error('خطأ في إضافة المستند');
    }
    setSubmitting(false);
  };

  const handleBulkAdd = async () => {
    if (!bulkText.trim()) { toast.error('الرجاء إدخال النصوص'); return; }
    const rawDocs = bulkText.split(/\n(?:---+|===+)\n/).filter(t => t.trim());
    if (rawDocs.length === 0) { toast.error('لم يتم العثور على مستندات'); return; }
    setSubmitting(true);
    try {
      const documents = rawDocs.map((text, i) => {
        const lines = text.trim().split('\n');
        const title = lines[0].replace(/^#+\s*/, '').trim() || `مستند ${i + 1}`;
        const content = lines.slice(1).join('\n').trim() || text.trim();
        return { title, content, doc_type: bulkType, category: bulkCategory || null };
      });
      const { error } = await supabase.functions.invoke('legal-knowledge', {
        body: { action: 'ingest', documents },
      });
      if (error) throw error;
      toast.success(`تم إضافة ${documents.length} مستند بنجاح`);
      setBulkText('');
      setBulkDialogOpen(false);
      fetchDocuments();
      fetchStats();
    } catch (e) {
      toast.error('خطأ في الإضافة بالجملة');
    }
    setSubmitting(false);
  };

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
      toast.error(e.message || 'خطأ في اكتشاف الروابط');
      setScrapeStep('idle');
    }
    setScraping(false);
  };

  const handleScrapeUrls = async () => {
    if (discoveredUrls.length === 0) { toast.error('لا توجد روابط لجلبها'); return; }
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
        if (!error && data?.results) allResults.push(...data.results);
      } catch (e) { console.error('Batch error:', e); }
      setScrapeProgress(Math.round(((i + batch.length) / total) * 100));
      setScrapeResults([...allResults]);
    }
    setScrapeStep('done');
    setScraping(false);
    const successCount = allResults.filter(r => r.success).length;
    toast.success(`تم جلب ${successCount} قرار من أصل ${total} رابط`);
    fetchDocuments();
    fetchStats();
  };

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
      fetchStats();
    } catch (e: any) { toast.error(e.message || 'خطأ في الجلب'); }
    setScraping(false);
  };

  const handleAutoIngest = async () => {
    setAutoIngesting(true);
    setAutoIngestLog([]);
    setAutoIngestDocs(0);
    const sources: ('sgg' | 'cassation')[] = autoIngestSource === 'all' ? ['sgg', 'cassation'] : [autoIngestSource];
    const sourceNames: Record<string, string> = { sgg: 'الجريدة الرسمية', cassation: 'محكمة النقض' };

    let totalSearches = 0;
    for (const src of sources) {
      try {
        const { data } = await supabase.functions.invoke('auto-ingest', { body: { action: 'status' } });
        if (data?.sources?.[src]) totalSearches += data.sources[src].total;
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
          if (error) { setAutoIngestLog(prev => [...prev, `❌ خطأ: ${error.message}`]); break; }
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
    fetchStats();
    toast.success(`تم إضافة ${totalDocsAdded} مستند جديد لقاعدة المعرفة`);
  };

  const getTypeLabel = (type: string) => DOC_TYPES.find(t => t.value === type)?.label || type;

  const getTypeBadgeClass = (type: string) => {
    switch (type) {
      case 'ruling': return 'bg-primary/10 text-primary border-primary/20';
      case 'law': return 'bg-accent/10 text-accent-foreground border-accent/20';
      case 'decree': return 'bg-muted text-muted-foreground';
      default: return '';
    }
  };

  // Truncate title for display, showing meaningful part
  const formatTitle = (doc: LegalDocument) => {
    let title = doc.title;
    // If title is too generic, try to build a better one from content
    if (title === 'نص قانوني' || title === 'قرار محكمة النقض' || title === 'مستند قانوني') {
      const contentStart = doc.content.replace(/\s+/g, ' ').trim().slice(0, 120);
      if (contentStart.length > 10) {
        title = contentStart + (doc.content.length > 120 ? '...' : '');
      }
    }
    return title;
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-foreground flex items-center gap-2">
          <BookOpen className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
          قاعدة المعرفة القانونية
        </h1>
        <p className="text-xs sm:text-sm text-muted-foreground mt-1">
          النصوص القانونية وقرارات محكمة النقض التي يعتمد عليها المستشار الذكي
        </p>
      </div>

      {/* Stats - responsive grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-3 sm:p-4 flex items-center gap-2 sm:gap-3">
            <Database className="h-6 w-6 sm:h-8 sm:w-8 text-primary shrink-0" />
            <div className="min-w-0">
              <p className="text-lg sm:text-2xl font-bold text-foreground">{stats.total}</p>
              <p className="text-[10px] sm:text-xs text-muted-foreground">إجمالي المستندات</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 sm:p-4 flex items-center gap-2 sm:gap-3">
            <Scale className="h-6 w-6 sm:h-8 sm:w-8 text-primary shrink-0" />
            <div className="min-w-0">
              <p className="text-lg sm:text-2xl font-bold text-foreground">{stats.rulings}</p>
              <p className="text-[10px] sm:text-xs text-muted-foreground">قرارات قضائية</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 sm:p-4 flex items-center gap-2 sm:gap-3">
            <FileText className="h-6 w-6 sm:h-8 sm:w-8 text-primary shrink-0" />
            <div className="min-w-0">
              <p className="text-lg sm:text-2xl font-bold text-foreground">{stats.laws}</p>
              <p className="text-[10px] sm:text-xs text-muted-foreground">نصوص قانونية</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 sm:p-4 flex items-center gap-2 sm:gap-3">
            <BookOpen className="h-6 w-6 sm:h-8 sm:w-8 text-primary shrink-0" />
            <div className="min-w-0">
              <p className="text-lg sm:text-2xl font-bold text-foreground">{stats.categories}</p>
              <p className="text-[10px] sm:text-xs text-muted-foreground">تصنيفات</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Actions & Filters */}
      <Card>
        <CardContent className="p-3 sm:p-4">
          <div className="flex flex-col gap-3">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="بحث في العناوين..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pr-9 text-sm"
                />
              </div>
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="w-28 sm:w-40 text-sm">
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
            <div className="flex flex-wrap gap-2">
              <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" className="gap-1 text-xs sm:text-sm">
                    <Plus className="h-3.5 w-3.5" />
                    إضافة مستند
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader><DialogTitle>إضافة مستند قانوني</DialogTitle></DialogHeader>
                  <div className="space-y-4 mt-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label>نوع المستند *</Label>
                        <Select value={form.doc_type} onValueChange={v => setForm(f => ({ ...f, doc_type: v }))}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {DOC_TYPES.map(t => (<SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label>التصنيف</Label>
                        <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
                          <SelectTrigger><SelectValue placeholder="اختر التصنيف" /></SelectTrigger>
                          <SelectContent>
                            {CATEGORIES.map(c => (<SelectItem key={c} value={c}>{c}</SelectItem>))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label>العنوان *</Label>
                      <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="مثال: قرار محكمة النقض عدد 1234 بشأن فسخ عقد الكراء" />
                    </div>
                    {form.doc_type === 'ruling' && (
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="space-y-1">
                          <Label>رقم القرار</Label>
                          <Input value={form.reference_number} onChange={e => setForm(f => ({ ...f, reference_number: e.target.value }))} placeholder="1234/2024" />
                        </div>
                        <div className="space-y-1">
                          <Label>الغرفة</Label>
                          <Select value={form.court_chamber} onValueChange={v => setForm(f => ({ ...f, court_chamber: v }))}>
                            <SelectTrigger><SelectValue placeholder="الغرفة" /></SelectTrigger>
                            <SelectContent>
                              {COURT_CHAMBERS.map(c => (<SelectItem key={c} value={c}>{c}</SelectItem>))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <Label>تاريخ القرار</Label>
                          <Input type="date" value={form.decision_date} onChange={e => setForm(f => ({ ...f, decision_date: e.target.value }))} />
                        </div>
                      </div>
                    )}
                    <div className="space-y-1">
                      <Label>المصدر</Label>
                      <Input value={form.source} onChange={e => setForm(f => ({ ...f, source: e.target.value }))} placeholder="مثال: الجريدة الرسمية عدد 7050" />
                    </div>
                    <div className="space-y-1">
                      <Label>المحتوى *</Label>
                      <Textarea value={form.content} onChange={e => setForm(f => ({ ...f, content: e.target.value }))} placeholder="الصق هنا نص القرار أو النص القانوني كاملاً..." rows={12} />
                    </div>
                    <Button onClick={handleAddDocument} disabled={submitting} className="w-full">
                      {submitting ? 'جاري الإضافة...' : 'إضافة المستند'}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>

              <Dialog open={bulkDialogOpen} onOpenChange={setBulkDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" variant="outline" className="gap-1 text-xs sm:text-sm">
                    <Upload className="h-3.5 w-3.5" />
                    إضافة بالجملة
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader><DialogTitle>إضافة مستندات بالجملة</DialogTitle></DialogHeader>
                  <div className="space-y-4 mt-4">
                    <p className="text-sm text-muted-foreground">
                      الصق عدة مستندات مفصولة بـ <code className="bg-muted px-1 rounded">---</code> أو <code className="bg-muted px-1 rounded">===</code>.
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label>نوع المستندات</Label>
                        <Select value={bulkType} onValueChange={setBulkType}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>{DOC_TYPES.map(t => (<SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>))}</SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label>التصنيف</Label>
                        <Select value={bulkCategory} onValueChange={setBulkCategory}>
                          <SelectTrigger><SelectValue placeholder="اختر" /></SelectTrigger>
                          <SelectContent>{CATEGORIES.map(c => (<SelectItem key={c} value={c}>{c}</SelectItem>))}</SelectContent>
                        </Select>
                      </div>
                    </div>
                    <Textarea value={bulkText} onChange={e => setBulkText(e.target.value)} placeholder={`قرار محكمة النقض عدد 1234\nنص القرار الأول...\n---\nقرار محكمة النقض عدد 5678\nنص القرار الثاني...`} rows={15} />
                    <Button onClick={handleBulkAdd} disabled={submitting} className="w-full">
                      {submitting ? 'جاري الإضافة...' : 'إضافة المستندات'}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>

              <Dialog open={scrapeDialogOpen} onOpenChange={setScrapeDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" variant="outline" className="gap-1 text-primary border-primary text-xs sm:text-sm">
                    <Globe className="h-3.5 w-3.5" />
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
                    <p className="text-sm text-muted-foreground">اختر المصدر ثم ابدأ الجلب.</p>
                    <div className="space-y-2">
                      <Label>اختر المصدر</Label>
                      <div className="grid grid-cols-1 gap-2">
                        {[
                          { url: 'https://www.sgg.gov.ma/arabe/BulletinOfficiel.aspx', icon: FileText, name: 'الجريدة الرسمية', desc: 'sgg.gov.ma - القوانين والمراسيم والظهائر' },
                          { url: 'https://juriscassation.cspj.ma', icon: Scale, name: 'محكمة النقض', desc: 'juriscassation.cspj.ma - اجتهادات محكمة النقض' },
                          { url: 'https://adala.justice.gov.ma', icon: BookOpen, name: 'بوابة عدالة', desc: 'adala.justice.gov.ma - قوانين واجتهادات قضائية' },
                        ].map(s => (
                          <Button key={s.url} variant={scrapeUrl === s.url ? 'default' : 'outline'} size="sm" className="justify-start gap-2 h-auto py-3" onClick={() => setScrapeUrl(s.url)}>
                            <s.icon className="h-4 w-4 shrink-0" />
                            <div className="text-right">
                              <div className="font-medium">{s.name}</div>
                              <div className="text-xs opacity-70">{s.desc}</div>
                            </div>
                          </Button>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>أو أدخل رابطاً مخصصاً</Label>
                      <Input value={scrapeUrl} onChange={e => setScrapeUrl(e.target.value)} placeholder="https://..." dir="ltr" />
                    </div>
                    <Button onClick={handleMapWebsite} disabled={scraping} variant="outline" className="w-full gap-2">
                      {scrapeStep === 'mapping' ? (<><Loader2 className="h-4 w-4 animate-spin" /> جاري اكتشاف الروابط...</>) : (<><Search className="h-4 w-4" /> اكتشاف روابط القرارات</>)}
                    </Button>
                    {discoveredUrls.length > 0 && (
                      <>
                        <div className="bg-muted/50 rounded-lg p-3 space-y-2">
                          <p className="text-sm font-medium">تم اكتشاف {discoveredUrls.length} رابط</p>
                          <div className="max-h-32 overflow-y-auto text-xs text-muted-foreground space-y-1">
                            {discoveredUrls.slice(0, 20).map((u, i) => (
                              <div key={i} className="flex items-center justify-between gap-2">
                                <span className="truncate flex-1" dir="ltr">{u}</span>
                                <Button size="sm" variant="ghost" className="h-6 text-xs shrink-0" onClick={() => handleScrapeSingle(u)} disabled={scraping}>جلب</Button>
                              </div>
                            ))}
                          </div>
                        </div>
                        <Button onClick={handleScrapeUrls} disabled={scraping} className="w-full gap-2">
                          {scrapeStep === 'scraping' ? (<><Loader2 className="h-4 w-4 animate-spin" /> جاري الجلب...</>) : (<>جلب كل القرارات ({discoveredUrls.length})</>)}
                        </Button>
                        {scrapeStep === 'scraping' && (
                          <div className="space-y-1">
                            <Progress value={scrapeProgress} className="h-2" />
                            <p className="text-xs text-muted-foreground text-center">{scrapeProgress}%</p>
                          </div>
                        )}
                      </>
                    )}
                    {scrapeResults.length > 0 && (
                      <div className="bg-muted/50 rounded-lg p-3 space-y-1">
                        <p className="text-sm font-medium">النتائج: {scrapeResults.filter(r => r.success).length} ناجح من {scrapeResults.length}</p>
                        <div className="max-h-40 overflow-y-auto text-xs space-y-1">
                          {scrapeResults.map((r, i) => (
                            <div key={i} className={r.success ? 'text-green-600' : 'text-destructive'}>
                              {r.success ? '✅' : '❌'} {r.title || r.url} {r.success && `(${r.ingested} أجزاء)`}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {scrapeStep === 'done' && (
                      <Button onClick={() => { setScrapeDialogOpen(false); setScrapeStep('idle'); setDiscoveredUrls([]); setScrapeResults([]); }} variant="outline" className="w-full">إغلاق</Button>
                    )}
                  </div>
                </DialogContent>
              </Dialog>

              {/* Auto-Ingest */}
              <Dialog open={autoIngestOpen} onOpenChange={setAutoIngestOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" className="gap-1 bg-green-600 hover:bg-green-700 text-white text-xs sm:text-sm">
                    <Database className="h-3.5 w-3.5" />
                    جلب شامل
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      <Database className="h-5 w-5 text-green-600" />
                      جلب شامل من المصادر الرسمية
                    </DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 mt-4">
                    <p className="text-sm text-muted-foreground">سيتم البحث في المصادر الرسمية وجلب القوانين والقرارات القضائية تلقائياً.</p>
                    <div className="space-y-2">
                      <Label>اختر المصدر</Label>
                      <div className="grid grid-cols-1 gap-2">
                        {[
                          { value: 'all' as const, icon: Globe, name: 'جميع المصادر', desc: 'الجريدة الرسمية + محكمة النقض' },
                          { value: 'sgg' as const, icon: FileText, name: 'الجريدة الرسمية فقط', desc: 'sgg.gov.ma - القوانين والمراسيم والظهائر' },
                          { value: 'cassation' as const, icon: Scale, name: 'محكمة النقض فقط', desc: 'juriscassation.cspj.ma - اجتهادات محكمة النقض' },
                        ].map(s => (
                          <Button key={s.value} variant={autoIngestSource === s.value ? 'default' : 'outline'} size="sm" className="justify-start gap-2 h-auto py-3" onClick={() => setAutoIngestSource(s.value)} disabled={autoIngesting}>
                            <s.icon className="h-4 w-4 shrink-0" />
                            <div className="text-right">
                              <div className="font-medium">{s.name}</div>
                              <div className="text-xs opacity-70">{s.desc}</div>
                            </div>
                          </Button>
                        ))}
                      </div>
                    </div>
                    <Button onClick={handleAutoIngest} disabled={autoIngesting} className="w-full gap-2 bg-green-600 hover:bg-green-700">
                      {autoIngesting ? (<><Loader2 className="h-4 w-4 animate-spin" /> جاري الجلب...</>) : (<><Database className="h-4 w-4" /> ابدأ الجلب الشامل</>)}
                    </Button>
                    {autoIngesting && (
                      <div className="space-y-1">
                        <Progress value={autoIngestProgress} className="h-2" />
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>{autoIngestProgress}%</span>
                          <span>{autoIngestDocs} مستند جديد</span>
                        </div>
                      </div>
                    )}
                    {autoIngestLog.length > 0 && (
                      <div className="bg-muted/50 rounded-lg p-3 space-y-1 max-h-60 overflow-y-auto">
                        {autoIngestLog.map((log, i) => (<p key={i} className="text-xs">{log}</p>))}
                      </div>
                    )}
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Documents - Desktop Table / Mobile Cards */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-muted-foreground">جاري التحميل...</div>
          ) : documents.length === 0 ? (
            <div className="p-12 text-center space-y-3">
              <BookOpen className="h-12 w-12 text-muted-foreground/30 mx-auto" />
              <p className="text-muted-foreground">لا توجد مستندات بعد</p>
              <p className="text-sm text-muted-foreground">ابدأ بإضافة النصوص القانونية وقرارات محكمة النقض</p>
            </div>
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden sm:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-right">العنوان</TableHead>
                      <TableHead className="text-right w-28">النوع</TableHead>
                      <TableHead className="text-right w-32">التصنيف</TableHead>
                      <TableHead className="text-right w-28">المرجع</TableHead>
                      <TableHead className="text-right w-28">التاريخ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {documents.map(doc => (
                      <TableRow key={doc.id}>
                        <TableCell className="font-medium">
                          <span className="line-clamp-2 text-sm">{formatTitle(doc)}</span>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className={`text-xs ${getTypeBadgeClass(doc.doc_type)}`}>
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
              </div>

              {/* Mobile Cards */}
              <div className="sm:hidden divide-y divide-border">
                {documents.map(doc => (
                  <div key={doc.id} className="p-3 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium line-clamp-2 flex-1">{formatTitle(doc)}</p>
                      <Badge variant="secondary" className={`text-[10px] shrink-0 ${getTypeBadgeClass(doc.doc_type)}`}>
                        {getTypeLabel(doc.doc_type)}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
                      {doc.category && <span>📂 {doc.category}</span>}
                      {doc.reference_number && <span>📋 {doc.reference_number}</span>}
                      <span>📅 {doc.decision_date || new Date(doc.created_at).toLocaleDateString('ar-MA')}</span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default KnowledgeBase;
