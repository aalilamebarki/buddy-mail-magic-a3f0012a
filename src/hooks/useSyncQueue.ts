/**
 * مدير المزامنة الذكي — يكتشف الملفات القديمة ويزامنها تلقائياً في الخلفية
 * Smart Sync Queue Manager — auto-detects outdated cases and syncs them in batches
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface SyncFailure {
  caseId: string;
  caseNumber: string;
  caseTitle: string;
  errorMessage: string;
  errorType: 'blocked' | 'timeout' | 'empty' | 'network' | 'unknown';
  timestamp: Date;
}

export interface SyncQueueState {
  /** إجمالي الملفات التي تحتاج مزامنة */
  totalQueued: number;
  /** عدد الملفات المنجزة */
  completedCount: number;
  /** هل المزامنة جارية */
  isRunning: boolean;
  /** الملفات الجاري مزامنتها حالياً */
  currentBatch: string[];
  /** آخر خطأ */
  lastError: string | null;
  /** الملفات التي فشلت مزامنتها */
  failures: SyncFailure[];
  /** عدد النجاحات */
  successCount: number;
}

const BATCH_SIZE = 3;
const STALE_HOURS = 24;
const CHECK_INTERVAL_MS = 60_000; // check every minute

export const useSyncQueue = () => {
  const { user } = useAuth();
  const [state, setState] = useState<SyncQueueState>({
    totalQueued: 0,
    completedCount: 0,
    isRunning: false,
    currentBatch: [],
    lastError: null,
    failures: [],
    successCount: 0,
  });

  const queueRef = useRef<string[]>([]);
  const isProcessingRef = useRef(false);
  const mountedRef = useRef(true);

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

    // تصفية الملفات التي لديها مهمة مزامنة جارية أو حديثة
    const caseIds = data.map(c => c.id);
    if (caseIds.length === 0) return [];

    const { data: recentJobs } = await supabase
      .from('mahakim_sync_jobs')
      .select('case_id, status, created_at')
      .in('case_id', caseIds)
      .in('status', ['pending', 'scraping'])
      .gte('created_at', new Date(Date.now() - 10 * 60 * 1000).toISOString());

    const busyCaseIds = new Set((recentJobs || []).map(j => j.case_id));

    // تصفية الملفات التي فشلت بـ 0 إجراء (cooldown 30h)
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

  // معالجة دفعة واحدة
  const processBatch = useCallback(async (batchIds: string[]) => {
    if (!user || batchIds.length === 0) return;

    setState(s => ({ ...s, currentBatch: batchIds }));

    // لكل ملف في الدفعة، نبدأ مزامنة
    const promises = batchIds.map(async (caseId) => {
      try {
        // جلب رقم الملف
        const { data: caseData } = await supabase
          .from('cases')
          .select('case_number')
          .eq('id', caseId)
          .single();

        if (!caseData?.case_number) return;

        const jobId = crypto.randomUUID();

        // إدراج مهمة مزامنة
        await supabase.from('mahakim_sync_jobs').insert({
          id: jobId,
          case_id: caseId,
          user_id: user.id,
          case_number: caseData.case_number,
          status: 'pending',
        });

        // استدعاء Edge Function
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
      }));

      // معالجة على دفعات
      for (let i = 0; i < outdated.length; i += BATCH_SIZE) {
        if (!mountedRef.current) break;

        const batch = outdated.slice(i, i + BATCH_SIZE);
        await processBatch(batch);

        // انتظار 10 ثوان بين الدفعات لتجنب التحميل الزائد
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
  }, [fetchOutdatedCases, processBatch]);

  // بدء المزامنة عند فتح لوحة التحكم
  useEffect(() => {
    mountedRef.current = true;

    if (!user) return;

    // بدء المزامنة بعد 5 ثوان من فتح اللوحة
    const startTimeout = setTimeout(() => {
      processQueue();
    }, 5000);

    // فحص دوري كل دقيقة
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
