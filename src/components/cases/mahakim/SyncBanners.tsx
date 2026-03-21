/**
 * إشعارات المزامنة — مبسطة للوضع "الصندوق الأسود"
 * Simplified sync banners for black-box mode
 * 
 * تُعرض فقط كـ toast notifications عبر sonner
 * لم تعد تُعرض كأشرطة داخل الصفحة
 */

import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import type { SyncJob } from '@/hooks/useMahakimSync';

interface SyncBannersProps {
  job: SyncJob | null;
}

/**
 * مكون صامت — يراقب تغييرات حالة المزامنة
 * ويُطلق toast notifications تلقائياً
 */
export const SyncBanners = ({ job }: SyncBannersProps) => {
  const lastNotifiedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!job) return;

    // مفتاح فريد لمنع تكرار الإشعار
    const key = `${job.id}-${job.status}`;
    if (lastNotifiedRef.current === key) return;

    if (job.status === 'completed' && job.completed_at) {
      const age = Date.now() - new Date(job.completed_at).getTime();
      if (age < 30_000) {
        lastNotifiedRef.current = key;
        const nextDate = job.next_session_date
          ? ` — الجلسة المقبلة: ${new Date(job.next_session_date + 'T00:00:00').toLocaleDateString('ar-MA', { month: 'long', day: 'numeric' })}`
          : '';
        toast.success(`تم جلب بيانات الملف بنجاح ✅${nextDate}`, {
          duration: 6000,
        });
      }
    }

    if (job.status === 'failed' && job.completed_at) {
      const age = Date.now() - new Date(job.completed_at).getTime();
      if (age < 30_000) {
        lastNotifiedRef.current = key;
        toast.error('تعذر جلب البيانات تلقائياً — جرّب المزامنة اليدوية', {
          duration: 8000,
        });
      }
    }
  }, [job?.id, job?.status, job?.completed_at]);

  // لا يُعرض أي شيء في DOM
  return null;
};
