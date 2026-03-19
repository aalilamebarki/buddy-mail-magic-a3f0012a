import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, RefreshCw, ExternalLink, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { SyncJob } from '@/hooks/useMahakimSync';
import { formatDistanceToNow } from 'date-fns';
import { ar } from 'date-fns/locale';

interface MahakimSyncStatusProps {
  caseNumber: string;
  latestJob: SyncJob | null;
  syncing: boolean;
  onSync: () => void;
  onOpenPortal: () => void;
}

const statusConfig: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  pending: { label: 'في الانتظار', icon: <Clock className="h-3.5 w-3.5" />, color: 'text-amber-600' },
  scraping: { label: 'جاري الجلب...', icon: <Loader2 className="h-3.5 w-3.5 animate-spin" />, color: 'text-blue-600' },
  completed: { label: 'تم بنجاح', icon: <CheckCircle2 className="h-3.5 w-3.5" />, color: 'text-emerald-600' },
  failed: { label: 'فشل', icon: <XCircle className="h-3.5 w-3.5" />, color: 'text-destructive' },
};

export const MahakimSyncStatus = ({ caseNumber, latestJob, syncing, onSync, onOpenPortal }: MahakimSyncStatusProps) => {
  const status = latestJob ? statusConfig[latestJob.status] || statusConfig.pending : null;
  const isActive = syncing || latestJob?.status === 'pending' || latestJob?.status === 'scraping';

  return (
    <div className="space-y-2">
      {/* Sync Button */}
      <div className="flex gap-2">
        <Button
          variant="default"
          size="sm"
          className="flex-1 gap-2"
          disabled={isActive}
          onClick={onSync}
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

      {/* Status indicator */}
      {latestJob && status && (
        <Card className="border-dashed">
          <CardContent className="p-3 space-y-2">
            <div className="flex items-center justify-between">
              <div className={`flex items-center gap-1.5 text-xs font-medium ${status.color}`}>
                {status.icon}
                {status.label}
              </div>
              {latestJob.completed_at && (
                <span className="text-[10px] text-muted-foreground">
                  {formatDistanceToNow(new Date(latestJob.completed_at), { addSuffix: true, locale: ar })}
                </span>
              )}
            </div>

            {/* Retry info */}
            {latestJob.status === 'pending' && latestJob.retry_count > 0 && (
              <p className="text-xs text-amber-600 bg-amber-50 dark:bg-amber-950/30 rounded p-2">
                إعادة المحاولة {latestJob.retry_count}/{latestJob.max_retries} — جاري المحاولة مجدداً...
              </p>
            )}

            {/* Error message */}
            {latestJob.status === 'failed' && latestJob.error_message && (
              <p className="text-xs text-destructive bg-destructive/10 rounded p-2">
                {latestJob.error_message}
                {latestJob.retry_count > 0 && ` (بعد ${latestJob.retry_count + 1} محاولات)`}
              </p>
            )}

            {/* Success data preview */}
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
                {/* Key fields from result */}
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

      <p className="text-[10px] text-muted-foreground text-center">
        رقم الملف: <span dir="ltr" className="font-mono font-bold">{caseNumber}</span>
      </p>
    </div>
  );
};
