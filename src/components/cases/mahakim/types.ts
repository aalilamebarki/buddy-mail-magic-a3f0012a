/**
 * أنواع البيانات المشتركة لمكونات مزامنة بوابة محاكم
 * Shared types for Mahakim sync UI components
 */

import type { SyncJob } from '@/hooks/useMahakimSync';

/** الخصائص المشتركة لمكون المزامنة الرئيسي */
export interface MahakimSyncStatusProps {
  caseNumber: string;
  courtName?: string | null;
  courtLevel?: string | null;
  latestJob: SyncJob | null;
  syncing: boolean;
  /** بدء المزامنة — المزود يُحدد تلقائياً */
  onSync: (appealCourt: string, firstInstanceCourt?: string) => void;
  onOpenPortal: () => void;
  /** معرف الملف — مطلوب لمساعد المزامنة الذكي */
  caseId?: string;
  /** يُستدعى بعد نجاح المزامنة الذكية */
  onSyncComplete?: () => void;
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
