/**
 * مؤشر المزامنة الحية — يظهر في شريط التنقل أثناء المزامنة التلقائية
 * Live Sync Indicator — shows in navbar during background sync
 */

import { RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { SyncQueueState } from '@/hooks/useSyncQueue';

interface SyncIndicatorProps {
  state: SyncQueueState;
  compact?: boolean;
}

export const SyncIndicator = ({ state, compact = false }: SyncIndicatorProps) => {
  if (!state.isRunning && state.totalQueued === 0) return null;

  const progress = state.totalQueued > 0
    ? Math.round((state.completedCount / state.totalQueued) * 100)
    : 0;

  const isDone = !state.isRunning && state.completedCount > 0 && state.completedCount >= state.totalQueued;

  if (isDone) return null;

  return (
    <div
      className={cn(
        "flex items-center gap-1.5 text-xs",
        compact ? "px-2 py-1" : "px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20"
      )}
    >
      <RefreshCw className={cn(
        "h-3 w-3 text-primary",
        state.isRunning && "animate-spin"
      )} />
      <span className="text-muted-foreground whitespace-nowrap">
        {state.isRunning ? (
          <>
            جاري مزامنة ملفاتك...
            <span className="font-medium text-primary mx-1" dir="ltr">
              [{state.completedCount}/{state.totalQueued}]
            </span>
          </>
        ) : (
          <span className="text-muted-foreground/70">فحص الملفات...</span>
        )}
      </span>
      {state.isRunning && state.totalQueued > 0 && (
        <div className="w-12 h-1 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
    </div>
  );
};
