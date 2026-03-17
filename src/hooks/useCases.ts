import { useState, useEffect, useCallback } from 'react';
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
  const [cases, setCases] = useState<CaseRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCases = useCallback(async () => {
    setLoading(true);
    let query = supabase.from('cases').select(
      options.withClients !== false
        ? 'id, title, case_number, case_type, court, court_level, status, description, client_id, assigned_to, opposing_party, opposing_party_address, opposing_party_phone, created_at, updated_at, clients(full_name)'
        : '*'
    );
    if (options.status) query = query.eq('status', options.status);
    query = query.order('created_at', { ascending: false });
    const { data } = await query;
    if (data) setCases(data as CaseRecord[]);
    setLoading(false);
  }, [options.status, options.withClients]);

  useEffect(() => { fetchCases(); }, [fetchCases]);

  return { cases, setCases, loading, refetch: fetchCases };
};
