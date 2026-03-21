/**
 * مدير المزامنة — معطّل حالياً (تم الإبقاء فقط على Bookmarklet)
 * Sync Queue Manager — disabled (only bookmarklet is active)
 */

export interface SyncFailure {
  caseId: string;
  caseNumber: string;
  caseTitle: string;
  errorMessage: string;
  errorType: 'blocked' | 'timeout' | 'empty' | 'network' | 'unknown';
  timestamp: Date;
}

export interface SyncQueueState {
  totalQueued: number;
  completedCount: number;
  isRunning: boolean;
  currentBatch: string[];
  lastError: string | null;
  failures: SyncFailure[];
  successCount: number;
}

/** Hook معطّل — لا يقوم بأي مزامنة تلقائية */
export const useSyncQueue = (): SyncQueueState => {
  return {
    totalQueued: 0,
    completedCount: 0,
    isRunning: false,
    currentBatch: [],
    lastError: null,
    failures: [],
    successCount: 0,
  };
};
