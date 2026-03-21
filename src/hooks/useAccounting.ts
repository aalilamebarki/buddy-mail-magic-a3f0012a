/**
 * هوك المحاسبة مع التخزين المؤقت عبر react-query
 */

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface AccountingEntry {
  id: string;
  entry_number: string;
  fiscal_year: number;
  entry_type: string;
  reference_id: string;
  client_id: string | null;
  description: string | null;
  amount_ht: number;
  tax_amount: number;
  amount_ttc: number;
  payment_method: string | null;
  entry_date: string;
  created_at: string;
  clients?: { full_name: string } | null;
}

export const useAccountingEntries = (fiscalYear?: number) => {
  const year = fiscalYear || new Date().getFullYear();

  const { data: entries = [], isLoading: loading, refetch } = useQuery({
    queryKey: ['accounting_entries', year],
    queryFn: async () => {
      const { data } = await supabase
        .from('accounting_entries')
        .select('*, clients(full_name)')
        .eq('fiscal_year', year)
        .order('created_at', { ascending: false });
      return (data || []) as unknown as AccountingEntry[];
    },
  });

  const stats = useMemo(() => {
    const totalInvoices = entries.filter(e => e.entry_type === 'invoice').reduce((s, e) => s + Number(e.amount_ttc), 0);
    const totalFeeStatements = entries.filter(e => e.entry_type === 'fee_statement').reduce((s, e) => s + Number(e.amount_ttc), 0);
    const totalTax = entries.reduce((s, e) => s + Number(e.tax_amount), 0);
    const totalHT = entries.reduce((s, e) => s + Number(e.amount_ht), 0);
    const totalTTC = entries.reduce((s, e) => s + Number(e.amount_ttc), 0);
    return { totalInvoices, totalFeeStatements, totalTax, totalHT, totalTTC, count: entries.length };
  }, [entries]);

  return { entries, loading, refetch, stats };
};
