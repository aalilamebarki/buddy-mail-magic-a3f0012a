import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export interface SyncJob {
  id: string;
  case_id: string;
  user_id: string;
  status: 'pending' | 'scraping' | 'completed' | 'failed';
  case_number: string;
  result_data: Record<string, unknown> | null;
  error_message: string | null;
  next_session_date: string | null;
  retry_count: number;
  max_retries: number;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

export const useMahakimSync = (caseId: string | undefined) => {
  const { user } = useAuth();
  const [latestJob, setLatestJob] = useState<SyncJob | null>(null);
  const [syncing, setSyncing] = useState(false);

  const fetchLatestJob = useCallback(async () => {
    if (!caseId) return;
    const { data } = await supabase
      .from('mahakim_sync_jobs')
      .select('*')
      .eq('case_id', caseId)
      .order('created_at', { ascending: false })
      .limit(1);

    if (data && data.length > 0) {
      setLatestJob(data[0] as unknown as SyncJob);
    }
  }, [caseId]);

  useEffect(() => { fetchLatestJob(); }, [fetchLatestJob]);

  useEffect(() => {
    if (!caseId) return;
    const channel = supabase
      .channel(`mahakim-sync-${caseId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'mahakim_sync_jobs',
        filter: `case_id=eq.${caseId}`,
      }, (payload) => {
        const newJob = payload.new as unknown as SyncJob;
        if (newJob && newJob.id) {
          setLatestJob(newJob);
          if (newJob.status === 'completed') {
            setSyncing(false);
            toast.success('تم جلب بيانات الملف من بوابة محاكم بنجاح');
          } else if (newJob.status === 'failed') {
            setSyncing(false);
            toast.error(newJob.error_message || 'فشل جلب البيانات');
          }
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [caseId]);

  /** Start sync with court selection */
  const startSync = useCallback(async (
    caseNumber: string,
    appealCourt?: string,
    firstInstanceCourt?: string,
  ) => {
    if (!caseId || !user) return;
    setSyncing(true);

    const parts = caseNumber.split('/');
    const numero = parts[0] || '';
    const code = parts[1] || '';
    const annee = parts[2] || '';

    const jobId = crypto.randomUUID();
    const { error: insertError } = await supabase
      .from('mahakim_sync_jobs')
      .insert({
        id: jobId,
        case_id: caseId,
        user_id: user.id,
        case_number: caseNumber,
        status: 'pending',
        request_payload: { appealCourt, firstInstanceCourt, numero, code, annee },
      } as any);

    if (insertError) {
      console.error('Failed to create sync job:', insertError);
      toast.error('خطأ في إنشاء مهمة المزامنة');
      setSyncing(false);
      return;
    }

    setLatestJob({
      id: jobId,
      case_id: caseId,
      user_id: user.id,
      status: 'pending',
      case_number: caseNumber,
      result_data: null,
      error_message: null,
      next_session_date: null,
      retry_count: 0,
      max_retries: 2,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      completed_at: null,
    });

    try {
      const { data, error } = await supabase.functions.invoke('fetch-dossier', {
        body: {
          action: 'submitSyncJob',
          jobId,
          caseId,
          userId: user.id,
          caseNumber,
          appealCourt,
          firstInstanceCourt,
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

  const openPortal = useCallback(async (caseNumber: string) => {
    await navigator.clipboard.writeText(caseNumber);
    toast.info('تم نسخ رقم الملف — سيتم فتح بوابة محاكم');
    window.open('https://www.mahakim.ma/#/suivi/dossier-suivi', '_blank');
  }, []);

  return { latestJob, syncing, startSync, openPortal, refetch: fetchLatestJob };
};
