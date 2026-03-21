/**
 * نافذة تأكيد المزامنة مع بوابة محاكم
 * Confirmation dialog for starting a Mahakim portal sync
 * - إدخال رقم الملف
 * - تحديد المحكمة تلقائياً
 * - اختيار مزود الجلب
 */

import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { RefreshCw, CheckCircle2, AlertTriangle, Info } from 'lucide-react';
import { resolvePortalCourts } from '@/lib/court-mapping';
import { CaseNumberInput } from '@/components/cases/CaseNumberInput';
import { ProviderSelector } from './ProviderSelector';
import type { ScrapeProvider } from './types';
import type { SyncJob } from '@/hooks/useMahakimSync';

interface SyncDialogProps {
  /** هل النافذة مفتوحة */
  open: boolean;
  /** تغيير حالة الفتح/الإغلاق */
  onOpenChange: (open: boolean) => void;
  /** رقم الملف الأولي */
  initialCaseNumber: string;
  /** اسم المحكمة لتحديد المحكمة تلقائياً */
  courtName?: string | null;
  /** آخر مهمة للتحقق من الفشل السابق */
  latestJob: SyncJob | null;
  /** تأكيد بدء المزامنة */
  onConfirm: (appealCourt: string, firstInstanceCourt?: string, provider?: ScrapeProvider) => void;
}

export const SyncDialog = ({
  open,
  onOpenChange,
  initialCaseNumber,
  courtName,
  latestJob,
  onConfirm,
}: SyncDialogProps) => {
  const [caseNumRaw, setCaseNumRaw] = useState(initialCaseNumber);
  const [provider, setProvider] = useState<ScrapeProvider>('auto');

  // ── تحديد المزود المقترح بناءً على الفشل السابق ──
  const suggestProvider = () => {
    if (latestJob?.status === 'failed') {
      const lastProv = (latestJob.result_data as any)?._provider;
      if (lastProv === 'firecrawl') return 'scrapingbee';
      if (lastProv === 'scrapingbee') return 'firecrawl';
    }
    return 'auto';
  };

  // ── تهيئة الحقول عند فتح النافذة ──
  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen) {
      setCaseNumRaw(initialCaseNumber || '');
      setProvider(suggestProvider());
    }
    onOpenChange(isOpen);
  };

  // ── استخراج رمز الملف وتحديد المحكمة ──
  const parsedCode = useMemo(() => (caseNumRaw.split('/')[1] || ''), [caseNumRaw]);
  const resolved = useMemo(() => resolvePortalCourts(courtName, parsedCode), [courtName, parsedCode]);

  // ── التحقق من صحة النموذج ──
  const isFormValid = useMemo(() => {
    const parts = caseNumRaw.split('/');
    return parts.length === 3 &&
      parts[0].trim() !== '' &&
      parts[1].trim().length === 4 && /^\d{4}$/.test(parts[1].trim()) &&
      parts[2].trim().length === 4 && /^\d{4}$/.test(parts[2].trim()) &&
      resolved.appealPortalLabel !== null;
  }, [caseNumRaw, resolved.appealPortalLabel]);

  const handleConfirm = () => {
    if (!isFormValid || !resolved.appealPortalLabel) return;
    onConfirm(resolved.appealPortalLabel, resolved.primaryPortalLabel || undefined, provider);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle>مزامنة الملف من بوابة محاكم</DialogTitle>
          <DialogDescription>تأكد من رقم الملف قبل المزامنة</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* ── إدخال رقم الملف ── */}
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

          {/* ── حالة تحديد المحكمة التلقائي ── */}
          <CourtResolutionStatus
            resolved={resolved}
            courtName={courtName}
          />

          {/* ── اختيار المزود ── */}
          <ProviderSelector
            value={provider}
            onChange={setProvider}
            lastAttemptFailed={latestJob?.status === 'failed'}
          />
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>إلغاء</Button>
          <Button onClick={handleConfirm} disabled={!isFormValid} className="gap-2">
            <RefreshCw className="h-4 w-4" />
            بدء المزامنة
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

/* ── مكون فرعي: حالة تحديد المحكمة ── */
interface CourtResolutionStatusProps {
  resolved: ReturnType<typeof resolvePortalCourts>;
  courtName?: string | null;
}

const CourtResolutionStatus = ({ resolved, courtName }: CourtResolutionStatusProps) => {
  // ✅ تم التعرف على المحكمة
  if (resolved.appealPortalLabel) {
    return (
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
    );
  }

  // ⚠ المحكمة مسجلة لكن غير معروفة
  if (courtName) {
    return (
      <div className="flex items-start gap-2 p-2.5 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
        <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
        <div className="text-xs">
          <p className="font-medium text-amber-700 dark:text-amber-400">لم يتم التعرف على المحكمة</p>
          <p className="text-muted-foreground">
            المحكمة المسجلة "{courtName}" غير موجودة في خريطة المحاكم.
          </p>
        </div>
      </div>
    );
  }

  // ℹ لا توجد محكمة
  return (
    <div className="flex items-start gap-2 p-2.5 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
      <Info className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
      <p className="text-xs text-amber-700 dark:text-amber-400">
        يرجى تحديد المحكمة في بيانات الملف أولاً.
      </p>
    </div>
  );
};
