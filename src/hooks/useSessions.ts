import { useState, useEffect, useCallback, useMemo } from 'react';
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
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSessions = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('court_sessions')
      .select(SELECT_QUERY)
      .order('session_date', { ascending: true });
    if (data) setSessions(data as SessionRecord[]);
    setLoading(false);
  }, []);

  useEffect(() => { fetchSessions(); }, [fetchSessions]);

  // Realtime subscription — only refetch the changed row
  useEffect(() => {
    const channel = supabase
      .channel('court_sessions_realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'court_sessions' }, async (payload) => {
        // Fetch full row with joins
        const { data } = await supabase
          .from('court_sessions')
          .select(SELECT_QUERY)
          .eq('id', payload.new.id)
          .single();
        if (data) {
          setSessions(prev => {
            if (prev.some(s => s.id === data.id)) return prev;
            return [...prev, data as SessionRecord].sort((a, b) => a.session_date.localeCompare(b.session_date));
          });
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'court_sessions' }, async (payload) => {
        const { data } = await supabase
          .from('court_sessions')
          .select(SELECT_QUERY)
          .eq('id', payload.new.id)
          .single();
        if (data) {
          setSessions(prev => prev.map(s => s.id === data.id ? (data as SessionRecord) : s));
        }
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'court_sessions' }, (payload) => {
        setSessions(prev => prev.filter(s => s.id !== payload.old.id));
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

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
    refetch: fetchSessions,
  };
};
