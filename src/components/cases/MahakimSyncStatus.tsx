/**
 * مكون حالة المزامنة — وضع "الصندوق الأسود"
 * Black Box Sync Status — يعرض حالة المزامنة التلقائية بشكل مبسط واحترافي
 * 
 * ● لا أزرار تقنية — المزامنة تلقائية 100%
 * ● يظهر فقط شريط حالة دقيق أثناء الجلب
 * ● عند النجاح: يعرض ملخصاً سريعاً يختفي تلقائياً
 * ● عند الفشل: يقترح "المزامنة اليدوية" كبديل
 * ● رابط خفي لفتح البوابة يدوياً
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Loader2, CheckCircle2, XCircle, RefreshCw,
  ExternalLink, ClipboardPaste, ChevronDown, ChevronUp,
} from 'lucide-react';
import { SmartSyncAssistant } from './mahakim/SmartSyncAssistant';
import { SyncDialog } from './mahakim/SyncDialog';
import type { MahakimSyncStatusProps } from './mahakim/types';
import type { SyncJob } from '@/hooks/useMahakimSync';
import { formatDistanceToNow } from 'date-fns';
import { ar } from 'date-fns/locale';
import { cn } from '@/lib/utils';

export type { MahakimSyncStatusProps } from './mahakim/types';

/** هل أكملت المهمة خلال آخر 90 ثانية */
const isRecent = (ts: string | null) =>
  ts ? Date.now() - new Date(ts).getTime() < 90_000 : false;

export const MahakimSyncStatus = ({
  caseNumber,
  courtName,
  latestJob,
  syncing,
  onSync,
  onOpenPortal,
  caseId,
  onSyncComplete,
}: MahakimSyncStatusProps) => {
  const [expanded, setExpanded] = useState(false);
  const [smartSyncOpen, setSmartSyncOpen] = useState(false);
  const [syncDialogOpen, setSyncDialogOpen] = useState(false);

  const isActive = syncing || latestJob?.status === 'pending' || latestJob?.status === 'scraping';
  const isCompleted = latestJob?.status === 'completed';
  const isFailed = latestJob?.status === 'failed';
  const showRecentSuccess = isCompleted && isRecent(latestJob?.completed_at ?? null);
  const showRecentFailure = isFailed && isRecent(latestJob?.completed_at ?? null);

  return (
    <div className="space-y-2">
      {/* ── شريط المزامنة الجارية (متحرك) ── */}
      {isActive && (
        <div className="flex items-center gap-2.5 p-3 rounded-lg bg-primary/5 border border-primary/20 animate-pulse">
          <Loader2 className="h-4 w-4 text-primary animate-spin shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-primary">
              جاري جلب بيانات الملف تلقائياً...
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              ستظهر النتائج خلال 60-90 ثانية — يمكنك متابعة عملك
            </p>
          </div>
        </div>
      )}

      {/* ── نجاح حديث ── */}
      {showRecentSuccess && (
        <div className="flex items-center gap-2.5 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
              تم جلب بيانات الملف بنجاح ✅
            </p>
            <SyncResultSummary job={latestJob!} />
          </div>
        </div>
      )}

      {/* ── فشل حديث — يقترح البديل ── */}
      {showRecentFailure && (
        <div className="space-y-2">
          <div className="flex items-start gap-2.5 p-3 rounded-lg bg-destructive/5 border border-destructive/20">
            <XCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-destructive">
                تعذر جلب البيانات تلقائياً
              </p>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                {getUserFriendlyError(latestJob?.error_message)}
              </p>
            </div>
          </div>
          {/* زر المزامنة اليدوية كبديل */}
          <Button
            variant="outline"
            size="sm"
            className="w-full gap-2 text-xs"
            onClick={() => setSmartSyncOpen(true)}
          >
            <ClipboardPaste className="h-3.5 w-3.5" />
            مزامنة يدوية (نسخ ولصق — مجانية)
          </Button>
        </div>
      )}

      {/* ── حالة آخر مزامنة ناجحة (مطوية) ── */}
      {isCompleted && !showRecentSuccess && !isActive && (
        <CompletedSyncSummary job={latestJob!} expanded={expanded} onToggle={() => setExpanded(!expanded)} />
      )}

      {/* ── أدوات خفية (للمستخدم المتقدم) ── */}
      {!isActive && !showRecentSuccess && !showRecentFailure && (
        <div className="flex items-center gap-1.5 justify-center">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-[10px] text-muted-foreground hover:text-foreground gap-1"
            onClick={() => setSyncDialogOpen(true)}
          >
            <RefreshCw className="h-3 w-3" />
            إعادة المزامنة
          </Button>
          <span className="text-muted-foreground/30">|</span>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-[10px] text-muted-foreground hover:text-foreground gap-1"
            onClick={onOpenPortal}
          >
            <ExternalLink className="h-3 w-3" />
            فتح البوابة
          </Button>
          <span className="text-muted-foreground/30">|</span>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-[10px] text-muted-foreground hover:text-foreground gap-1"
            onClick={() => setSmartSyncOpen(true)}
          >
            <ClipboardPaste className="h-3 w-3" />
            لصق يدوي
          </Button>
        </div>
      )}

      {/* ── النوافذ ── */}
      <SyncDialog
        open={syncDialogOpen}
        onOpenChange={setSyncDialogOpen}
        initialCaseNumber={caseNumber}
        courtName={courtName}
        latestJob={latestJob}
        onConfirm={onSync}
      />

      {caseId && (
        <SmartSyncAssistant
          open={smartSyncOpen}
          onOpenChange={setSmartSyncOpen}
          caseId={caseId}
          caseNumber={caseNumber}
          onSyncComplete={onSyncComplete || (() => {})}
        />
      )}
    </div>
  );
};

/* ── ملخص نتائج المزامنة الناجحة ── */
const SyncResultSummary = ({ job }: { job: SyncJob }) => {
  const data = job.result_data as Record<string, unknown> | null;
  if (!data) return null;

  const items: string[] = [];
  if (data.judge) items.push(`القاضي: ${data.judge}`);
  if (data.department) items.push(`الشعبة: ${data.department}`);

  return (
    <div className="mt-1 space-y-0.5">
      {job.next_session_date && (
        <p className="text-[10px] text-emerald-600 dark:text-emerald-400">
          📅 الجلسة المقبلة: {new Date(job.next_session_date + 'T00:00:00').toLocaleDateString('ar-MA', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
          })}
        </p>
      )}
      {items.length > 0 && (
        <p className="text-[10px] text-muted-foreground">{items.join(' · ')}</p>
      )}
    </div>
  );
};

/* ── ملخص آخر مزامنة مطوي ── */
const CompletedSyncSummary = ({ job, expanded, onToggle }: { job: SyncJob; expanded: boolean; onToggle: () => void }) => {
  const data = job.result_data as Record<string, unknown> | null;

  return (
    <button
      onClick={onToggle}
      className={cn(
        "w-full flex items-center gap-2 p-2 rounded-md text-right transition-colors",
        "hover:bg-muted/50 text-muted-foreground"
      )}
    >
      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
      <span className="text-[10px] flex-1 truncate">
        آخر مزامنة: {job.completed_at ? formatDistanceToNow(new Date(job.completed_at), { addSuffix: true, locale: ar }) : '—'}
        {job.next_session_date && ` · الجلسة: ${new Date(job.next_session_date + 'T00:00:00').toLocaleDateString('ar-MA', { month: 'short', day: 'numeric' })}`}
      </span>
      {expanded ? <ChevronUp className="h-3 w-3 shrink-0" /> : <ChevronDown className="h-3 w-3 shrink-0" />}

      {expanded && data && (
        <div className="w-full pt-1.5 mt-1.5 border-t text-[10px] space-y-0.5" onClick={e => e.stopPropagation()}>
          {data.court && <p>🏛️ {data.court as string}</p>}
          {data.judge && <p>⚖️ {data.judge as string}</p>}
          {data.department && <p>📋 {data.department as string}</p>}
        </div>
      )}
    </button>
  );
};

/* ── تحويل رسائل الخطأ التقنية لرسائل مفهومة ── */
function getUserFriendlyError(msg?: string | null): string {
  if (!msg) return 'يمكنك استخدام المزامنة اليدوية بالنسخ واللصق كبديل';
  if (msg.includes('رصيد') || msg.includes('402')) return 'مشكلة في خدمة الجلب — استخدم المزامنة اليدوية كبديل';
  if (msg.includes('مهلة') || msg.includes('timeout')) return 'البوابة بطيئة — أعد المحاولة لاحقاً أو استخدم المزامنة اليدوية';
  if (msg.includes('حظر') || msg.includes('blocked')) return 'البوابة تمنع الوصول — استخدم المزامنة اليدوية';
  return 'يمكنك استخدام المزامنة اليدوية بالنسخ واللصق كبديل';
}
