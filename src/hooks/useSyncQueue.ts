/**
 * مدير المزامنة الذكي — معطّل مؤقتاً (يمكن إعادة تفعيله)
 * Smart Sync Queue Manager — temporarily disabled (can be re-enabled)
 * 
 * لإعادة التفعيل: غيّر SYNC_ENABLED إلى true
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

/** 🔴 مفتاح التعطيل — غيّره إلى true لإعادة تفعيل المزامنة التلقائية */
const SYNC_ENABLED = false;

/** تصنيف نوع الخطأ */
function classifyError(msg?: string | null): SyncFailure['errorType'] {
  if (!msg) return 'unknown';
  if (msg.includes('حظر') || msg.includes('blocked') || msg.includes('Imperva') || msg.includes('F5')) return 'blocked';
  if (msg.includes('مهلة') || msg.includes('timeout') || msg.includes('Timeout')) return 'timeout';
  if (msg.includes('لم يتم') || msg.includes('0 إجراء')) return 'empty';
  if (msg.includes('network') || msg.includes('fetch') || msg.includes('اتصال')) return 'network';
  return 'unknown';
}

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

const BATCH_SIZE = 3;
const STALE_HOURS = 24;
const CHECK_INTERVAL_MS = 60_000;

const DISABLED_STATE: SyncQueueState = {
  totalQueued: 0,
  completedCount: 0,
  isRunning: false,
  currentBatch: [],
  lastError: null,
  failures: [],
  successCount: 0,
};

export const useSyncQueue = (): SyncQueueState => {
  const { user } = useAuth();
  const [state, setState] = useState<SyncQueueState>(DISABLED_STATE);
  const queueRef = useRef<string[]>([]);
  const isProcessingRef = useRef(false);
  const mountedRef = useRef(true);

  // إذا كانت المزامنة معطّلة، نرجع الحالة الافتراضية مباشرة
  if (!SYNC_ENABLED) {
    return DISABLED_STATE;
  }

  // جلب الملفات القديمة (لم تتم مزامنتها خلال 24 ساعة)
  const fetchOutdatedCases = useCallback(async (): Promise<string[]> => {
    if (!user) return [];

    const staleThreshold = new Date(Date.now() - STALE_HOURS * 60 * 60 * 1000).toISOString();

    const { data } = await supabase
      .from('cases')
      .select('id, case_number, last_synced_at')
      .neq('case_number', '')
      .not('case_number', 'is', null)
      .eq('status', 'active')
      .or(`last_synced_at.is.null,last_synced_at.lt.${staleThreshold}`)
      .order('last_synced_at', { ascending: true, nullsFirst: true })
      .limit(100);

    if (!data) return [];

    const caseIds = data.map(c => c.id);
    if (caseIds.length === 0) return [];

    const { data: recentJobs } = await supabase
      .from('mahakim_sync_jobs')
      .select('case_id, status, created_at')
      .in('case_id', caseIds)
      .in('status', ['pending', 'scraping'])
      .gte('created_at', new Date(Date.now() - 10 * 60 * 1000).toISOString());

    const busyCaseIds = new Set((recentJobs || []).map(j => j.case_id));

    const { data: emptyResultJobs } = await supabase
      .from('mahakim_sync_jobs')
      .select('case_id, completed_at, result_data')
      .in('case_id', caseIds)
      .eq('status', 'completed')
      .gte('completed_at', new Date(Date.now() - 30 * 60 * 60 * 1000).toISOString());

    const cooldownCaseIds = new Set<string>();
    (emptyResultJobs || []).forEach(j => {
      const rd = j.result_data as Record<string, unknown> | null;
      const procedures = rd?.procedures;
      if (Array.isArray(procedures) && procedures.length === 0) {
        cooldownCaseIds.add(j.case_id);
      }
    });

    return caseIds.filter(id => !busyCaseIds.has(id) && !cooldownCaseIds.has(id));
  }, [user]);

  // فحص نتائج دفعة بعد المعالجة
  const checkBatchResults = useCallback(async (batchIds: string[]) => {
    if (!mountedRef.current) return;

    const { data: jobs } = await supabase
      .from('mahakim_sync_jobs')
      .select('case_id, status, error_message, result_data')
      .in('case_id', batchIds)
      .order('created_at', { ascending: false });

    if (!jobs) return;

    const latestByCaseId = new Map<string, typeof jobs[0]>();
    jobs.forEach(j => {
      if (!latestByCaseId.has(j.case_id)) latestByCaseId.set(j.case_id, j);
    });

    const newFailures: SyncFailure[] = [];
    let newSuccesses = 0;

    for (const [caseId, job] of latestByCaseId) {
      if (job.status === 'failed') {
        const { data: caseData } = await supabase
          .from('cases')
          .select('title, case_number')
          .eq('id', caseId)
          .single();

        newFailures.push({
          caseId,
          caseNumber: caseData?.case_number || '',
          caseTitle: caseData?.title || 'ملف غير معروف',
          errorMessage: job.error_message || 'خطأ غير محدد',
          errorType: classifyError(job.error_message),
          timestamp: new Date(),
        });
      } else if (job.status === 'completed') {
        const rd = job.result_data as Record<string, unknown> | null;
        const procedures = rd?.procedures;
        if (Array.isArray(procedures) && procedures.length === 0) {
          const { data: caseData } = await supabase
            .from('cases')
            .select('title, case_number')
            .eq('id', caseId)
            .single();

          newFailures.push({
            caseId,
            caseNumber: caseData?.case_number || '',
            caseTitle: caseData?.title || 'ملف غير معروف',
            errorMessage: 'لم يتم العثور على إجراءات — الملف قد لا يكون مسجلاً بعد في البوابة',
            errorType: 'empty',
            timestamp: new Date(),
          });
        } else {
          newSuccesses++;
        }
      }
    }

    if (mountedRef.current) {
      setState(s => ({
        ...s,
        failures: [...s.failures, ...newFailures],
        successCount: s.successCount + newSuccesses,
      }));
    }
  }, []);

  // معالجة دفعة واحدة
  const processBatch = useCallback(async (batchIds: string[]) => {
    if (!user || batchIds.length === 0) return;

    setState(s => ({ ...s, currentBatch: batchIds }));

    const promises = batchIds.map(async (caseId) => {
      try {
        const { data: caseData } = await supabase
          .from('cases')
          .select('case_number')
          .eq('id', caseId)
          .single();

        if (!caseData?.case_number) return;

        const jobId = crypto.randomUUID();

        await supabase.from('mahakim_sync_jobs').insert({
          id: jobId,
          case_id: caseId,
          user_id: user.id,
          case_number: caseData.case_number,
          status: 'pending',
        });

        await supabase.functions.invoke('fetch-dossier', {
          body: {
            action: 'submitSyncJob',
            jobId,
            caseId,
            userId: user.id,
            caseNumber: caseData.case_number,
          },
        });
      } catch (err) {
        console.error(`Sync queue error for case ${caseId}:`, err);
      }
    });

    await Promise.allSettled(promises);

    if (mountedRef.current) {
      setState(s => ({
        ...s,
        completedCount: s.completedCount + batchIds.length,
        currentBatch: [],
      }));
    }
  }, [user]);

  // تشغيل الطابور
  const processQueue = useCallback(async () => {
    if (isProcessingRef.current || !mountedRef.current) return;
    isProcessingRef.current = true;

    try {
      const outdated = await fetchOutdatedCases();
      if (outdated.length === 0) {
        setState(s => ({ ...s, isRunning: false, totalQueued: 0 }));
        isProcessingRef.current = false;
        return;
      }

      queueRef.current = outdated;
      setState(s => ({
        ...s,
        isRunning: true,
        totalQueued: outdated.length,
        completedCount: 0,
        lastError: null,
        failures: [],
        successCount: 0,
      }));

      for (let i = 0; i < outdated.length; i += BATCH_SIZE) {
        if (!mountedRef.current) break;

        const batch = outdated.slice(i, i + BATCH_SIZE);
        await processBatch(batch);

        await new Promise(r => setTimeout(r, 3000));
        await checkBatchResults(batch);

        if (i + BATCH_SIZE < outdated.length && mountedRef.current) {
          await new Promise(r => setTimeout(r, 10_000));
        }
      }

      setState(s => ({ ...s, isRunning: false, currentBatch: [] }));
    } catch (err) {
      console.error('Sync queue error:', err);
      setState(s => ({
        ...s,
        isRunning: false,
        lastError: 'خطأ في مدير المزامنة',
      }));
    } finally {
      isProcessingRef.current = false;
    }
  }, [fetchOutdatedCases, processBatch, checkBatchResults]);

  // بدء المزامنة عند فتح لوحة التحكم
  useEffect(() => {
    mountedRef.current = true;

    if (!user) return;

    const startTimeout = setTimeout(() => {
      processQueue();
    }, 5000);

    const interval = setInterval(() => {
      if (!isProcessingRef.current) {
        processQueue();
      }
    }, CHECK_INTERVAL_MS);

    return () => {
      mountedRef.current = false;
      clearTimeout(startTimeout);
      clearInterval(interval);
    };
  }, [user, processQueue]);

  return state;
};
