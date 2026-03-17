import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { RefreshCw, Database, FileText, HardDrive, Play, Square, Zap } from 'lucide-react';

type Stats = {
  totalDocs: number;
  withLocalPdf: number;
  lastPage: number;
  byType: Record<string, number>;
  byCategory: Record<string, number>;
};

type LogEntry = {
  time: string;
  message: string;
  type: 'info' | 'success' | 'error' | 'warning';
};

const LegalScraper = () => {
  const { toast } = useToast();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(false);
  const [scraping, setScraping] = useState(false);
  const [startPage, setStartPage] = useState(1);
  const [endPage, setEndPage] = useState(1070);
  const [batchSize, setBatchSize] = useState(5);
  const [currentPage, setCurrentPage] = useState(0);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const stopRef = useRef(false);
  const logsEndRef = useRef<HTMLDivElement>(null);

  const addLog = (message: string, type: LogEntry['type'] = 'info') => {
    const time = new Date().toLocaleTimeString('ar-MA');
    setLogs(prev => [...prev.slice(-100), { time, message, type }]);
  };

  const fetchStats = async () => {
    setLoading(true);
    try {
      const { count: total } = await supabase
        .from('legal_documents')
        .select('*', { count: 'exact', head: true });

      const { count: withPdf } = await supabase
        .from('legal_documents')
        .select('*', { count: 'exact', head: true })
        .not('local_pdf_path', 'is', null)
        .neq('local_pdf_path', 'fetch_failed')
        .neq('local_pdf_path', 'upload_failed');

      const { data: maxP } = await supabase
        .from('legal_documents')
        .select('resource_page_id')
        .not('resource_page_id', 'is', null)
        .order('resource_page_id', { ascending: false })
        .limit(1);

      const { data: docs } = await supabase
        .from('legal_documents')
        .select('doc_type, category');

      const byType: Record<string, number> = {};
      const byCategory: Record<string, number> = {};
      for (const doc of docs || []) {
        byType[doc.doc_type] = (byType[doc.doc_type] || 0) + 1;
        if (doc.category) {
          byCategory[doc.category] = (byCategory[doc.category] || 0) + 1;
        }
      }

      const lastPage = maxP?.[0]?.resource_page_id || 0;
      setStats({ totalDocs: total || 0, withLocalPdf: withPdf || 0, lastPage, byType, byCategory });
      
      if (lastPage > 0) {
        setStartPage(lastPage + 1);
      }
    } catch (e: any) {
      toast({ title: 'خطأ', description: e.message, variant: 'destructive' });
    }
    setLoading(false);
  };

  useEffect(() => { fetchStats(); }, []);
  useEffect(() => { logsEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [logs]);

  const startScraping = async () => {
    setScraping(true);
    stopRef.current = false;
    addLog(`🚀 بدء الجلب من صفحة ${startPage} إلى ${endPage} (دفعات من ${batchSize})`, 'info');

    let currentStart = startPage;

    while (currentStart <= endPage && !stopRef.current) {
      setCurrentPage(currentStart);
      addLog(`📄 جلب الصفحات ${currentStart} - ${Math.min(currentStart + batchSize - 1, endPage)}...`);

      try {
        const { data, error } = await supabase.functions.invoke('firecrawl-legal-scraper', {
          body: {
            action: 'batch_scrape',
            start_page: currentStart,
            end_page: endPage,
            batch_size: batchSize,
          },
        });

        if (error) {
          addLog(`❌ خطأ: ${error.message}`, 'error');
          // Wait and retry
          await new Promise(r => setTimeout(r, 5000));
          continue;
        }

        if (data?.results) {
          for (const r of data.results) {
            if (r.status === 'done') {
              addLog(`✅ صفحة ${r.page_id}: وُجد ${r.found} رابط، حُفظ ${r.saved}`, 'success');
            } else if (r.status === 'skipped') {
              addLog(`⏭️ صفحة ${r.page_id}: تم جلبها مسبقاً`, 'warning');
            } else if (r.status === 'firecrawl_error') {
              addLog(`⚠️ صفحة ${r.page_id}: خطأ Firecrawl (${r.code})`, 'error');
            } else {
              addLog(`⚠️ صفحة ${r.page_id}: ${r.status}`, 'warning');
            }
          }
        }

        currentStart = data?.next_start || currentStart + batchSize;

        // Brief pause between batches
        if (!stopRef.current && currentStart <= endPage) {
          await new Promise(r => setTimeout(r, 2000));
        }
      } catch (e: any) {
        addLog(`❌ خطأ غير متوقع: ${e.message}`, 'error');
        await new Promise(r => setTimeout(r, 5000));
        currentStart += batchSize;
      }
    }

    if (stopRef.current) {
      addLog('⏹️ تم إيقاف الجلب', 'warning');
    } else {
      addLog('🎉 اكتمل الجلب!', 'success');
    }

    setScraping(false);
    fetchStats();
  };

  const stopScraping = () => {
    stopRef.current = true;
    addLog('⏳ جاري الإيقاف...', 'warning');
  };

  const testSinglePage = async () => {
    addLog(`🧪 اختبار صفحة ${startPage}...`);
    try {
      const { data, error } = await supabase.functions.invoke('firecrawl-legal-scraper', {
        body: { action: 'scrape_page', page_id: startPage },
      });
      if (error) {
        addLog(`❌ خطأ: ${error.message}`, 'error');
      } else if (data?.skipped) {
        addLog(`⏭️ الصفحة مجلوبة مسبقاً`, 'warning');
      } else {
        addLog(`✅ نتيجة: ${data?.count || 0} وثيقة`, 'success');
        if (data?.results) {
          for (const r of data.results) {
            addLog(`   ${r.status} - ${r.title}`, r.status.includes('✅') ? 'success' : 'info');
          }
        }
      }
    } catch (e: any) {
      addLog(`❌ ${e.message}`, 'error');
    }
  };

  const progress = currentPage > 0 ? ((currentPage - startPage) / (endPage - startPage + 1)) * 100 : 0;

  const docTypeLabels: Record<string, string> = {
    law: 'قانون', dahir: 'ظهير', decree: 'مرسوم', organic_law: 'قانون تنظيمي',
    decision: 'قرار', circular: 'دورية', convention: 'اتفاقية',
  };

  return (
    <div className="space-y-4 p-4 md:p-6" dir="rtl">
      <div className="flex items-center justify-between">
        <h1 className="text-xl md:text-2xl font-bold text-foreground">جلب الوثائق القانونية</h1>
        <Button variant="outline" size="sm" onClick={fetchStats} disabled={loading}>
          <RefreshCw className={`h-4 w-4 ml-1 ${loading ? 'animate-spin' : ''}`} />
          تحديث
        </Button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card><CardContent className="p-3 text-center">
            <Database className="h-5 w-5 mx-auto mb-1 text-primary" />
            <div className="text-2xl font-bold text-primary">{stats.totalDocs}</div>
            <div className="text-xs text-muted-foreground">إجمالي الوثائق</div>
          </CardContent></Card>
          <Card><CardContent className="p-3 text-center">
            <HardDrive className="h-5 w-5 mx-auto mb-1 text-green-600" />
            <div className="text-2xl font-bold text-green-600">{stats.withLocalPdf}</div>
            <div className="text-xs text-muted-foreground">مع PDF محلي</div>
          </CardContent></Card>
          <Card><CardContent className="p-3 text-center">
            <FileText className="h-5 w-5 mx-auto mb-1 text-blue-600" />
            <div className="text-2xl font-bold text-blue-600">{Object.keys(stats.byCategory).length}</div>
            <div className="text-xs text-muted-foreground">تصنيف</div>
          </CardContent></Card>
          <Card><CardContent className="p-3 text-center">
            <Zap className="h-5 w-5 mx-auto mb-1 text-amber-600" />
            <div className="text-2xl font-bold text-amber-600">{stats.lastPage}</div>
            <div className="text-xs text-muted-foreground">آخر صفحة</div>
          </CardContent></Card>
        </div>
      )}

      {/* Controls */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">تحكم بعملية الجلب (عبر Firecrawl)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="text-xs text-muted-foreground">من صفحة</label>
              <Input type="number" min={1} max={1070} value={startPage}
                onChange={e => setStartPage(Number(e.target.value))} disabled={scraping} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">إلى صفحة</label>
              <Input type="number" min={1} max={1070} value={endPage}
                onChange={e => setEndPage(Number(e.target.value))} disabled={scraping} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">حجم الدفعة</label>
              <Input type="number" min={1} max={10} value={batchSize}
                onChange={e => setBatchSize(Number(e.target.value))} disabled={scraping} />
            </div>
          </div>

          {scraping && (
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>صفحة {currentPage} من {endPage}</span>
                <span>{Math.round(progress)}%</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>
          )}

          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={testSinglePage} disabled={scraping}>
              🧪 اختبار صفحة
            </Button>
            {!scraping ? (
              <Button size="sm" onClick={startScraping} className="flex-1">
                <Play className="h-4 w-4 ml-1" />
                بدء الجلب
              </Button>
            ) : (
              <Button size="sm" variant="destructive" onClick={stopScraping} className="flex-1">
                <Square className="h-4 w-4 ml-1" />
                إيقاف
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* By Type */}
      {stats && Object.keys(stats.byType).length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">حسب النوع</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {Object.entries(stats.byType).sort((a, b) => b[1] - a[1]).map(([type, count]) => (
                <Badge key={type} variant="secondary" className="text-xs">
                  {docTypeLabels[type] || type}: {count}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* By Category */}
      {stats && Object.keys(stats.byCategory).length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">حسب التصنيف</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {Object.entries(stats.byCategory).sort((a, b) => b[1] - a[1]).map(([cat, count]) => (
                <Badge key={cat} variant="outline" className="text-xs">
                  {cat}: {count}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Logs */}
      {logs.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">سجل العمليات</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => setLogs([])}>مسح</Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="bg-muted rounded-md p-2 max-h-60 overflow-y-auto text-xs font-mono space-y-1" dir="rtl">
              {logs.map((log, i) => (
                <div key={i} className={
                  log.type === 'error' ? 'text-destructive' :
                  log.type === 'success' ? 'text-green-600 dark:text-green-400' :
                  log.type === 'warning' ? 'text-amber-600 dark:text-amber-400' :
                  'text-muted-foreground'
                }>
                  <span className="text-muted-foreground/60">[{log.time}]</span> {log.message}
                </div>
              ))}
              <div ref={logsEndRef} />
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default LegalScraper;
