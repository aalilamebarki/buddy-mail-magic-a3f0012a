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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { BookOpen, Plus, Upload, Search, FileText, Scale, Database, Globe, Loader2, Gavel, ScrollText, FileCheck, Building2 } from 'lucide-react';
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
  metadata: any;
}

const DOC_TYPES = [
  { value: 'law', label: 'قانون', icon: FileText },
  { value: 'dahir', label: 'ظهير شريف', icon: ScrollText },
  { value: 'decree', label: 'مرسوم', icon: FileCheck },
  { value: 'organic_law', label: 'قانون تنظيمي', icon: Building2 },
  { value: 'circular', label: 'دورية / منشور', icon: FileText },
  { value: 'convention', label: 'اتفاقية', icon: Globe },
  { value: 'decision', label: 'قرار وزاري', icon: Gavel },
  { value: 'ruling', label: 'قرار محكمة النقض', icon: Scale },
  { value: 'doctrine', label: 'فقه / شرح', icon: BookOpen },
];

const LEGISLATION_TYPES = ['law', 'dahir', 'decree', 'organic_law', 'circular', 'convention', 'decision'];
const RULING_TYPE = 'ruling';

const CATEGORIES = [
  'القانون المدني', 'القانون الجنائي', 'مدونة الأسرة', 'القانون التجاري',
  'قانون الشغل', 'القانون العقاري', 'القانون الإداري', 'المسطرة المدنية',
  'المسطرة الجنائية', 'قانون الكراء', 'القانون المالي والضريبي', 'أخرى',
];

const COURT_CHAMBERS = [
  'الغرفة المدنية', 'الغرفة الجنائية', 'الغرفة التجارية',
  'الغرفة الاجتماعية', 'الغرفة الإدارية', 'غرفة الأحوال الشخصية والميراث', 'جميع الغرف',
];

const KnowledgeBase = () => {
  const [activeTab, setActiveTab] = useState('legislation');
  const [documents, setDocuments] = useState<LegalDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterSubType, setFilterSubType] = useState<string>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterChamber, setFilterChamber] = useState<string>('all');
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Stats
  const [stats, setStats] = useState<Record<string, number>>({});

  // Single document form
  const [form, setForm] = useState({
    title: '', content: '', doc_type: 'law', category: '', source: '',
    reference_number: '', court_chamber: '', decision_date: '',
  });

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
  const [autoIngestSource, setAutoIngestSource] = useState<'sgg' | 'cassation'>('sgg');
  const [autoIngestLog, setAutoIngestLog] = useState<string[]>([]);
  const [autoIngestProgress, setAutoIngestProgress] = useState(0);
  const [autoIngestDocs, setAutoIngestDocs] = useState(0);

  // SGG Archive scraper state
  const [sggDialogOpen, setSggDialogOpen] = useState(false);
  const [sggScraping, setSggScraping] = useState(false);
  const [sggStep, setSggStep] = useState<'idle' | 'discovering' | 'scraping' | 'done'>('idle');
  const [sggNewUrls, setSggNewUrls] = useState<string[]>([]);
  const [sggProgress, setSggProgress] = useState(0);
  const [sggLog, setSggLog] = useState<string[]>([]);
  const [sggStats, setSggStats] = useState({ found: 0, new: 0, alreadyScraped: 0 });
  const [sggTotalIngested, setSggTotalIngested] = useState(0);

  // Adala scraper state
  const [adalaDialogOpen, setAdalaDialogOpen] = useState(false);
  const [adalaScraping, setAdalaScraping] = useState(false);
  const [adalaStep, setAdalaStep] = useState<'idle' | 'checking' | 'scraping' | 'done'>('idle');
  const [adalaNewIds, setAdalaNewIds] = useState<number[]>([]);
  const [adalaProgress, setAdalaProgress] = useState(0);
  const [adalaLog, setAdalaLog] = useState<string[]>([]);
  const [adalaStats, setAdalaStats] = useState({ total: 0, existing: 0, newCount: 0 });
  const [adalaTotalIngested, setAdalaTotalIngested] = useState(0);

  const fetchStats = async () => {
    const types = ['law', 'dahir', 'decree', 'organic_law', 'circular', 'convention', 'decision', 'ruling', 'doctrine'];
    const results: Record<string, number> = {};
    
    const promises = types.map(async (t) => {
      const { count } = await supabase.from('legal_documents').select('*', { count: 'exact', head: true }).eq('doc_type', t);
      results[t] = count || 0;
    });
    await Promise.all(promises);
    
    const { count: total } = await supabase.from('legal_documents').select('*', { count: 'exact', head: true });
    results.total = total || 0;
    
    setStats(results);
  };

  const fetchDocuments = async () => {
    setLoading(true);
    const isLegislation = activeTab === 'legislation';
    
    let query = supabase
      .from('legal_documents')
      .select('id, title, content, doc_type, category, source, reference_number, court_chamber, decision_date, created_at, metadata')
      .order('created_at', { ascending: false })
      .limit(100);

    if (isLegislation) {
      if (filterSubType !== 'all') {
        query = query.eq('doc_type', filterSubType);
      } else {
        query = query.in('doc_type', LEGISLATION_TYPES);
      }
    } else {
      query = query.eq('doc_type', RULING_TYPE);
      if (filterChamber !== 'all') query = query.eq('court_chamber', filterChamber);
    }

    if (filterCategory !== 'all') query = query.eq('category', filterCategory);
    if (searchQuery.trim()) query = query.ilike('title', `%${searchQuery}%`);

    const { data, error } = await query;
    if (error) toast.error('خطأ في تحميل المستندات');
    else setDocuments(data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchDocuments();
    fetchStats();
  }, [activeTab, filterSubType, filterCategory, filterChamber, searchQuery]);

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
      setForm({ title: '', content: '', doc_type: 'law', category: '', source: '', reference_number: '', court_chamber: '', decision_date: '' });
      setAddDialogOpen(false);
      fetchDocuments();
      fetchStats();
    } catch {
      toast.error('خطأ في إضافة المستند');
    }
    setSubmitting(false);
  };

  // Scraping handlers
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

  const handleAutoIngest = async () => {
    setAutoIngesting(true);
    setAutoIngestLog([]);
    setAutoIngestDocs(0);
    setAutoIngestProgress(0);
    const sourceNames: Record<string, string> = { sgg: 'الجريدة الرسمية', cassation: 'محكمة النقض' };
    
    let { data: statusData } = await supabase.functions.invoke('auto-ingest', { body: { action: 'status' } });
    const totalSearches = statusData?.sources?.[autoIngestSource]?.total || 20;

    setAutoIngestLog(prev => [...prev, `🔍 بدء الجلب من ${sourceNames[autoIngestSource]}...`]);
    
    let nextIndex = 0;
    let remaining = 1;
    let totalDocsAdded = 0;
    let completed = 0;

    while (remaining > 0) {
      try {
        const { data, error } = await supabase.functions.invoke('auto-ingest', {
          body: { action: 'batch_search', source: autoIngestSource, start_index: nextIndex, count: 2 },
        });
        if (error) { setAutoIngestLog(prev => [...prev, `❌ خطأ: ${error.message}`]); break; }
        if (data?.ingested?.length > 0) {
          for (const doc of data.ingested) {
            const typeLabel = DOC_TYPES.find(t => t.value === doc.doc_type)?.label || doc.doc_type;
            setAutoIngestLog(prev => [...prev, `✅ [${typeLabel}] ${doc.title} (${doc.chunks} أجزاء)`]);
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
    setAutoIngestLog(prev => [...prev, `🎉 تم الانتهاء! أُضيف ${totalDocsAdded} مستند جديد`]);
    setAutoIngesting(false);
    fetchDocuments();
    fetchStats();
    toast.success(`تم إضافة ${totalDocsAdded} مستند جديد`);
  };

  // SGG Archive Scraper
  const handleSggDiscover = async () => {
    setSggScraping(true);
    setSggStep('discovering');
    setSggLog(['🔍 جاري اكتشاف صفحات القوانين من الأمانة العامة للحكومة...']);
    setSggNewUrls([]);
    setSggTotalIngested(0);
    try {
      const { data, error } = await supabase.functions.invoke('scrape-sgg-laws', {
        body: { action: 'discover', base_url: 'https://www.sgg.gov.ma' },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'فشل الاكتشاف');
      setSggNewUrls(data.urls || []);
      setSggStats({ found: data.lawLinks || 0, new: data.newLinks || 0, alreadyScraped: data.alreadyScraped || 0 });
      setSggLog(prev => [
        ...prev,
        `📊 إجمالي الروابط: ${data.totalFound}`,
        `📄 روابط القوانين: ${data.lawLinks}`,
        `✅ تم جلبها مسبقاً: ${data.alreadyScraped}`,
        `🆕 روابط جديدة: ${data.newLinks}`,
      ]);
      setSggStep('idle');
      if (data.newLinks === 0) toast.info('جميع القوانين المتوفرة تم جلبها مسبقاً');
      else toast.success(`تم اكتشاف ${data.newLinks} قانون جديد`);
    } catch (e: any) {
      toast.error(e.message || 'خطأ في الاكتشاف');
      setSggLog(prev => [...prev, `❌ خطأ: ${e.message}`]);
      setSggStep('idle');
    }
    setSggScraping(false);
  };

  const handleSggScrapeAll = async () => {
    if (sggNewUrls.length === 0) { toast.error('لا توجد روابط جديدة'); return; }
    setSggScraping(true);
    setSggStep('scraping');
    setSggProgress(0);
    setSggLog(prev => [...prev, `🚀 بدء جلب ${sggNewUrls.length} قانون...`]);
    let totalIngested = 0;
    const batchSize = 10;
    const total = sggNewUrls.length;
    let processedCount = 0;
    for (let i = 0; i < total; i += batchSize) {
      const batch = sggNewUrls.slice(i, i + batchSize);
      try {
        const { data, error } = await supabase.functions.invoke('scrape-sgg-laws', {
          body: { action: 'scrape_batch', urls_to_scrape: batch },
        });
        if (error) { setSggLog(prev => [...prev, `❌ خطأ في الدفعة: ${error.message}`]); continue; }
        if (data?.results) {
          for (const r of data.results) {
            if (r.success) {
              const typeLabel = DOC_TYPES.find(t => t.value === r.doc_type)?.label || r.doc_type || 'نص';
              setSggLog(prev => [...prev, `✅ [${typeLabel}] ${r.title} [${r.category}] (${r.ingested} أجزاء)`]);
            } else if (r.skipped) {
              setSggLog(prev => [...prev, `⏭️ موجود مسبقاً`]);
            } else {
              setSggLog(prev => [...prev, `⚠️ ${r.error}`]);
            }
          }
          totalIngested += data.totalIngested || 0;
          setSggTotalIngested(totalIngested);
        }
        processedCount += batch.length;
        setSggProgress(Math.round((processedCount / total) * 100));
      } catch (err: any) {
        setSggLog(prev => [...prev, `❌ خطأ: ${err.message}`]);
      }
    }
    setSggStep('done');
    setSggScraping(false);
    setSggLog(prev => [...prev, `🎉 انتهى الجلب! تم إضافة ${totalIngested} جزء قانوني جديد`]);
    toast.success(`تم إضافة ${totalIngested} جزء قانوني`);
    fetchDocuments();
    fetchStats();
  };

  // Adala Scraper
  const handleAdalaCheck = async () => {
    setAdalaScraping(true);
    setAdalaStep('checking');
    setAdalaLog(['🔍 جاري فحص الموارد من 1 إلى 1070 على بوابة عدالة...']);
    setAdalaNewIds([]);
    setAdalaTotalIngested(0);
    try {
      const { data, error } = await supabase.functions.invoke('scrape-adala', {
        body: { action: 'check_existing', start_id: 1, end_id: 1070 },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'فشل الفحص');
      setAdalaNewIds(data.newIds || []);
      setAdalaStats({ total: data.totalRange || 0, existing: data.alreadyScraped || 0, newCount: data.newCount || 0 });
      setAdalaLog(prev => [
        ...prev,
        `📊 إجمالي الموارد: ${data.totalRange}`,
        `✅ تم جلبها مسبقاً: ${data.alreadyScraped}`,
        `🆕 موارد جديدة: ${data.newCount}`,
      ]);
      setAdalaStep('idle');
      if (data.newCount === 0) toast.info('جميع الموارد المتوفرة تم جلبها مسبقاً');
      else toast.success(`تم اكتشاف ${data.newCount} مورد جديد`);
    } catch (e: any) {
      toast.error(e.message || 'خطأ في الفحص');
      setAdalaLog(prev => [...prev, `❌ خطأ: ${e.message}`]);
      setAdalaStep('idle');
    }
    setAdalaScraping(false);
  };

  const handleAdalaScrapeAll = async () => {
    if (adalaNewIds.length === 0) { toast.error('لا توجد موارد جديدة'); return; }
    setAdalaScraping(true);
    setAdalaStep('scraping');
    setAdalaProgress(0);
    setAdalaLog(prev => [...prev, `🚀 بدء جلب ${adalaNewIds.length} مورد من بوابة عدالة...`]);
    let totalIngested = 0;
    const batchSize = 5;
    const total = adalaNewIds.length;
    let processedCount = 0;
    for (let i = 0; i < total; i += batchSize) {
      const batchIds = adalaNewIds.slice(i, i + batchSize);
      try {
        const { data, error } = await supabase.functions.invoke('scrape-adala', {
          body: { action: 'scrape_batch', resource_ids: batchIds, batch_size: batchSize },
        });
        if (error) { setAdalaLog(prev => [...prev, `❌ خطأ في الدفعة: ${error.message}`]); continue; }
        if (data?.results) {
          for (const r of data.results) {
            if (r.success) {
              setAdalaLog(prev => [...prev, `✅ #${r.resourceId}: ${r.title} (${r.pdfCount || 0} PDF، ${r.ingested} أجزاء)`]);
              // Show individual PDF results if available
              if (r.pdfResults) {
                for (const pr of r.pdfResults) {
                  setAdalaLog(prev => [...prev, `   📄 ${pr}`]);
                }
              }
            } else if (r.skipped) {
              setAdalaLog(prev => [...prev, `⏭️ #${r.resourceId}: موجود مسبقاً`]);
            } else {
              setAdalaLog(prev => [...prev, `⚠️ #${r.resourceId}: ${r.error}`]);
            }
          }
          totalIngested += data.totalIngested || 0;
          setAdalaTotalIngested(totalIngested);
        }
        processedCount += batchIds.length;
        setAdalaProgress(Math.round((processedCount / total) * 100));
      } catch (err: any) {
        setAdalaLog(prev => [...prev, `❌ خطأ: ${err.message}`]);
      }
    }
    setAdalaStep('done');
    setAdalaScraping(false);
    setAdalaLog(prev => [...prev, `🎉 انتهى الجلب! تم إضافة ${totalIngested} جزء قانوني جديد`]);
    toast.success(`تم إضافة ${totalIngested} جزء قانوني من بوابة عدالة`);
    fetchDocuments();
    fetchStats();
  };

  const getTypeLabel = (type: string) => DOC_TYPES.find(t => t.value === type)?.label || type;

  const getTypeBadgeVariant = (type: string) => {
    switch (type) {
      case 'ruling': return 'bg-primary/10 text-primary border-primary/20';
      case 'law': return 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20';
      case 'dahir': return 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20';
      case 'decree': return 'bg-green-500/10 text-green-700 dark:text-green-300 border-green-500/20';
      case 'organic_law': return 'bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/20';
      case 'circular': return 'bg-orange-500/10 text-orange-700 dark:text-orange-300 border-orange-500/20';
      case 'convention': return 'bg-teal-500/10 text-teal-700 dark:text-teal-300 border-teal-500/20';
      case 'decision': return 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/20';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const legislationCount = LEGISLATION_TYPES.reduce((sum, t) => sum + (stats[t] || 0), 0);
  const rulingsCount = stats.ruling || 0;

  const formatTitle = (doc: LegalDocument) => {
    let title = doc.title;
    if (title === 'نص قانوني' || title === 'قرار محكمة النقض' || title === 'مستند قانوني') {
      const contentStart = doc.content.replace(/\s+/g, ' ').trim().slice(0, 120);
      if (contentStart.length > 10) title = contentStart + '...';
    }
    return title;
  };

  const renderDocumentsList = (docs: LegalDocument[], isRulings: boolean) => {
    if (loading) return <div className="p-8 text-center text-muted-foreground">جاري التحميل...</div>;
    if (docs.length === 0) return (
      <div className="p-12 text-center space-y-3">
        <BookOpen className="h-12 w-12 text-muted-foreground/30 mx-auto" />
        <p className="text-muted-foreground">لا توجد مستندات</p>
      </div>
    );

    return (
      <>
        {/* Desktop Table */}
        <div className="hidden sm:block">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-right">العنوان</TableHead>
                {!isRulings && <TableHead className="text-right w-28">النوع</TableHead>}
                <TableHead className="text-right w-32">التصنيف</TableHead>
                <TableHead className="text-right w-28">{isRulings ? 'رقم القرار' : 'المرجع'}</TableHead>
                {isRulings && <TableHead className="text-right w-32">الغرفة</TableHead>}
                {isRulings && <TableHead className="text-right w-24">رقم الملف</TableHead>}
                <TableHead className="text-right w-28">التاريخ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {docs.map(doc => (
                <TableRow key={doc.id}>
                  <TableCell className="font-medium">
                    <span className="line-clamp-2 text-sm">{formatTitle(doc)}</span>
                    {doc.metadata?.subject && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{doc.metadata.subject}</p>
                    )}
                  </TableCell>
                  {!isRulings && (
                    <TableCell>
                      <Badge variant="secondary" className={`text-xs ${getTypeBadgeVariant(doc.doc_type)}`}>
                        {getTypeLabel(doc.doc_type)}
                      </Badge>
                    </TableCell>
                  )}
                  <TableCell className="text-sm text-muted-foreground">{doc.category || '-'}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{doc.reference_number || '-'}</TableCell>
                  {isRulings && <TableCell className="text-sm text-muted-foreground">{doc.court_chamber || '-'}</TableCell>}
                  {isRulings && <TableCell className="text-sm text-muted-foreground">{doc.metadata?.file_number || '-'}</TableCell>}
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
          {docs.map(doc => (
            <div key={doc.id} className="p-3 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-medium line-clamp-2 flex-1">{formatTitle(doc)}</p>
                <Badge variant="secondary" className={`text-[10px] shrink-0 ${getTypeBadgeVariant(doc.doc_type)}`}>
                  {getTypeLabel(doc.doc_type)}
                </Badge>
              </div>
              {doc.metadata?.subject && (
                <p className="text-xs text-muted-foreground line-clamp-1">{doc.metadata.subject}</p>
              )}
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
                {doc.category && <span>📂 {doc.category}</span>}
                {doc.reference_number && <span>📋 {doc.reference_number}</span>}
                {isRulings && doc.court_chamber && <span>🏛️ {doc.court_chamber}</span>}
                {isRulings && doc.metadata?.file_number && <span>📁 ملف {doc.metadata.file_number}</span>}
                <span>📅 {doc.decision_date || new Date(doc.created_at).toLocaleDateString('ar-MA')}</span>
              </div>
            </div>
          ))}
        </div>
      </>
    );
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

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-3 sm:p-4 flex items-center gap-2 sm:gap-3">
            <Database className="h-6 w-6 sm:h-8 sm:w-8 text-primary shrink-0" />
            <div className="min-w-0">
              <p className="text-lg sm:text-2xl font-bold text-foreground">{stats.total || 0}</p>
              <p className="text-[10px] sm:text-xs text-muted-foreground">إجمالي المستندات</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 sm:p-4 flex items-center gap-2 sm:gap-3">
            <FileText className="h-6 w-6 sm:h-8 sm:w-8 text-blue-600 shrink-0" />
            <div className="min-w-0">
              <p className="text-lg sm:text-2xl font-bold text-foreground">{legislationCount}</p>
              <p className="text-[10px] sm:text-xs text-muted-foreground">تشريعات</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 sm:p-4 flex items-center gap-2 sm:gap-3">
            <Scale className="h-6 w-6 sm:h-8 sm:w-8 text-primary shrink-0" />
            <div className="min-w-0">
              <p className="text-lg sm:text-2xl font-bold text-foreground">{rulingsCount}</p>
              <p className="text-[10px] sm:text-xs text-muted-foreground">اجتهادات قضائية</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 sm:p-4">
            <div className="grid grid-cols-2 gap-1 text-[10px]">
              {DOC_TYPES.filter(t => (stats[t.value] || 0) > 0).slice(0, 4).map(t => (
                <div key={t.value} className="flex justify-between">
                  <span className="text-muted-foreground truncate">{t.label}</span>
                  <span className="font-bold text-foreground">{stats[t.value] || 0}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full grid grid-cols-2">
          <TabsTrigger value="legislation" className="gap-1.5 text-xs sm:text-sm">
            <FileText className="h-4 w-4" />
            التشريعات ({legislationCount})
          </TabsTrigger>
          <TabsTrigger value="rulings" className="gap-1.5 text-xs sm:text-sm">
            <Scale className="h-4 w-4" />
            الاجتهادات القضائية ({rulingsCount})
          </TabsTrigger>
        </TabsList>

        {/* Legislation Tab */}
        <TabsContent value="legislation" className="space-y-4 mt-4">
          <Card>
            <CardContent className="p-3 sm:p-4">
              <div className="flex flex-col gap-3">
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="بحث في التشريعات..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pr-9 text-sm" />
                  </div>
                  <Select value={filterSubType} onValueChange={setFilterSubType}>
                    <SelectTrigger className="w-28 sm:w-40 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">جميع الأنواع</SelectItem>
                      {DOC_TYPES.filter(t => LEGISLATION_TYPES.includes(t.value)).map(t => (
                        <SelectItem key={t.value} value={t.value}>{t.label} ({stats[t.value] || 0})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={filterCategory} onValueChange={setFilterCategory}>
                    <SelectTrigger className="w-28 sm:w-36 text-sm hidden sm:flex">
                      <SelectValue placeholder="التصنيف" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">كل التصنيفات</SelectItem>
                      {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
                    <DialogTrigger asChild>
                      <Button size="sm" className="gap-1 text-xs"><Plus className="h-3.5 w-3.5" /> إضافة مستند</Button>
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
                                {DOC_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1">
                            <Label>التصنيف</Label>
                            <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
                              <SelectTrigger><SelectValue placeholder="اختر التصنيف" /></SelectTrigger>
                              <SelectContent>
                                {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <div className="space-y-1">
                          <Label>العنوان *</Label>
                          <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="مثال: قانون رقم 31.08 المتعلق بحماية المستهلك" />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <Label>رقم المرجع</Label>
                            <Input value={form.reference_number} onChange={e => setForm(f => ({ ...f, reference_number: e.target.value }))} placeholder="31.08" />
                          </div>
                          <div className="space-y-1">
                            <Label>تاريخ الصدور</Label>
                            <Input type="date" value={form.decision_date} onChange={e => setForm(f => ({ ...f, decision_date: e.target.value }))} />
                          </div>
                        </div>
                        {form.doc_type === 'ruling' && (
                          <div className="space-y-1">
                            <Label>الغرفة</Label>
                            <Select value={form.court_chamber} onValueChange={v => setForm(f => ({ ...f, court_chamber: v }))}>
                              <SelectTrigger><SelectValue placeholder="الغرفة" /></SelectTrigger>
                              <SelectContent>
                                {COURT_CHAMBERS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>
                        )}
                        <div className="space-y-1">
                          <Label>المصدر</Label>
                          <Input value={form.source} onChange={e => setForm(f => ({ ...f, source: e.target.value }))} placeholder="مثال: الجريدة الرسمية عدد 7050" />
                        </div>
                        <div className="space-y-1">
                          <Label>المحتوى *</Label>
                          <Textarea value={form.content} onChange={e => setForm(f => ({ ...f, content: e.target.value }))} placeholder="الصق هنا النص القانوني كاملاً..." rows={12} />
                        </div>
                        <Button onClick={handleAddDocument} disabled={submitting} className="w-full">
                          {submitting ? 'جاري الإضافة...' : 'إضافة المستند'}
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>

                  {/* Auto Ingest - SGG */}
                  <Dialog open={autoIngestOpen} onOpenChange={setAutoIngestOpen}>
                    <DialogTrigger asChild>
                      <Button size="sm" className="gap-1 bg-green-600 hover:bg-green-700 text-white text-xs">
                        <Database className="h-3.5 w-3.5" /> جلب شامل
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle className="flex items-center gap-2"><Database className="h-5 w-5 text-green-600" /> جلب شامل من المصادر الرسمية</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4 mt-4">
                        <p className="text-sm text-muted-foreground">يجلب فقط النصوص القانونية ذات الصلة (قوانين، ظهائر، مراسيم، دوريات، قرارات قضائية).</p>
                        <div className="space-y-2">
                          <Label>اختر المصدر</Label>
                          <div className="grid grid-cols-1 gap-2">
                            {[
                              { value: 'sgg' as const, icon: FileText, name: 'الجريدة الرسمية', desc: 'القوانين والظهائر والمراسيم والدوريات' },
                              { value: 'cassation' as const, icon: Scale, name: 'محكمة النقض', desc: 'اجتهادات وقرارات محكمة النقض' },
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
                          {autoIngesting ? <><Loader2 className="h-4 w-4 animate-spin" /> جاري الجلب...</> : <><Database className="h-4 w-4" /> ابدأ الجلب</>}
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
                            {autoIngestLog.map((log, i) => <p key={i} className="text-xs">{log}</p>)}
                          </div>
                        )}
                      </div>
                    </DialogContent>
                  </Dialog>

                  {/* SGG Archive */}
                  <Dialog open={sggDialogOpen} onOpenChange={setSggDialogOpen}>
                    <DialogTrigger asChild>
                      <Button size="sm" className="gap-1 bg-amber-600 hover:bg-amber-700 text-white text-xs">
                        <FileText className="h-3.5 w-3.5" /> أرشيف SGG
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle className="flex items-center gap-2"><FileText className="h-5 w-5 text-amber-600" /> جلب من أرشيف الأمانة العامة للحكومة</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4 mt-4">
                        <p className="text-sm text-muted-foreground">يكتشف جميع صفحات القوانين ويجلبها مع تصنيف تلقائي (قوانين، ظهائر، مراسيم، دوريات) ومنع التكرار.</p>
                        <div className="border rounded-lg p-4 space-y-3">
                          <h3 className="font-semibold text-sm flex items-center gap-2">
                            <span className="bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-200 rounded-full w-6 h-6 flex items-center justify-center text-xs">1</span>
                            اكتشاف الصفحات
                          </h3>
                          <Button onClick={handleSggDiscover} disabled={sggScraping} variant="outline" className="w-full gap-2">
                            {sggStep === 'discovering' ? <><Loader2 className="h-4 w-4 animate-spin" /> جاري الاكتشاف...</> : <><Search className="h-4 w-4" /> اكتشاف صفحات القوانين</>}
                          </Button>
                          {sggStats.found > 0 && (
                            <div className="grid grid-cols-3 gap-2 text-center">
                              <div className="bg-muted/50 rounded p-2"><p className="text-lg font-bold text-foreground">{sggStats.found}</p><p className="text-[10px] text-muted-foreground">رابط قانوني</p></div>
                              <div className="bg-muted/50 rounded p-2"><p className="text-lg font-bold text-primary">{sggStats.new}</p><p className="text-[10px] text-muted-foreground">جديد</p></div>
                              <div className="bg-muted/50 rounded p-2"><p className="text-lg font-bold text-muted-foreground">{sggStats.alreadyScraped}</p><p className="text-[10px] text-muted-foreground">موجود مسبقاً</p></div>
                            </div>
                          )}
                        </div>
                        {sggNewUrls.length > 0 && (
                          <div className="border rounded-lg p-4 space-y-3">
                            <h3 className="font-semibold text-sm flex items-center gap-2">
                              <span className="bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-200 rounded-full w-6 h-6 flex items-center justify-center text-xs">2</span>
                              جلب ({sggNewUrls.length} صفحة جديدة)
                            </h3>
                            <Button onClick={handleSggScrapeAll} disabled={sggScraping} className="w-full gap-2 bg-amber-600 hover:bg-amber-700">
                              {sggStep === 'scraping' ? <><Loader2 className="h-4 w-4 animate-spin" /> جاري الجلب...</> : <><Database className="h-4 w-4" /> جلب كل القوانين الجديدة</>}
                            </Button>
                          </div>
                        )}
                        {sggStep === 'scraping' && (
                          <div className="space-y-1">
                            <Progress value={sggProgress} className="h-2" />
                            <div className="flex justify-between text-xs text-muted-foreground"><span>{sggProgress}%</span><span>{sggTotalIngested} جزء جديد</span></div>
                          </div>
                        )}
                        {sggLog.length > 0 && (
                          <div className="bg-muted/50 rounded-lg p-3 space-y-1 max-h-60 overflow-y-auto">
                            {sggLog.map((log, i) => <p key={i} className="text-xs">{log}</p>)}
                          </div>
                        )}
                        {sggStep === 'done' && (
                          <Button onClick={() => { setSggDialogOpen(false); setSggStep('idle'); setSggLog([]); setSggNewUrls([]); setSggStats({ found: 0, new: 0, alreadyScraped: 0 }); }} variant="outline" className="w-full">إغلاق</Button>
                        )}
                      </div>
                    </DialogContent>
                  </Dialog>

                  {/* Adala Portal */}
                  <Dialog open={adalaDialogOpen} onOpenChange={setAdalaDialogOpen}>
                    <DialogTrigger asChild>
                      <Button size="sm" className="gap-1 bg-blue-600 hover:bg-blue-700 text-white text-xs">
                        <Scale className="h-3.5 w-3.5" /> بوابة عدالة (1-1070)
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle className="flex items-center gap-2"><Scale className="h-5 w-5 text-blue-600" /> جلب من بوابة عدالة - وزارة العدل</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4 mt-4">
                        <p className="text-sm text-muted-foreground">
                          يجلب جميع النصوص القانونية من بوابة عدالة (الموارد من 1 إلى 1070) مع تصنيف تلقائي وتنظيم دقيق لكل نوع: قوانين، ظهائر، مراسيم، دوريات، قرارات، اتفاقيات.
                        </p>
                        <div className="border rounded-lg p-4 space-y-3">
                          <h3 className="font-semibold text-sm flex items-center gap-2">
                            <span className="bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded-full w-6 h-6 flex items-center justify-center text-xs">1</span>
                            فحص الموارد المتاحة
                          </h3>
                          <Button onClick={handleAdalaCheck} disabled={adalaScraping} variant="outline" className="w-full gap-2">
                            {adalaStep === 'checking' ? <><Loader2 className="h-4 w-4 animate-spin" /> جاري الفحص...</> : <><Search className="h-4 w-4" /> فحص الموارد (1 - 1070)</>}
                          </Button>
                          {adalaStats.total > 0 && (
                            <div className="grid grid-cols-3 gap-2 text-center">
                              <div className="bg-muted/50 rounded p-2"><p className="text-lg font-bold text-foreground">{adalaStats.total}</p><p className="text-[10px] text-muted-foreground">إجمالي</p></div>
                              <div className="bg-muted/50 rounded p-2"><p className="text-lg font-bold text-primary">{adalaStats.newCount}</p><p className="text-[10px] text-muted-foreground">جديد</p></div>
                              <div className="bg-muted/50 rounded p-2"><p className="text-lg font-bold text-muted-foreground">{adalaStats.existing}</p><p className="text-[10px] text-muted-foreground">موجود مسبقاً</p></div>
                            </div>
                          )}
                        </div>
                        {adalaNewIds.length > 0 && (
                          <div className="border rounded-lg p-4 space-y-3">
                            <h3 className="font-semibold text-sm flex items-center gap-2">
                              <span className="bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded-full w-6 h-6 flex items-center justify-center text-xs">2</span>
                              جلب ({adalaNewIds.length} مورد جديد)
                            </h3>
                            <Button onClick={handleAdalaScrapeAll} disabled={adalaScraping} className="w-full gap-2 bg-blue-600 hover:bg-blue-700">
                              {adalaStep === 'scraping' ? <><Loader2 className="h-4 w-4 animate-spin" /> جاري الجلب...</> : <><Database className="h-4 w-4" /> جلب كل الموارد الجديدة</>}
                            </Button>
                          </div>
                        )}
                        {adalaStep === 'scraping' && (
                          <div className="space-y-1">
                            <Progress value={adalaProgress} className="h-2" />
                            <div className="flex justify-between text-xs text-muted-foreground"><span>{adalaProgress}%</span><span>{adalaTotalIngested} جزء جديد</span></div>
                          </div>
                        )}
                        {adalaLog.length > 0 && (
                          <div className="bg-muted/50 rounded-lg p-3 space-y-1 max-h-60 overflow-y-auto">
                            {adalaLog.map((log, i) => <p key={i} className="text-xs">{log}</p>)}
                          </div>
                        )}
                        {adalaStep === 'done' && (
                          <Button onClick={() => { setAdalaDialogOpen(false); setAdalaStep('idle'); setAdalaLog([]); setAdalaNewIds([]); setAdalaStats({ total: 0, existing: 0, newCount: 0 }); }} variant="outline" className="w-full">إغلاق</Button>
                        )}
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Legislation Documents */}
          <Card>
            <CardContent className="p-0">
              {renderDocumentsList(documents, false)}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Rulings Tab */}
        <TabsContent value="rulings" className="space-y-4 mt-4">
          <Card>
            <CardContent className="p-3 sm:p-4">
              <div className="flex flex-col gap-3">
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="بحث في القرارات القضائية..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pr-9 text-sm" />
                  </div>
                  <Select value={filterChamber} onValueChange={setFilterChamber}>
                    <SelectTrigger className="w-32 sm:w-44 text-sm">
                      <SelectValue placeholder="الغرفة" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">جميع الغرف</SelectItem>
                      {COURT_CHAMBERS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Select value={filterCategory} onValueChange={setFilterCategory}>
                    <SelectTrigger className="w-28 sm:w-36 text-sm hidden sm:flex">
                      <SelectValue placeholder="التصنيف" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">كل التصنيفات</SelectItem>
                      {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex flex-wrap gap-2">
                  {/* Scrape Rulings */}
                  <Dialog open={scrapeDialogOpen} onOpenChange={setScrapeDialogOpen}>
                    <DialogTrigger asChild>
                      <Button size="sm" variant="outline" className="gap-1 text-primary border-primary text-xs">
                        <Globe className="h-3.5 w-3.5" /> جلب قرارات
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle className="flex items-center gap-2"><Scale className="h-5 w-5 text-primary" /> جلب قرارات محكمة النقض</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4 mt-4">
                        <p className="text-sm text-muted-foreground">يتم جلب القرارات مع استخراج: رقم القرار، رقم الملف، الغرفة، التاريخ، الموضوع تلقائياً.</p>
                        <div className="space-y-2">
                          <Label>المصدر</Label>
                          <Input value={scrapeUrl} onChange={e => setScrapeUrl(e.target.value)} placeholder="https://..." dir="ltr" />
                        </div>
                        <Button onClick={handleMapWebsite} disabled={scraping} variant="outline" className="w-full gap-2">
                          {scrapeStep === 'mapping' ? <><Loader2 className="h-4 w-4 animate-spin" /> جاري الاكتشاف...</> : <><Search className="h-4 w-4" /> اكتشاف روابط القرارات</>}
                        </Button>
                        {discoveredUrls.length > 0 && (
                          <>
                            <div className="bg-muted/50 rounded-lg p-3 space-y-2">
                              <p className="text-sm font-medium">تم اكتشاف {discoveredUrls.length} رابط</p>
                              <div className="max-h-32 overflow-y-auto text-xs text-muted-foreground space-y-1">
                                {discoveredUrls.slice(0, 20).map((u, i) => (
                                  <div key={i} className="truncate" dir="ltr">{u}</div>
                                ))}
                              </div>
                            </div>
                            <Button onClick={handleScrapeUrls} disabled={scraping} className="w-full gap-2">
                              {scrapeStep === 'scraping' ? <><Loader2 className="h-4 w-4 animate-spin" /> جاري الجلب...</> : <>جلب كل القرارات ({discoveredUrls.length})</>}
                            </Button>
                            {scrapeStep === 'scraping' && (
                              <div className="space-y-1"><Progress value={scrapeProgress} className="h-2" /><p className="text-xs text-muted-foreground text-center">{scrapeProgress}%</p></div>
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
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Rulings Documents */}
          <Card>
            <CardContent className="p-0">
              {renderDocumentsList(documents, true)}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default KnowledgeBase;
