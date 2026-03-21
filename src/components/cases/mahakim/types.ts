/**
 * أنواع البيانات المشتركة لمكونات مزامنة بوابة محاكم
 * Shared types for Mahakim sync UI components
 */

import type { SyncJob, ScrapeProvider } from '@/hooks/useMahakimSync';

/** Re-export for convenience */
export type { ScrapeProvider };

/** الخصائص المشتركة لمكون المزامنة الرئيسي */
export interface MahakimSyncStatusProps {
  /** رقم الملف بصيغة رقم/رمز/سنة */
  caseNumber: string;
  /** اسم المحكمة المسجل في الملف */
  courtName?: string | null;
  /** مستوى المحكمة (ابتدائية/استئناف) */
  courtLevel?: string | null;
  /** آخر مهمة مزامنة */
  latestJob: SyncJob | null;
  /** هل المزامنة جارية حالياً */
  syncing: boolean;
  /** بدء المزامنة مع تحديد المحكمة والمزود */
  onSync: (appealCourt: string, firstInstanceCourt?: string, provider?: ScrapeProvider) => void;
  /** فتح بوابة محاكم يدوياً */
  onOpenPortal: () => void;
}

/** إعدادات حالة المزامنة للعرض */
export interface StatusConfig {
  label: string;
  icon: React.ReactNode;
  color: string;
}

/** بيانات المزود لعرض الخيارات */
export interface ProviderOption {
  label: string;
  desc: string;
}
