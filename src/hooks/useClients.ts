/**
 * هوك جلب الموكلين مع التخزين المؤقت عبر react-query
 */

import { useCallback, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface ClientRecord {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  cin: string | null;
  notes: string | null;
  user_id: string | null;
  created_at: string;
  updated_at: string;
}

export const useClients = () => {
  const queryClient = useQueryClient();

  const { data: clients = [], isLoading: loading, refetch } = useQuery({
    queryKey: ['clients'],
    queryFn: async () => {
      const { data } = await supabase
        .from('clients')
        .select('*')
        .order('full_name');
      return (data || []) as ClientRecord[];
    },
  });

  useEffect(() => {
    const channel = supabase
      .channel('clients_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'clients' }, () => {
        queryClient.invalidateQueries({ queryKey: ['clients'] });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  const setClients = useCallback((updater: ClientRecord[] | ((prev: ClientRecord[]) => ClientRecord[])) => {
    queryClient.setQueryData(['clients'], (prev: ClientRecord[] | undefined) => {
      if (typeof updater === 'function') return updater(prev || []);
      return updater;
    });
  }, [queryClient]);

  return { clients, setClients, loading, refetch };
};
