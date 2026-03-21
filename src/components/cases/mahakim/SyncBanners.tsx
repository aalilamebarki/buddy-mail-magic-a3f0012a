/**
 * شريط الحالة المؤقت — يظهر أثناء/بعد المزامنة لمدة 60 ثانية
 * Temporary status banners: progress, success, and failure notifications
 */

import { Loader2, CheckCircle2, XCircle } from 'lucide-react';
import type { SyncJob } from '@/hooks/useMahakimSync';

interface SyncBannersProps {
  job: SyncJob | null;
}

/** هل أكملت المهمة خلال آخر 60 ثانية */
const isRecent = (completedAt: string | null) =>
  completedAt ? Date.now() - new Date(completedAt).getTime() < 60000 : false;

export const SyncBanners = ({ job }: SyncBannersProps) => {
  if (!job) return null;

  return (
    <>
      {/* ── جاري الجلب ── */}
      {(job.status === 'pending' || job.status === 'scraping') && (
        <div className="flex items-center gap-2 p-2.5 rounded-md bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 animate-pulse">
          <Loader2 className="h-4 w-4 text-blue-600 animate-spin shrink-0" />
          <div className="text-xs">
            <p className="font-medium text-blue-700 dark:text-blue-400">
              {job.status === 'pending' ? 'سيتم الجلب تلقائياً...' : 'جاري جلب البيانات من بوابة محاكم...'}
            </p>
            <p className="text-muted-foreground text-[10px]">
              سيتم إدراج الجلسات والبيانات تلقائياً عند الانتهاء
            </p>
          </div>
        </div>
      )}

      {/* ── تم بنجاح (يختفي بعد 60 ثانية) ── */}
      {job.status === 'completed' && isRecent(job.completed_at) && (
        <div className="flex items-center gap-2 p-2.5 rounded-md bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
          <div className="text-xs">
            <p className="font-medium text-emerald-700 dark:text-emerald-400">
              ✓ تم جلب البيانات بنجاح من بوابة محاكم
            </p>
            {job.next_session_date && (
              <p className="text-muted-foreground text-[10px]">
                الجلسة المقبلة: {new Date(job.next_session_date + 'T00:00:00').toLocaleDateString('ar-MA', { year: 'numeric', month: 'long', day: 'numeric' })}
              </p>
            )}
          </div>
        </div>
      )}

      {/* ── فشل الجلب (يختفي بعد 60 ثانية) ── */}
      {job.status === 'failed' && isRecent(job.completed_at) && (
        <div className="flex items-start gap-2 p-2.5 rounded-md bg-destructive/10 border border-destructive/30">
          <XCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
          <div className="text-xs space-y-1">
            <p className="font-medium text-destructive">
              فشل الجلب: {job.error_message || 'خطأ غير معروف'}
            </p>
            <p className="text-muted-foreground text-[10px]">
              💡 يمكنك إعادة المحاولة بمزود مختلف أو فتح البوابة يدوياً
            </p>
          </div>
        </div>
      )}
    </>
  );
};
