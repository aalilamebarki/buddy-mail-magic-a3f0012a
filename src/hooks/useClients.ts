import { useState, useEffect, useCallback } from 'react';
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
  const [clients, setClients] = useState<ClientRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchClients = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('clients')
      .select('*')
      .order('full_name');
    if (data) setClients(data);
    setLoading(false);
  }, []);

  useEffect(() => { fetchClients(); }, [fetchClients]);

  return { clients, setClients, loading, refetch: fetchClients };
};
