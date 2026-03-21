/**
 * هوك جلب الملفات (القضايا) مع التخزين المؤقت عبر react-query
 * Uses react-query for instant cache-based navigation
 */

import { useCallback, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface CaseRecord {
  id: string;
  title: string;
  case_number: string | null;
  case_type: string | null;
  court: string | null;
  court_level: string;
  status: string;
  description: string | null;
  client_id: string | null;
  assigned_to: string | null;
  opposing_party: string | null;
  opposing_party_address: string | null;
  opposing_party_phone: string | null;
  created_at: string;
  updated_at: string;
  clients?: { full_name: string } | null;
}

interface UseCasesOptions {
  status?: string;
  withClients?: boolean;
}

export const useCases = (options: UseCasesOptions = {}) => {
  const queryClient = useQueryClient();
  const selectQuery = options.withClients !== false ? '*, clients(full_name)' : '*';
  const queryKey = ['cases', options.status || 'all', options.withClients !== false];

  const { data: cases = [], isLoading: loading, refetch } = useQuery({
    queryKey,
    queryFn: async () => {
      let query = supabase.from('cases').select(selectQuery);
      if (options.status) query = query.eq('status', options.status);
      query = query.order('created_at', { ascending: false });
      const { data } = await query;
      return (data || []) as unknown as CaseRecord[];
    },
  });

  // Realtime — update cache directly
  useEffect(() => {
    const channel = supabase
      .channel('cases_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cases' }, () => {
        queryClient.invalidateQueries({ queryKey: ['cases'] });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  const setCases = useCallback((updater: CaseRecord[] | ((prev: CaseRecord[]) => CaseRecord[])) => {
    queryClient.setQueryData(queryKey, (prev: CaseRecord[] | undefined) => {
      if (typeof updater === 'function') return updater(prev || []);
      return updater;
    });
  }, [queryClient, queryKey]);

  return { cases, setCases, loading, refetch };
};
