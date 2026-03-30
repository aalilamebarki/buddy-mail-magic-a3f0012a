import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import {
  RefreshCw, CheckCircle2, AlertTriangle, ArrowUpCircle,
  GitBranch, Shield, Database, Clock, Sparkles,
  Loader2, Info, PackageCheck, Rocket
} from 'lucide-react';
import { useVersionCheck } from '@/hooks/useVersionCheck';

type UpdateStep = 'idle' | 'compat' | 'instructions';

const UpdateManager = () => {
  const { hasUpdate, remote, isLoading, isError, error, refetch, CURRENT_VERSION } = useVersionCheck();
  const [updateStep, setUpdateStep] = useState<UpdateStep>('idle');

  const startUpdate = () => {
    setUpdateStep('compat');
    setTimeout(() => setUpdateStep('instructions'), 2500);
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto" dir="rtl">
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-xl bg-primary/10">
          <Rocket className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">إدارة التحديثات</h1>
          <p className="text-muted-foreground text-sm">تحقّق من آخر إصدار وقم بمزامنة الكود</p>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <PackageCheck className="h-5 w-5 text-primary" />
              الإصدار الحالي
            </CardTitle>
            <Badge variant="secondary" className="text-sm font-mono">{CURRENT_VERSION}</Badge>
          </div>
        </CardHeader>
      </Card>

      {isLoading && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="py-6 flex items-center gap-3 justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <span className="text-sm text-foreground">جارٍ البحث عن تحديثات…</span>
          </CardContent>
        </Card>
      )}

      {isError && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>خطأ في فحص التحديثات</AlertTitle>
          <AlertDescription>
            {error instanceof Error ? error.message : 'تعذّر الاتصال بخادم الإصدارات.'}
            <span className="block mt-1 text-xs opacity-70">تأكد من ضبط رابط ملف version.json في إعدادات الكود.</span>
          </AlertDescription>
        </Alert>
      )}

      {!isLoading && !isError && !hasUpdate && (
        <Card className="border-primary/20">
          <CardContent className="py-6 flex items-center gap-3 justify-center">
            <CheckCircle2 className="h-5 w-5 text-primary" />
            <span className="text-sm font-medium text-foreground">نظامك محدّث بآخر إصدار 🎉</span>
          </CardContent>
        </Card>
      )}

      {hasUpdate && remote && (
        <Card className="border-destructive/40 shadow-lg">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <CardTitle className="text-base flex items-center gap-2 text-destructive">
                <ArrowUpCircle className="h-5 w-5" />
                تحديث جديد متاح!
              </CardTitle>
              <Badge variant="destructive" className="font-mono">v{remote.version}</Badge>
            </div>
            {remote.date && (
              <CardDescription className="flex items-center gap-1 mt-1">
                <Clock className="h-3.5 w-3.5" /> {remote.date}
              </CardDescription>
            )}
          </CardHeader>

          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">{remote.changelog}</p>

            {remote.features && remote.features.length > 0 && (
              <>
                <Separator />
                <div>
                  <h4 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
                    <Sparkles className="h-4 w-4 text-primary" /> الميزات الجديدة
                  </h4>
                  <ul className="space-y-1.5">
                    {remote.features.map((f, i) => (
                      <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                        <CheckCircle2 className="h-4 w-4 mt-0.5 text-primary shrink-0" />
                        {f}
                      </li>
                    ))}
                  </ul>
                </div>
              </>
            )}

            <Separator />

            <Alert>
              <Shield className="h-4 w-4" />
              <AlertTitle>بياناتك في أمان</AlertTitle>
              <AlertDescription className="text-xs">
                التحديث يشمل الكود والواجهات فقط. بياناتك المخزنة في قاعدة البيانات (الملفات، الموكلون، الفواتير…) لن تتأثر إطلاقاً.
              </AlertDescription>
            </Alert>

            {updateStep === 'idle' && (
              <Button onClick={startUpdate} className="w-full gap-2" size="lg">
                <ArrowUpCircle className="h-5 w-5" />
                تحديث النظام الآن
              </Button>
            )}

            {updateStep === 'compat' && (
              <Card className="bg-muted/50 border-dashed">
                <CardContent className="py-6 flex flex-col items-center gap-3">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  <span className="text-sm font-medium">جارٍ التحقق من التوافق مع قاعدة البيانات…</span>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Database className="h-3.5 w-3.5" /> فحص الجداول والسياسات الأمنية
                  </div>
                </CardContent>
              </Card>
            )}

            {updateStep === 'instructions' && (
              <Card className="border-primary/30 bg-primary/5">
                <CardContent className="py-5 space-y-4">
                  <div className="flex items-center gap-2 text-primary font-semibold text-sm">
                    <CheckCircle2 className="h-5 w-5" />
                    التوافق ممتاز — جاهز للتحديث!
                  </div>

                  <div className="space-y-3 text-sm">
                    <p className="font-medium text-foreground">اتّبع الخطوات التالية لإتمام التحديث:</p>
                    <div className="space-y-2">
                      <div className="flex items-start gap-3 p-3 rounded-lg bg-background border">
                        <span className="shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">1</span>
                        <div>
                          <p className="font-medium">افتح إعدادات المشروع في Lovable</p>
                          <p className="text-muted-foreground text-xs">اضغط على أيقونة الترس في أعلى يسار المحرر</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3 p-3 rounded-lg bg-background border">
                        <span className="shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">2</span>
                        <div>
                          <p className="font-medium flex items-center gap-1.5">
                            اذهب إلى قسم GitHub
                            <GitBranch className="h-4 w-4 text-muted-foreground" />
                          </p>
                          <p className="text-muted-foreground text-xs">ستجد خيار المزامنة مع المستودع</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3 p-3 rounded-lg bg-background border">
                        <span className="shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">3</span>
                        <div>
                          <p className="font-medium">اضغط "Sync from GitHub"</p>
                          <p className="text-muted-foreground text-xs">سيتم سحب آخر التعديلات من المستودع وتطبيقها تلقائياً</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <Alert>
                    <Info className="h-4 w-4" />
                    <AlertDescription className="text-xs">
                      بعد المزامنة، قم بتحديث رقم الإصدار في ملف <code className="bg-muted px-1 rounded text-[11px]">useVersionCheck.ts</code> ليتطابق مع الإصدار الجديد.
                    </AlertDescription>
                  </Alert>
                </CardContent>
              </Card>
            )}
          </CardContent>
        </Card>
      )}

      <div className="flex justify-center">
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={isLoading}
          className="gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          إعادة الفحص
        </Button>
      </div>
    </div>
  );
};

export default UpdateManager;
