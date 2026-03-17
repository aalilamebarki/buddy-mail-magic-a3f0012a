import { useState, useEffect, useCallback } from 'react';
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
  const [entries, setEntries] = useState<AccountingEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const year = fiscalYear || new Date().getFullYear();

  const fetch = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from('accounting_entries')
      .select('*, clients(full_name)')
      .eq('fiscal_year', year)
      .order('created_at', { ascending: false });

    const { data } = await query;
    if (data) setEntries(data as unknown as AccountingEntry[]);
    setLoading(false);
  }, [year]);

  useEffect(() => { fetch(); }, [fetch]);

  // Computed stats
  const totalInvoices = entries.filter(e => e.entry_type === 'invoice').reduce((s, e) => s + Number(e.amount_ttc), 0);
  const totalFeeStatements = entries.filter(e => e.entry_type === 'fee_statement').reduce((s, e) => s + Number(e.amount_ttc), 0);
  const totalTax = entries.reduce((s, e) => s + Number(e.tax_amount), 0);
  const totalHT = entries.reduce((s, e) => s + Number(e.amount_ht), 0);
  const totalTTC = entries.reduce((s, e) => s + Number(e.amount_ttc), 0);

  return {
    entries,
    loading,
    refetch: fetch,
    stats: { totalInvoices, totalFeeStatements, totalTax, totalHT, totalTTC, count: entries.length },
  };
};
