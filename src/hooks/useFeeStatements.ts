import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface FeeStatementItemRecord {
  id: string;
  fee_statement_id: string;
  case_id: string | null;
  description: string;
  amount: number;
  sort_order: number;
}

export interface FeeStatementCaseRecord {
  id: string;
  fee_statement_id: string;
  case_id: string;
  lawyer_fees: number;
  tax_rate: number;
  tax_amount: number;
  subtotal: number;
  total_amount: number;
  cases?: { title: string; case_number: string | null; court: string | null; case_type?: string | null } | null;
}

export interface FeeStatementRecord {
  id: string;
  user_id: string;
  client_id: string | null;
  case_id: string | null;
  letterhead_id: string | null;
  statement_number: string;
  power_of_attorney_date: string | null;
  lawyer_fees: number;
  tax_rate: number;
  tax_amount: number;
  subtotal: number;
  total_amount: number;
  notes: string | null;
  status: string;
  signature_uuid: string;
  pdf_path: string | null;
  created_at: string;
  clients?: { full_name: string; cin: string | null; phone: string | null } | null;
  cases?: { title: string; case_number: string | null; court: string | null; case_type?: string | null } | null;
  letterheads?: {
    lawyer_name: string;
    name_fr?: string | null;
    title_ar?: string | null;
    title_fr?: string | null;
    bar_name_ar?: string | null;
    bar_name_fr?: string | null;
    address?: string | null;
    city?: string | null;
    phone?: string | null;
    email?: string | null;
    header_data?: any | null;
    template_path?: string | null;
  } | null;
  fee_statement_items?: FeeStatementItemRecord[];
  fee_statement_cases?: FeeStatementCaseRecord[];
}

export const useFeeStatements = () => {
  const [statements, setStatements] = useState<FeeStatementRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('fee_statements')
      .select('*, clients(full_name, cin, phone), cases(title, case_number, court, case_type), letterheads(lawyer_name, name_fr, title_ar, title_fr, bar_name_ar, bar_name_fr, address, city, phone, email, header_data), fee_statement_items(*), fee_statement_cases(*, cases(title, case_number, court, case_type))')
      .order('created_at', { ascending: false });
    if (data) setStatements(data as unknown as FeeStatementRecord[]);
    setLoading(false);
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  return { statements, loading, refetch: fetch };
};
