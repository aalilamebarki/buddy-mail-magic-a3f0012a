import { useState, useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, RefreshCw, ExternalLink, CheckCircle2, XCircle, Clock, AlertTriangle, Info, Zap, Globe } from 'lucide-react';
import { SyncJob } from '@/hooks/useMahakimSync';
import { formatDistanceToNow } from 'date-fns';
import { ar } from 'date-fns/locale';
import { resolvePortalCourts, parseCaseNumber } from '@/lib/court-mapping';
import { CaseNumberInput } from '@/components/cases/CaseNumberInput';

interface MahakimSyncStatusProps {
  caseNumber: string;
  courtName?: string | null;
  courtLevel?: string | null;
  latestJob: SyncJob | null;
  syncing: boolean;
  onSync: (appealCourt: string, firstInstanceCourt?: string, provider?: 'auto' | 'firecrawl' | 'scrapingbee') => void;
  onOpenPortal: () => void;
}

const statusConfig: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  pending: { label: 'في الانتظار', icon: <Clock className="h-3.5 w-3.5" />, color: 'text-amber-600' },
  scraping: { label: 'جاري الجلب...', icon: <Loader2 className="h-3.5 w-3.5 animate-spin" />, color: 'text-blue-600' },
  completed: { label: 'تم بنجاح', icon: <CheckCircle2 className="h-3.5 w-3.5" />, color: 'text-emerald-600' },
  failed: { label: 'فشل', icon: <XCircle className="h-3.5 w-3.5" />, color: 'text-destructive' },
};

const providerLabels: Record<string, { label: string; desc: string }> = {
  auto: { label: 'تلقائي', desc: 'يجرب Firecrawl أولاً ثم ScrapingBee' },
  firecrawl: { label: 'Firecrawl', desc: 'متصفح Playwright — أسرع' },
  scrapingbee: { label: 'ScrapingBee', desc: 'بروكسي مغربي — أكثر استقراراً' },
};

export const MahakimSyncStatus = ({
  caseNumber,
  courtName,
  courtLevel,
  latestJob,
  syncing,
  onSync,
  onOpenPortal,
}: MahakimSyncStatusProps) => {
  const status = latestJob ? statusConfig[latestJob.status] || statusConfig.pending : null;
  const isActive = syncing || latestJob?.status === 'pending' || latestJob?.status === 'scraping';

  const [dialogOpen, setDialogOpen] = useState(false);
  const [caseNumRaw, setCaseNumRaw] = useState('');
  const [provider, setProvider] = useState<'auto' | 'firecrawl' | 'scrapingbee'>('auto');

  // Auto-resolve courts from stored court name
  const parsedCode = useMemo(() => {
    const parts = caseNumRaw.split('/');
    return parts[1] || '';
  }, [caseNumRaw]);
  const resolved = useMemo(() => resolvePortalCourts(courtName, parsedCode), [courtName, parsedCode]);

  const handleOpenDialog = () => {
    setCaseNumRaw(caseNumber || '');
    // If last attempt failed, suggest switching provider
    if (latestJob?.status === 'failed') {
      const lastProvider = (latestJob.result_data as any)?._provider;
      if (lastProvider === 'firecrawl') setProvider('scrapingbee');
      else if (lastProvider === 'scrapingbee') setProvider('firecrawl');
      else setProvider('auto');
    } else {
      setProvider('auto');
    }
    setDialogOpen(true);
  };

  const isFormValid = useMemo(() => {
    const parts = caseNumRaw.split('/');
    return parts.length === 3 &&
      parts[0].trim() !== '' &&
      parts[1].trim().length === 4 && /^\d{4}$/.test(parts[1].trim()) &&
      parts[2].trim().length === 4 && /^\d{4}$/.test(parts[2].trim()) &&
      resolved.appealPortalLabel !== null;
  }, [caseNumRaw, resolved.appealPortalLabel]);

  const handleConfirmSync = () => {
    if (!isFormValid || !resolved.appealPortalLabel) return;
    onSync(resolved.appealPortalLabel, resolved.primaryPortalLabel || undefined, provider);
    setDialogOpen(false);
  };

  // Show which provider was used in last result
  const lastProvider = (latestJob?.result_data as any)?._provider;

  return (
    <div className="space-y-2">
      {/* Sync Button */}
      <div className="flex gap-2">
        <Button
          variant="default"
          size="sm"
          className="flex-1 gap-2"
          disabled={isActive}
          onClick={handleOpenDialog}
        >
          {isActive ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          {isActive ? 'جاري المزامنة...' : 'مزامنة من محاكم'}
        </Button>
        <Button variant="outline" size="sm" onClick={onOpenPortal} className="gap-1">
          <ExternalLink className="h-3.5 w-3.5" />
          فتح
        </Button>
      </div>

      {/* Sync Confirmation Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle>مزامنة الملف من بوابة محاكم</DialogTitle>
            <DialogDescription>تأكد من رقم الملف قبل المزامنة</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Single smart case number input */}
            <div className="space-y-2">
              <Label className="font-medium">رقم الملف *</Label>
              <CaseNumberInput
                value={caseNumRaw}
                onChange={setCaseNumRaw}
                autoFocus
                placeholder="رقم/رمز/سنة — مثال: 1/1401/2025"
              />
              <p className="text-[10px] text-muted-foreground">
                اكتب الرقم ثم / ثم الرمز (4 أرقام) ثم السنة
              </p>
            </div>

            {/* Auto-resolved court info */}
            {resolved.appealPortalLabel && (
              <div className="flex items-start gap-2 p-2.5 rounded-md bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                <div className="space-y-1 text-xs">
                  <p className="font-medium text-emerald-700 dark:text-emerald-400">تم تحديد المحكمة تلقائياً</p>
                  <p className="text-muted-foreground">
                    محكمة الاستئناف: <span className="font-semibold">{resolved.appealLabel}</span>
                  </p>
                  {resolved.primaryLabel && (
                    <p className="text-muted-foreground">
                      المحكمة الابتدائية: <span className="font-semibold">{resolved.primaryLabel}</span>
                    </p>
                  )}
                </div>
              </div>
            )}

            {!resolved.appealPortalLabel && courtName && (
              <div className="flex items-start gap-2 p-2.5 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                <div className="text-xs">
                  <p className="font-medium text-amber-700 dark:text-amber-400">لم يتم التعرف على المحكمة</p>
                  <p className="text-muted-foreground">
                    المحكمة المسجلة "{courtName}" غير موجودة في خريطة المحاكم.
                  </p>
                </div>
              </div>
            )}

            {!resolved.appealPortalLabel && !courtName && (
              <div className="flex items-start gap-2 p-2.5 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                <Info className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-700 dark:text-amber-400">
                  يرجى تحديد المحكمة في بيانات الملف أولاً.
                </p>
              </div>
            )}

            {/* Provider selector */}
            <div className="space-y-2">
              <Label className="font-medium text-xs">طريقة الجلب</Label>
              <Select value={provider} onValueChange={(v) => setProvider(v as any)}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(providerLabels).map(([key, { label, desc }]) => (
                    <SelectItem key={key} value={key} className="text-xs">
                      <div className="flex items-center gap-2">
                        {key === 'auto' && <Zap className="h-3 w-3 text-primary" />}
                        {key === 'firecrawl' && <Globe className="h-3 w-3 text-orange-500" />}
                        {key === 'scrapingbee' && <Globe className="h-3 w-3 text-yellow-500" />}
                        <span>{label}</span>
                        <span className="text-muted-foreground">— {desc}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {latestJob?.status === 'failed' && (
                <p className="text-[10px] text-amber-600">
                  💡 فشلت المحاولة السابقة — تم اقتراح مزود بديل
                </p>
              )}
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>إلغاء</Button>
            <Button onClick={handleConfirmSync} disabled={!isFormValid} className="gap-2">
              <RefreshCw className="h-4 w-4" />
              بدء المزامنة
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Status indicator */}
      {latestJob && status && (
        <Card className="border-dashed">
          <CardContent className="p-3 space-y-2">
            <div className="flex items-center justify-between">
              <div className={`flex items-center gap-1.5 text-xs font-medium ${status.color}`}>
                {status.icon}
                {status.label}
                {lastProvider && latestJob.status === 'completed' && (
                  <Badge variant="outline" className="text-[9px] px-1.5 py-0 font-normal">
                    {lastProvider === 'firecrawl' ? 'Firecrawl' : lastProvider === 'scrapingbee' ? 'ScrapingBee' : lastProvider}
                  </Badge>
                )}
              </div>
              {latestJob.completed_at && (
                <span className="text-[10px] text-muted-foreground">
                  {formatDistanceToNow(new Date(latestJob.completed_at), { addSuffix: true, locale: ar })}
                </span>
              )}
            </div>

            {latestJob.status === 'pending' && latestJob.retry_count > 0 && (
              <p className="text-xs text-amber-600 bg-amber-50 dark:bg-amber-950/30 rounded p-2">
                إعادة المحاولة {latestJob.retry_count}/{latestJob.max_retries}
              </p>
            )}

            {latestJob.status === 'failed' && latestJob.error_message && (
              <div className="text-xs bg-destructive/10 rounded p-2.5 space-y-1.5">
                <p className="text-destructive font-medium">{latestJob.error_message}</p>
                <div className="text-muted-foreground text-[10px] space-y-0.5">
                  {latestJob.error_message.includes('رصيد') && (
                    <p>💳 قم بإعادة شحن حسابك أو اختر مزوداً آخر من القائمة</p>
                  )}
                  {latestJob.error_message.includes('مهلة') && (
                    <p>⏱ البوابة قد تكون بطيئة — أعد المحاولة بعد دقيقة</p>
                  )}
                  {latestJob.error_message.includes('مفتاح') && (
                    <p>🔑 تواصل مع المسؤول لتحديث مفتاح الخدمة</p>
                  )}
                  {!latestJob.error_message.includes('رصيد') && !latestJob.error_message.includes('مهلة') && !latestJob.error_message.includes('مفتاح') && (
                    <p>💡 جرّب تغيير طريقة الجلب أو تحقق من رقم الملف</p>
                  )}
                </div>
              </div>
            )}

            {latestJob.status === 'completed' && latestJob.result_data && (
              <div className="space-y-1.5">
                {latestJob.next_session_date && (
                  <div className="flex items-center gap-2 bg-emerald-50 dark:bg-emerald-950/30 rounded p-2">
                    <Badge variant="outline" className="text-emerald-700 border-emerald-300 text-[10px]">
                      الجلسة المقبلة
                    </Badge>
                    <span className="text-xs font-semibold" dir="ltr">
                      {new Date(latestJob.next_session_date + 'T00:00:00').toLocaleDateString('ar-MA', {
                        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
                      })}
                    </span>
                  </div>
                )}
                {(() => {
                  const data = latestJob.result_data as Record<string, unknown>;
                  const fields = [
                    { key: 'court', label: 'المحكمة' },
                    { key: 'judge', label: 'القاضي' },
                    { key: 'department', label: 'الشعبة' },
                    { key: 'case_type', label: 'نوع القضية' },
                  ];
                  const rendered = fields.filter(f => data[f.key]);
                  if (rendered.length === 0) return null;
                  return (
                    <div className="grid grid-cols-2 gap-1 text-[10px]">
                      {rendered.map(f => (
                        <div key={f.key}>
                          <span className="text-muted-foreground">{f.label}: </span>
                          <span className="font-medium">{data[f.key] as string}</span>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Auto-sync message when pending/scraping */}
      {latestJob && (latestJob.status === 'pending' || latestJob.status === 'scraping') && (
        <div className="flex items-center gap-2 p-2.5 rounded-md bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 animate-pulse">
          <Loader2 className="h-4 w-4 text-blue-600 animate-spin shrink-0" />
          <div className="text-xs">
            <p className="font-medium text-blue-700 dark:text-blue-400">
              {latestJob.status === 'pending' ? 'سيتم الجلب تلقائياً...' : 'جاري جلب البيانات من بوابة محاكم...'}
            </p>
            <p className="text-muted-foreground text-[10px]">
              سيتم إدراج الجلسات والبيانات تلقائياً عند الانتهاء
            </p>
          </div>
        </div>
      )}

      {/* Success notification after completion */}
      {latestJob && latestJob.status === 'completed' && latestJob.completed_at && 
        (Date.now() - new Date(latestJob.completed_at).getTime() < 60000) && (
        <div className="flex items-center gap-2 p-2.5 rounded-md bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
          <div className="text-xs">
            <p className="font-medium text-emerald-700 dark:text-emerald-400">
              ✓ تم جلب البيانات بنجاح من بوابة محاكم
            </p>
            {latestJob.next_session_date && (
              <p className="text-muted-foreground text-[10px]">
                الجلسة المقبلة: {new Date(latestJob.next_session_date + 'T00:00:00').toLocaleDateString('ar-MA', { year: 'numeric', month: 'long', day: 'numeric' })}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Failure notification */}
      {latestJob && latestJob.status === 'failed' && latestJob.completed_at &&
        (Date.now() - new Date(latestJob.completed_at).getTime() < 60000) && (
        <div className="flex items-center gap-2 p-2.5 rounded-md bg-destructive/10 border border-destructive/30">
          <XCircle className="h-4 w-4 text-destructive shrink-0" />
          <p className="text-xs font-medium text-destructive">
            فشل الجلب: {latestJob.error_message || 'خطأ غير معروف'}
          </p>
        </div>
      )}

      <p className="text-[10px] text-muted-foreground text-center">
        رقم الملف: <span dir="ltr" className="font-mono font-bold">{caseNumber}</span>
      </p>
    </div>
  );
};
