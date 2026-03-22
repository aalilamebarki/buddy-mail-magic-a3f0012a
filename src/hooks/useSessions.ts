/**
 * هوك جلب الجلسات مع التخزين المؤقت عبر react-query
 */

import { useCallback, useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';

export interface SessionRecord {
  id: string;
  case_id: string;
  session_date: string;
  session_time: string | null;
  court_room: string | null;
  notes: string | null;
  required_action: string;
  status: string;
  user_id: string;
  created_at: string;
  updated_at: string;
  cases?: {
    title: string;
    case_number: string | null;
    court: string | null;
    opposing_party: string | null;
    clients?: { full_name: string } | null;
  } | null;
}

const SELECT_QUERY = '*, cases(title, case_number, court, opposing_party, clients(full_name))';

export const useSessions = () => {
  const queryClient = useQueryClient();

  const { data: sessions = [], isLoading: loading, refetch } = useQuery({
    queryKey: ['court_sessions'],
    queryFn: async () => {
      const { data } = await supabase
        .from('court_sessions')
        .select(SELECT_QUERY)
        .order('session_date', { ascending: true });
      return (data || []) as SessionRecord[];
    },
  });

  // Realtime — patch cache instantly so the table updates without page refresh
  useEffect(() => {
    const upsertSession = async (sessionId: string) => {
      const { data } = await supabase
        .from('court_sessions')
        .select(SELECT_QUERY)
        .eq('id', sessionId)
        .maybeSingle();

      if (!data) return;

      queryClient.setQueryData(['court_sessions'], (prev: SessionRecord[] | undefined) => {
        const next = (prev || []).filter(session => session.id !== sessionId);
        next.push(data as SessionRecord);
        return next.sort((a, b) => {
          const dateCompare = a.session_date.localeCompare(b.session_date);
          if (dateCompare !== 0) return dateCompare;
          return (a.session_time || '').localeCompare(b.session_time || '');
        });
      });
    };

    const removeSession = (sessionId: string) => {
      queryClient.setQueryData(['court_sessions'], (prev: SessionRecord[] | undefined) =>
        (prev || []).filter(session => session.id !== sessionId)
      );
    };

    const channel = supabase
      .channel('court_sessions_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'court_sessions' }, (payload) => {
        if (payload.eventType === 'DELETE') {
          const deletedId = (payload.old as { id?: string } | null)?.id;
          if (deletedId) removeSession(deletedId);
          return;
        }

        const changedId = (payload.new as { id?: string } | null)?.id;
        if (changedId) void upsertSession(changedId);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  const setSessions = useCallback((updater: SessionRecord[] | ((prev: SessionRecord[]) => SessionRecord[])) => {
    queryClient.setQueryData(['court_sessions'], (prev: SessionRecord[] | undefined) => {
      if (typeof updater === 'function') return updater(prev || []);
      return updater;
    });
  }, [queryClient]);

  const today = format(new Date(), 'yyyy-MM-dd');

  const upcomingSessions = useMemo(
    () => sessions.filter(s => s.session_date >= today),
    [sessions, today]
  );

  const pastSessions = useMemo(
    () => sessions.filter(s => s.session_date < today),
    [sessions, today]
  );

  const getNextSession = useCallback((caseId: string, afterDate: string): string | null => {
    const future = sessions
      .filter(s => s.case_id === caseId && s.session_date > afterDate)
      .sort((a, b) => a.session_date.localeCompare(b.session_date));
    return future.length > 0 ? future[0].session_date : null;
  }, [sessions]);

  return {
    sessions,
    setSessions,
    loading,
    upcomingSessions,
    pastSessions,
    getNextSession,
    refetch,
  };
};
