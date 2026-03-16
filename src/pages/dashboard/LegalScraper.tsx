import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { RefreshCw, Database, FileText, HardDrive, Terminal, Copy, CheckCircle } from 'lucide-react';

type Stats = {
  totalDocs: number;
  withLocalPdf: number;
  byType: Record<string, number>;
  byCategory: Record<string, number>;
};

const LegalScraper = () => {
  const { toast } = useToast();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const fetchStats = async () => {
    setLoading(true);
    try {
      // Total docs with resource_page_id
      const { count: total } = await supabase
        .from('legal_documents')
        .select('*', { count: 'exact', head: true });

      // With local PDF
      const { count: withPdf } = await supabase
        .from('legal_documents')
        .select('*', { count: 'exact', head: true })
        .not('local_pdf_path', 'is', null)
        .neq('local_pdf_path', 'fetch_failed')
        .neq('local_pdf_path', 'upload_failed');

      // By type
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

      setStats({
        totalDocs: total || 0,
        withLocalPdf: withPdf || 0,
        byType,
        byCategory,
      });
    } catch (e: any) {
      toast({ title: 'خطأ', description: e.message, variant: 'destructive' });
    }
    setLoading(false);
  };

  useEffect(() => { fetchStats(); }, []);

  const copyCommand = (cmd: string) => {
    navigator.clipboard.writeText(cmd);
    setCopied(true);
    toast({ title: 'تم النسخ' });
    setTimeout(() => setCopied(false), 2000);
  };

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
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
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
        </div>
      )}

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

      {/* Instructions */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Terminal className="h-4 w-4" />
            تعليمات الجلب (سكريبت محلي)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            موقع عدالة يحجب الاتصالات السحابية. استخدم السكريبت المحلي لجلب الوثائق:
          </p>

          <div className="space-y-2">
            <p className="text-xs font-medium text-foreground">1. تثبيت المتطلبات:</p>
            <div className="relative">
              <pre className="bg-muted p-2 rounded text-xs overflow-x-auto" dir="ltr">
                pip install requests
              </pre>
            </div>

            <p className="text-xs font-medium text-foreground">2. تعيين المتغيرات:</p>
            <div className="relative">
              <pre className="bg-muted p-2 rounded text-xs overflow-x-auto whitespace-pre-wrap" dir="ltr">
{`export SUPABASE_SERVICE_ROLE_KEY="مفتاحك"
export LOVABLE_API_KEY="مفتاحك"  # اختياري`}
              </pre>
              <Button
                variant="ghost" size="icon"
                className="absolute top-1 left-1 h-6 w-6"
                onClick={() => copyCommand('export SUPABASE_SERVICE_ROLE_KEY=""\nexport LOVABLE_API_KEY=""')}
              >
                {copied ? <CheckCircle className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              </Button>
            </div>

            <p className="text-xs font-medium text-foreground">3. تشغيل الاختبار:</p>
            <pre className="bg-muted p-2 rounded text-xs overflow-x-auto" dir="ltr">
              python scripts/scrape_adala.py --test
            </pre>

            <p className="text-xs font-medium text-foreground">4. جلب كل الوثائق:</p>
            <pre className="bg-muted p-2 rounded text-xs overflow-x-auto" dir="ltr">
              python scripts/scrape_adala.py --start 1 --end 1070
            </pre>
          </div>

          <p className="text-xs text-muted-foreground mt-2">
            💡 السكريبت يجلب الصفحات → يستخرج روابط PDF → يحمل الملفات → يصنف بالذكاء الاصطناعي → يحفظ في قاعدة البيانات تلقائياً
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default LegalScraper;
