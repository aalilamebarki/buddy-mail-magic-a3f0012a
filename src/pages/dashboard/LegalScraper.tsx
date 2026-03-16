import { useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { Download, Play, Square, RefreshCw, CheckCircle, XCircle, SkipForward, Loader2 } from 'lucide-react';

type LogEntry = {
  time: string;
  message: string;
  type: 'info' | 'success' | 'error' | 'warning';
};

type Stats = {
  totalDocs: number;
  withLocalPdf: number;
  lastPage: number;
  totalPages: number;
};

const LegalScraper = () => {
  const { toast } = useToast();
  const [startPage, setStartPage] = useState(1);
  const [endPage, setEndPage] = useState(5);
  const [isRunning, setIsRunning] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [progress, setProgress] = useState({ current: 0, total: 0, success: 0, failed: 0, skipped: 0 });
  const stopRef = useRef(false);
  const logsEndRef = useRef<HTMLDivElement>(null);

  const addLog = (message: string, type: LogEntry['type'] = 'info') => {
    const entry: LogEntry = { time: new Date().toLocaleTimeString('ar-MA'), message, type };
    setLogs(prev => [...prev, entry]);
    setTimeout(() => logsEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
  };

  const fetchStats = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('scrape-adala-resources', {
        body: { action: 'status' },
      });
      if (error) throw error;
      setStats(data);
      addLog(`📊 الإحصائيات: ${data.totalDocs} وثيقة | ${data.withLocalPdf} مع PDF | آخر صفحة: ${data.lastPage}`, 'info');
    } catch (e: any) {
      addLog(`❌ خطأ في جلب الإحصائيات: ${e.message}`, 'error');
    }
  };

  const scrapeSinglePage = async (pageId: number): Promise<'success' | 'error' | 'skipped'> => {
    try {
      const { data, error } = await supabase.functions.invoke('scrape-adala-resources', {
        body: { action: 'scrape_page', page_id: pageId },
      });

      if (error) {
        addLog(`❌ صفحة ${pageId}: ${error.message}`, 'error');
        return 'error';
      }

      if (data.skipped) {
        addLog(`⏭️ صفحة ${pageId}: تم جلبها مسبقاً`, 'warning');
        return 'skipped';
      }

      if (data.count === 0) {
        addLog(`📄 صفحة ${pageId}: لا توجد ملفات PDF`, 'warning');
        return 'skipped';
      }

      const results = data.results || [];
      const saved = results.filter((r: any) => r.status?.includes('✅')).length;
      addLog(`✅ صفحة ${pageId}: ${saved}/${results.length} وثيقة محفوظة`, 'success');
      
      for (const r of results) {
        const icon = r.status?.includes('✅') ? '📗' : r.status === 'duplicate' ? '🔄' : '📝';
        addLog(`  ${icon} ${r.title?.slice(0, 60)} [${r.doc_type || ''}] ${r.category || ''}`, 'info');
      }

      return 'success';
    } catch (e: any) {
      addLog(`❌ صفحة ${pageId}: ${e.message?.slice(0, 100)}`, 'error');
      return 'error';
    }
  };

  const startScraping = async () => {
    stopRef.current = false;
    setIsRunning(true);
    setLogs([]);
    
    const total = endPage - startPage + 1;
    setProgress({ current: 0, total, success: 0, failed: 0, skipped: 0 });
    addLog(`🚀 بدء جلب الصفحات من ${startPage} إلى ${endPage} (${total} صفحة)`, 'info');

    let success = 0, failed = 0, skipped = 0;

    for (let page = startPage; page <= endPage; page++) {
      if (stopRef.current) {
        addLog('⏹️ تم إيقاف العملية', 'warning');
        break;
      }

      addLog(`📥 جاري جلب صفحة ${page}...`, 'info');
      const result = await scrapeSinglePage(page);

      if (result === 'success') success++;
      else if (result === 'error') failed++;
      else skipped++;

      setProgress({ current: page - startPage + 1, total, success, failed, skipped });

      // Delay between pages to avoid rate limiting
      if (page < endPage && !stopRef.current) {
        await new Promise(r => setTimeout(r, 2000));
      }
    }

    addLog(`🏁 انتهى: ${success} نجاح | ${failed} فشل | ${skipped} تخطي`, success > 0 ? 'success' : 'warning');
    setIsRunning(false);
    fetchStats();
  };

  const stopScraping = () => {
    stopRef.current = true;
    addLog('⏳ جاري الإيقاف...', 'warning');
  };

  const testSinglePage = async () => {
    setIsRunning(true);
    setLogs([]);
    addLog(`🧪 اختبار جلب صفحة واحدة: resources/${startPage}`, 'info');
    
    setProgress({ current: 0, total: 1, success: 0, failed: 0, skipped: 0 });
    const result = await scrapeSinglePage(startPage);
    
    setProgress({
      current: 1, total: 1,
      success: result === 'success' ? 1 : 0,
      failed: result === 'error' ? 1 : 0,
      skipped: result === 'skipped' ? 1 : 0,
    });
    
    setIsRunning(false);
    fetchStats();

    toast({
      title: result === 'success' ? '✅ تم بنجاح' : result === 'skipped' ? '⏭️ تم التخطي' : '❌ فشل',
      description: `صفحة ${startPage}: ${result}`,
    });
  };

  const progressPercent = progress.total > 0 ? (progress.current / progress.total) * 100 : 0;

  return (
    <div className="space-y-4 p-4 md:p-6" dir="rtl">
      <div className="flex items-center justify-between">
        <h1 className="text-xl md:text-2xl font-bold text-foreground">جلب الوثائق القانونية</h1>
        <Button variant="outline" size="sm" onClick={fetchStats} disabled={isRunning}>
          <RefreshCw className="h-4 w-4 ml-1" />
          تحديث
        </Button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card><CardContent className="p-3 text-center">
            <div className="text-2xl font-bold text-primary">{stats.totalDocs}</div>
            <div className="text-xs text-muted-foreground">إجمالي الوثائق</div>
          </CardContent></Card>
          <Card><CardContent className="p-3 text-center">
            <div className="text-2xl font-bold text-green-600">{stats.withLocalPdf}</div>
            <div className="text-xs text-muted-foreground">مع PDF محلي</div>
          </CardContent></Card>
          <Card><CardContent className="p-3 text-center">
            <div className="text-2xl font-bold text-blue-600">{stats.lastPage}</div>
            <div className="text-xs text-muted-foreground">آخر صفحة</div>
          </CardContent></Card>
          <Card><CardContent className="p-3 text-center">
            <div className="text-2xl font-bold text-muted-foreground">{stats.totalPages}</div>
            <div className="text-xs text-muted-foreground">إجمالي الصفحات</div>
          </CardContent></Card>
        </div>
      )}

      {/* Controls */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">إعدادات الجلب</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">من صفحة</label>
              <Input
                type="number" min={1} max={1070}
                value={startPage}
                onChange={e => setStartPage(Number(e.target.value))}
                className="w-24"
                disabled={isRunning}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">إلى صفحة</label>
              <Input
                type="number" min={1} max={1070}
                value={endPage}
                onChange={e => setEndPage(Number(e.target.value))}
                className="w-24"
                disabled={isRunning}
              />
            </div>
            
            <Button onClick={testSinglePage} disabled={isRunning} variant="outline" size="sm">
              {isRunning ? <Loader2 className="h-4 w-4 animate-spin ml-1" /> : <Play className="h-4 w-4 ml-1" />}
              اختبار صفحة {startPage}
            </Button>

            {!isRunning ? (
              <Button onClick={startScraping} size="sm">
                <Download className="h-4 w-4 ml-1" />
                بدء الجلب ({endPage - startPage + 1} صفحة)
              </Button>
            ) : (
              <Button onClick={stopScraping} variant="destructive" size="sm">
                <Square className="h-4 w-4 ml-1" />
                إيقاف
              </Button>
            )}
          </div>

          {/* Progress */}
          {progress.total > 0 && (
            <div className="space-y-2">
              <Progress value={progressPercent} className="h-2" />
              <div className="flex gap-3 text-xs text-muted-foreground">
                <span>{progress.current}/{progress.total} صفحة</span>
                <Badge variant="outline" className="text-green-600 border-green-300">
                  <CheckCircle className="h-3 w-3 ml-1" />{progress.success}
                </Badge>
                <Badge variant="outline" className="text-red-600 border-red-300">
                  <XCircle className="h-3 w-3 ml-1" />{progress.failed}
                </Badge>
                <Badge variant="outline" className="text-yellow-600 border-yellow-300">
                  <SkipForward className="h-3 w-3 ml-1" />{progress.skipped}
                </Badge>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Logs */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">السجل</CardTitle>
            {logs.length > 0 && (
              <Button variant="ghost" size="sm" onClick={() => setLogs([])}>مسح</Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-80 border rounded-md bg-muted/30 p-3">
            {logs.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                اضغط "اختبار صفحة" أو "بدء الجلب" لبدء العملية
              </p>
            ) : (
              <div className="space-y-1 font-mono text-xs">
                {logs.map((log, i) => (
                  <div
                    key={i}
                    className={`py-0.5 ${
                      log.type === 'error' ? 'text-red-500' :
                      log.type === 'success' ? 'text-green-600' :
                      log.type === 'warning' ? 'text-yellow-600' :
                      'text-foreground/80'
                    }`}
                  >
                    <span className="text-muted-foreground">[{log.time}]</span> {log.message}
                  </div>
                ))}
                <div ref={logsEndRef} />
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
};

export default LegalScraper;
