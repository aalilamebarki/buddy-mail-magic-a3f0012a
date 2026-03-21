/**
 * بطاقة حالة آخر مزامنة — تعرض النتائج والبيانات المستخرجة
 * Status card showing the latest sync job result with extracted data
 */

import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { formatDistanceToNow } from 'date-fns';
import { ar } from 'date-fns/locale';
import { STATUS_CONFIG } from './constants';
import type { SyncJob } from '@/hooks/useMahakimSync';

interface SyncStatusCardProps {
  job: SyncJob;
}

/** الحقول المعروضة عند نجاح الجلب */
const RESULT_FIELDS = [
  { key: 'court', label: 'المحكمة' },
  { key: 'judge', label: 'القاضي' },
  { key: 'department', label: 'الشعبة' },
  { key: 'case_type', label: 'نوع القضية' },
] as const;

export const SyncStatusCard = ({ job }: SyncStatusCardProps) => {
  const status = STATUS_CONFIG[job.status] || STATUS_CONFIG.pending;
  const lastProvider = (job.result_data as Record<string, unknown>)?._provider as string | undefined;

  return (
    <Card className="border-dashed">
      <CardContent className="p-3 space-y-2">
        {/* ── سطر الحالة والوقت ── */}
        <div className="flex items-center justify-between">
          <div className={`flex items-center gap-1.5 text-xs font-medium ${status.color}`}>
            {status.icon}
            {status.label}
            {lastProvider && job.status === 'completed' && (
              <Badge variant="outline" className="text-[9px] px-1.5 py-0 font-normal">
                {lastProvider === 'apify' ? 'Apify' : lastProvider === 'firecrawl' ? 'Firecrawl' : lastProvider === 'scrapingbee' ? 'ScrapingBee' : lastProvider === 'clipboard' ? 'لصق يدوي' : lastProvider}
              </Badge>
            )}
          </div>
          {job.completed_at && (
            <span className="text-[10px] text-muted-foreground">
              {formatDistanceToNow(new Date(job.completed_at), { addSuffix: true, locale: ar })}
            </span>
          )}
        </div>

        {/* ── إعادة المحاولة ── */}
        {job.status === 'pending' && job.retry_count > 0 && (
          <p className="text-xs text-amber-600 bg-amber-50 dark:bg-amber-950/30 rounded p-2">
            إعادة المحاولة {job.retry_count}/{job.max_retries}
          </p>
        )}

        {/* ── رسالة الخطأ مع اقتراحات ── */}
        {job.status === 'failed' && job.error_message && (
          <ErrorDetails message={job.error_message} />
        )}

        {/* ── نتائج المزامنة الناجحة ── */}
        {job.status === 'completed' && job.result_data && (
          <SuccessDetails job={job} />
        )}
      </CardContent>
    </Card>
  );
};

/* ── تفاصيل الخطأ مع اقتراحات ذكية ── */
const ErrorDetails = ({ message }: { message: string }) => (
  <div className="text-xs bg-destructive/10 rounded p-2.5 space-y-1.5">
    <p className="text-destructive font-medium">{message}</p>
    <div className="text-muted-foreground text-[10px] space-y-0.5">
      {message.includes('رصيد') && <p>💳 قم بإعادة شحن حسابك أو اختر مزوداً آخر من القائمة</p>}
      {message.includes('مهلة') && <p>⏱ البوابة قد تكون بطيئة — أعد المحاولة بعد دقيقة</p>}
      {message.includes('مفتاح') && <p>🔑 تواصل مع المسؤول لتحديث مفتاح الخدمة</p>}
      {!message.includes('رصيد') && !message.includes('مهلة') && !message.includes('مفتاح') && (
        <p>💡 جرّب تغيير طريقة الجلب أو تحقق من رقم الملف</p>
      )}
    </div>
  </div>
);

/* ── تفاصيل النتائج الناجحة ── */
const SuccessDetails = ({ job }: { job: SyncJob }) => {
  const data = job.result_data as Record<string, unknown>;
  const rendered = RESULT_FIELDS.filter(f => data[f.key]);

  return (
    <div className="space-y-1.5">
      {/* الجلسة المقبلة */}
      {job.next_session_date && (
        <div className="flex items-center gap-2 bg-emerald-50 dark:bg-emerald-950/30 rounded p-2">
          <Badge variant="outline" className="text-emerald-700 border-emerald-300 text-[10px]">
            الجلسة المقبلة
          </Badge>
          <span className="text-xs font-semibold" dir="ltr">
            {new Date(job.next_session_date + 'T00:00:00').toLocaleDateString('ar-MA', {
              weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
            })}
          </span>
        </div>
      )}

      {/* حقول البيانات */}
      {rendered.length > 0 && (
        <div className="grid grid-cols-2 gap-1 text-[10px]">
          {rendered.map(f => (
            <div key={f.key}>
              <span className="text-muted-foreground">{f.label}: </span>
              <span className="font-medium">{data[f.key] as string}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
