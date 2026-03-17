import { useMemo } from 'react';
import type { InvoiceRecord } from './useInvoices';
import type { FeeStatementRecord } from './useFeeStatements';

export interface ClientLedgerEntry {
  clientId: string;
  clientName: string;
  /** Total lawyer fees from all fee statements (the agreed amounts) */
  totalAgreed: number;
  /** Total payments received (from invoices/receipts linked to fee statements) */
  totalPaid: number;
  /** Remaining balance */
  remaining: number;
  /** Payment progress percentage */
  progress: number;
  /** Number of fee statements */
  statementsCount: number;
  /** Number of receipts */
  receiptsCount: number;
  /** Fee statements for this client */
  statements: FeeStatementRecord[];
  /** Invoices for this client */
  invoices: InvoiceRecord[];
}

export interface FeeStatementLedger {
  statementId: string;
  statementNumber: string;
  clientName: string;
  totalAmount: number;
  lawyerFees: number;
  paidAmount: number;
  remaining: number;
  progress: number;
  linkedInvoices: InvoiceRecord[];
}

export const useClientLedger = (
  invoices: InvoiceRecord[],
  statements: FeeStatementRecord[]
) => {
  const clientEntries = useMemo(() => {
    // Group fee statements by client
    const clientMap = new Map<string, ClientLedgerEntry>();

    for (const s of statements) {
      const cid = s.client_id;
      if (!cid) continue;

      if (!clientMap.has(cid)) {
        clientMap.set(cid, {
          clientId: cid,
          clientName: s.clients?.full_name || '—',
          totalAgreed: 0,
          totalPaid: 0,
          remaining: 0,
          progress: 0,
          statementsCount: 0,
          receiptsCount: 0,
          statements: [],
          invoices: [],
        });
      }
      const entry = clientMap.get(cid)!;
      entry.totalAgreed += Number(s.total_amount);
      entry.statementsCount++;
      entry.statements.push(s);
    }

    // Link invoices to clients
    for (const inv of invoices) {
      const cid = inv.client_id;
      if (!cid) continue;

      if (!clientMap.has(cid)) {
        clientMap.set(cid, {
          clientId: cid,
          clientName: inv.clients?.full_name || '—',
          totalAgreed: 0,
          totalPaid: 0,
          remaining: 0,
          progress: 0,
          statementsCount: 0,
          receiptsCount: 0,
          statements: [],
          invoices: [],
        });
      }
      const entry = clientMap.get(cid)!;
      entry.totalPaid += Number(inv.amount);
      entry.receiptsCount++;
      entry.invoices.push(inv);
    }

    // Calculate remaining and progress
    for (const entry of clientMap.values()) {
      entry.remaining = Math.max(0, entry.totalAgreed - entry.totalPaid);
      entry.progress = entry.totalAgreed > 0
        ? Math.min(100, Math.round((entry.totalPaid / entry.totalAgreed) * 100))
        : 0;
    }

    return Array.from(clientMap.values()).sort((a, b) => b.remaining - a.remaining);
  }, [invoices, statements]);

  // Per fee-statement breakdown
  const statementLedgers = useMemo(() => {
    return statements.map(s => {
      const linkedInvoices = invoices.filter(inv => inv.fee_statement_id === s.id);
      const paidAmount = linkedInvoices.reduce((sum, inv) => sum + Number(inv.amount), 0);
      const totalAmount = Number(s.total_amount);
      const remaining = Math.max(0, totalAmount - paidAmount);
      const progress = totalAmount > 0 ? Math.min(100, Math.round((paidAmount / totalAmount) * 100)) : 0;

      return {
        statementId: s.id,
        statementNumber: s.statement_number,
        clientName: s.clients?.full_name || '—',
        totalAmount,
        lawyerFees: Number(s.lawyer_fees),
        paidAmount,
        remaining,
        progress,
        linkedInvoices,
      } as FeeStatementLedger;
    });
  }, [invoices, statements]);

  // Global stats
  const globalStats = useMemo(() => {
    const totalAgreed = clientEntries.reduce((s, e) => s + e.totalAgreed, 0);
    const totalPaid = clientEntries.reduce((s, e) => s + e.totalPaid, 0);
    const totalRemaining = clientEntries.reduce((s, e) => s + e.remaining, 0);
    const collectionRate = totalAgreed > 0 ? Math.round((totalPaid / totalAgreed) * 100) : 0;
    const clientsWithDebt = clientEntries.filter(e => e.remaining > 0).length;

    return { totalAgreed, totalPaid, totalRemaining, collectionRate, clientsWithDebt };
  }, [clientEntries]);

  return { clientEntries, statementLedgers, globalStats };
};
