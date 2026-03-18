import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';

export interface SessionRecord {
  id: string;
  case_id: string;
  session_date: string;
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

export const useSessions = () => {
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSessions = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('court_sessions')
      .select('*, cases(title, case_number, court, opposing_party, clients(full_name))')
      .order('session_date', { ascending: true });
    if (data) setSessions(data as SessionRecord[]);
    setLoading(false);
  }, []);

  useEffect(() => { fetchSessions(); }, [fetchSessions]);

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
