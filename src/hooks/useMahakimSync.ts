/**
 * هوك إدارة مزامنة بيانات الملفات من بوابة محاكم
 * Hook for managing Mahakim portal sync jobs
 *
 * المسؤوليات:
 * - جلب آخر مهمة مزامنة للملف
 * - الاستماع للتحديثات في الوقت الحقيقي عبر Realtime
 * - إنشاء مهمة مزامنة جديدة واستدعاء Edge Function
 * - فتح بوابة محاكم يدوياً مع نسخ رقم الملف
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import type { Tables } from '@/integrations/supabase/types';

/** نوع مهمة المزامنة — مطابق لجدول mahakim_sync_jobs */
export type SyncJob = Tables<'mahakim_sync_jobs'> & {
  status: 'pending' | 'scraping' | 'completed' | 'failed';
};

/** نوع مزود الجلب */
export type ScrapeProvider = 'auto' | 'firecrawl' | 'scrapingbee';

export const useMahakimSync = (caseId: string | undefined) => {
  const { user } = useAuth();
  const [latestJob, setLatestJob] = useState<SyncJob | null>(null);
  const [syncing, setSyncing] = useState(false);

  /* ── جلب آخر مهمة مزامنة ── */
  const fetchLatestJob = useCallback(async () => {
    if (!caseId) return;
    const { data } = await supabase
      .from('mahakim_sync_jobs')
      .select('*')
      .eq('case_id', caseId)
      .order('created_at', { ascending: false })
      .limit(1);

    if (data?.[0]) {
      setLatestJob(data[0] as SyncJob);
    }
  }, [caseId]);

  useEffect(() => { fetchLatestJob(); }, [fetchLatestJob]);

  /* ── الاستماع للتحديثات في الوقت الحقيقي ── */
  useEffect(() => {
    if (!caseId) return;

    // Timeout: إغلاق المهام العالقة بعد 5 دقائق
    const timeoutInterval = setInterval(async () => {
      if (latestJob && (latestJob.status === 'scraping' || latestJob.status === 'pending')) {
        const age = Date.now() - new Date(latestJob.created_at).getTime();
        if (age > 5 * 60 * 1000) {
          await supabase.from('mahakim_sync_jobs').update({
            status: 'failed',
            error_message: 'انتهت مهلة المزامنة — لم يتم استلام النتائج',
            completed_at: new Date().toISOString(),
          }).eq('id', latestJob.id);
          setSyncing(false);
        }
      }
    }, 30000);

    const channel = supabase
      .channel(`mahakim-sync-${caseId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'mahakim_sync_jobs',
        filter: `case_id=eq.${caseId}`,
      }, (payload) => {
        const newJob = payload.new as SyncJob;
        if (!newJob?.id) return;

        setLatestJob(newJob);

        if (newJob.status === 'completed') {
          setSyncing(false);
          toast.success('تم جلب بيانات الملف من بوابة محاكم بنجاح');
        } else if (newJob.status === 'failed') {
          setSyncing(false);
          toast.error(newJob.error_message || 'فشل جلب البيانات');
        }
      })
      .subscribe();

    return () => {
      clearInterval(timeoutInterval);
      supabase.removeChannel(channel);
    };
  }, [caseId, latestJob]);

  /* ── بدء مزامنة جديدة ── */
  const startSync = useCallback(async (
    caseNumber: string,
    appealCourt?: string,
    firstInstanceCourt?: string,
    provider: ScrapeProvider = 'auto',
  ) => {
    if (!caseId || !user) return;
    setSyncing(true);

    const [numero, code, annee] = caseNumber.split('/');
    const jobId = crypto.randomUUID();

    // إدراج مهمة جديدة في قاعدة البيانات
    const { error: insertError } = await supabase
      .from('mahakim_sync_jobs')
      .insert({
        id: jobId,
        case_id: caseId,
        user_id: user.id,
        case_number: caseNumber,
        status: 'pending',
        request_payload: { appealCourt, firstInstanceCourt, numero, code, annee, provider },
      });

    if (insertError) {
      console.error('Failed to create sync job:', insertError);
      toast.error('خطأ في إنشاء مهمة المزامنة');
      setSyncing(false);
      return;
    }

    // تحديث الحالة المحلية فوراً (optimistic update)
    setLatestJob({
      id: jobId,
      case_id: caseId,
      user_id: user.id,
      status: 'pending',
      case_number: caseNumber,
      result_data: null,
      error_message: null,
      next_session_date: null,
      request_payload: null,
      retry_count: 0,
      max_retries: 2,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      completed_at: null,
    });

    // استدعاء Edge Function لبدء الجلب
    try {
      const { error } = await supabase.functions.invoke('fetch-dossier', {
        body: {
          action: 'submitSyncJob',
          jobId,
          caseId,
          userId: user.id,
          caseNumber,
          appealCourt,
          firstInstanceCourt,
          provider,
        },
      });

      if (error) {
        console.error('Edge function error:', error);
        await supabase.from('mahakim_sync_jobs').update({
          status: 'failed',
          error_message: 'خطأ في الاتصال بخدمة الجلب',
          completed_at: new Date().toISOString(),
        }).eq('id', jobId);
        setSyncing(false);
      }
    } catch (err) {
      console.error('Sync invoke error:', err);
      setSyncing(false);
    }
  }, [caseId, user]);

  /* ── فتح بوابة محاكم يدوياً ── */
  const openPortal = useCallback(async (caseNumber: string) => {
    await navigator.clipboard.writeText(caseNumber);
    toast.info('تم نسخ رقم الملف — سيتم فتح بوابة محاكم');
    window.open('https://www.mahakim.ma/#/suivi/dossier-suivi', '_blank');
  }, []);

  return { latestJob, syncing, startSync, openPortal, refetch: fetchLatestJob };
};
