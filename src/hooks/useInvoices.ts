import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface InvoiceRecord {
  id: string;
  user_id: string;
  client_id: string | null;
  case_id: string | null;
  letterhead_id: string | null;
  fee_statement_id: string | null;
  invoice_number: string;
  amount: number;
  description: string | null;
  payment_method: string;
  signature_uuid: string;
  pdf_path: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  clients?: { full_name: string; cin?: string | null; phone?: string | null } | null;
  cases?: { title: string; case_number: string | null; case_type?: string | null } | null;
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
    header_data?: any;
  } | null;
  fee_statements?: { statement_number: string; total_amount: number; lawyer_fees: number } | null;
}

export const useInvoices = () => {
  const [invoices, setInvoices] = useState<InvoiceRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchInvoices = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('invoices')
      .select('*, clients(full_name, cin, phone), cases(title, case_number, case_type), letterheads(lawyer_name, name_fr, title_ar, title_fr, bar_name_ar, bar_name_fr, address, city, phone, email, header_data), fee_statements(statement_number, total_amount, lawyer_fees)')
      .order('created_at', { ascending: false });
    if (data) setInvoices(data as unknown as InvoiceRecord[]);
    setLoading(false);
  }, []);

  useEffect(() => { fetchInvoices(); }, [fetchInvoices]);

  return { invoices, loading, refetch: fetchInvoices };
};

export interface LetterheadOption {
  id: string;
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
}

export const useLetterheadOptions = () => {
  const [letterheads, setLetterheads] = useState<LetterheadOption[]>([]);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from('letterheads')
        .select('id, lawyer_name, name_fr, title_ar, title_fr, bar_name_ar, bar_name_fr, address, city, phone, email')
        .order('created_at', { ascending: false });
      if (data) setLetterheads(data);
    };
    fetch();
  }, []);

  return letterheads;
};
