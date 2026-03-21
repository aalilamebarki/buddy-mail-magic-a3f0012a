/**
 * مكون إشعارات فشل المزامنة الذكية
 * Smart Sync Failure Notifier — shows failures with actionable suggestions
 */

import { useState } from 'react';
import { AlertTriangle, RefreshCw, ExternalLink, X, ChevronDown, ChevronUp, Clock, ShieldAlert, WifiOff, FileQuestion } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { SyncFailure, SyncQueueState } from '@/hooks/useSyncQueue';
import { useNavigate } from 'react-router-dom';

interface SyncFailureNotifierProps {
  state: SyncQueueState;
  onRetry?: (caseId: string) => void;
  onDismiss?: () => void;
}

const ERROR_CONFIG: Record<SyncFailure['errorType'], {
  icon: typeof AlertTriangle;
  label: string;
  suggestion: string;
  color: string;
}> = {
  blocked: {
    icon: ShieldAlert,
    label: 'حظر مؤقت',
    suggestion: 'البوابة تمنع الوصول حالياً — ستتم إعادة المحاولة تلقائياً خلال 30 دقيقة',
    color: 'text-orange-600 dark:text-orange-400',
  },
  timeout: {
    icon: Clock,
    label: 'انتهت المهلة',
    suggestion: 'البوابة بطيئة — جرّب إعادة المزامنة في وقت أقل ازدحاماً (الصباح الباكر)',
    color: 'text-amber-600 dark:text-amber-400',
  },
  empty: {
    icon: FileQuestion,
    label: 'لا توجد إجراءات',
    suggestion: 'الملف قد لا يكون مسجلاً بعد في البوابة — تحقق من رقم الملف أو انتظر تسجيله',
    color: 'text-blue-600 dark:text-blue-400',
  },
  network: {
    icon: WifiOff,
    label: 'خطأ شبكة',
    suggestion: 'تحقق من اتصال الإنترنت وأعد المحاولة',
    color: 'text-red-600 dark:text-red-400',
  },
  unknown: {
    icon: AlertTriangle,
    label: 'خطأ غير محدد',
    suggestion: 'حدث خطأ غير متوقع — ستتم إعادة المحاولة تلقائياً',
    color: 'text-muted-foreground',
  },
};

export const SyncFailureNotifier = ({ state, onDismiss }: SyncFailureNotifierProps) => {
  const [expanded, setExpanded] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const navigate = useNavigate();

  const { failures, isRunning, successCount } = state;

  if (dismissed || (failures.length === 0 && (isRunning || successCount === 0))) return null;

  // ملخص بعد الانتهاء
  const isDone = !isRunning && state.completedCount >= state.totalQueued && state.totalQueued > 0;

  if (!isDone) return null;

  // كل شيء نجح
  if (failures.length === 0 && successCount > 0) {
    return (
      <div className="mx-4 mb-3 flex items-center gap-2 p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-xs">
        <span className="text-emerald-600">✅</span>
        <span className="text-emerald-700 dark:text-emerald-400 flex-1">
          تمت مزامنة {successCount} ملف بنجاح
        </span>
        <Button
          variant="ghost"
          size="sm"
          className="h-5 w-5 p-0"
          onClick={() => { setDismissed(true); onDismiss?.(); }}
        >
          <X className="h-3 w-3" />
        </Button>
      </div>
    );
  }

  // تجميع الأخطاء حسب النوع
  const grouped = failures.reduce<Record<string, SyncFailure[]>>((acc, f) => {
    (acc[f.errorType] ??= []).push(f);
    return acc;
  }, {});

  return (
    <div className="mx-4 mb-3 rounded-lg border border-destructive/20 bg-destructive/5 overflow-hidden">
      {/* رأس الإشعار */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 p-2.5 text-right hover:bg-destructive/10 transition-colors"
      >
        <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-destructive">
            {failures.length} ملف لم تتم مزامنته
            {successCount > 0 && (
              <span className="text-emerald-600 font-normal mr-1">
                ({successCount} نجح ✓)
              </span>
            )}
          </p>
        </div>
        {expanded ? <ChevronUp className="h-3 w-3 shrink-0 text-muted-foreground" /> : <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" />}
        <Button
          variant="ghost"
          size="sm"
          className="h-5 w-5 p-0 shrink-0"
          onClick={(e) => { e.stopPropagation(); setDismissed(true); onDismiss?.(); }}
        >
          <X className="h-3 w-3" />
        </Button>
      </button>

      {/* تفاصيل الأخطاء */}
      {expanded && (
        <div className="border-t border-destructive/10 p-2.5 space-y-3">
          {Object.entries(grouped).map(([type, items]) => {
            const config = ERROR_CONFIG[type as SyncFailure['errorType']];
            const Icon = config.icon;

            return (
              <div key={type} className="space-y-1.5">
                {/* نوع الخطأ + اقتراح */}
                <div className="flex items-start gap-1.5">
                  <Icon className={cn("h-3.5 w-3.5 mt-0.5 shrink-0", config.color)} />
                  <div>
                    <p className={cn("text-[11px] font-medium", config.color)}>
                      {config.label} ({items.length})
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      💡 {config.suggestion}
                    </p>
                  </div>
                </div>

                {/* قائمة الملفات المتأثرة */}
                <div className="mr-5 space-y-1">
                  {items.slice(0, 5).map(f => (
                    <button
                      key={f.caseId}
                      onClick={() => navigate(`/dashboard/cases/${f.caseId}`)}
                      className="w-full text-right flex items-center gap-1.5 px-2 py-1 rounded text-[10px] hover:bg-muted/50 transition-colors"
                    >
                      <span className="text-muted-foreground truncate flex-1">
                        {f.caseTitle}
                      </span>
                      {f.caseNumber && (
                        <span className="text-[9px] text-muted-foreground/70 font-mono shrink-0" dir="ltr">
                          {f.caseNumber}
                        </span>
                      )}
                    </button>
                  ))}
                  {items.length > 5 && (
                    <p className="text-[10px] text-muted-foreground/60 px-2">
                      +{items.length - 5} ملفات أخرى...
                    </p>
                  )}
                </div>
              </div>
            );
          })}

          {/* إجراءات سريعة */}
          <div className="flex gap-2 pt-1 border-t border-destructive/10">
            <Button
              variant="outline"
              size="sm"
              className="flex-1 h-7 text-[10px] gap-1"
              onClick={() => {
                setDismissed(true);
                // ستتم إعادة المحاولة تلقائياً في الدورة القادمة
              }}
            >
              <RefreshCw className="h-3 w-3" />
              إعادة المحاولة لاحقاً
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="flex-1 h-7 text-[10px] gap-1"
              onClick={() => {
                window.open('https://www.mahakim.ma/#/suivi/dossier-suivi', '_blank');
              }}
            >
              <ExternalLink className="h-3 w-3" />
              فتح البوابة يدوياً
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
