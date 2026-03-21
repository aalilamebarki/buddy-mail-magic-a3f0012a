/**
 * بطاقة حالة المزامنة — مبسطة
 * Simplified sync status card (no longer needed as standalone)
 * 
 * المنطق انتقل بالكامل إلى MahakimSyncStatus.tsx
 * يُحتفظ بهذا الملف للتوافق فقط
 */

import type { SyncJob } from '@/hooks/useMahakimSync';

interface SyncStatusCardProps {
  job: SyncJob;
}

/**
 * @deprecated — المنطق انتقل إلى MahakimSyncStatus مباشرة
 */
export const SyncStatusCard = ({ job }: SyncStatusCardProps) => {
  // لا يُعرض شيء — المنطق في MahakimSyncStatus
  return null;
};
