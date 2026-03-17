import { useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Receipt, FileText, CheckCircle2, AlertTriangle, TrendingUp } from 'lucide-react';
import { formatDateShort } from '@/lib/formatters';
import type { InvoiceRecord } from '@/hooks/useInvoices';
import type { FeeStatementRecord } from '@/hooks/useFeeStatements';

interface Props {
  clientId: string;
  invoices: InvoiceRecord[];
  statements: FeeStatementRecord[];
}

const ClientFinanceSection = ({ clientId, invoices, statements }: Props) => {
  const clientStatements = useMemo(
    () => statements.filter(s => s.client_id === clientId),
    [statements, clientId]
  );

  const clientInvoices = useMemo(
    () => invoices.filter(inv => inv.client_id === clientId),
    [invoices, clientId]
  );

  const totalAgreed = clientStatements.reduce((s, st) => s + Number(st.total_amount), 0);
  const totalPaid = clientInvoices.reduce((s, inv) => s + Number(inv.amount), 0);
  const remaining = Math.max(0, totalAgreed - totalPaid);
  const progress = totalAgreed > 0 ? Math.min(100, Math.round((totalPaid / totalAgreed) * 100)) : 0;

  if (clientStatements.length === 0 && clientInvoices.length === 0) {
    return (
      <div className="text-center py-6 text-muted-foreground text-xs">
        <Receipt className="h-6 w-6 mx-auto mb-2 opacity-30" />
        لا توجد بيانات مالية لهذا الموكل بعد
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-lg border bg-muted/30 p-2.5 text-center">
          <p className="text-[10px] text-muted-foreground">المتفق عليه</p>
          <p className="text-sm font-bold text-foreground">{totalAgreed.toLocaleString('ar-u-nu-latn')} د</p>
        </div>
        <div className="rounded-lg border bg-primary/5 border-primary/20 p-2.5 text-center">
          <p className="text-[10px] text-muted-foreground">المدفوع</p>
          <p className="text-sm font-bold text-primary">{totalPaid.toLocaleString('ar-u-nu-latn')} د</p>
        </div>
        <div className="rounded-lg border bg-destructive/5 border-destructive/20 p-2.5 text-center">
          <p className="text-[10px] text-muted-foreground">المتبقي</p>
          <p className="text-sm font-bold text-destructive">{remaining.toLocaleString('ar-u-nu-latn')} د</p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="space-y-1">
        <Progress value={progress} className="h-2" />
        <div className="flex justify-between items-center">
          <span className="text-[10px] text-muted-foreground">{progress}% مؤدى</span>
          {remaining === 0 && totalAgreed > 0 ? (
            <Badge className="text-[10px] bg-primary/10 text-primary border-primary/20" variant="outline">
              <CheckCircle2 className="h-3 w-3 ml-1" />
              مؤدى بالكامل
            </Badge>
          ) : remaining > 0 ? (
            <Badge variant="destructive" className="text-[10px]">
              <AlertTriangle className="h-3 w-3 ml-1" />
              متبقي
            </Badge>
          ) : null}
        </div>
      </div>

      {/* Per fee-statement breakdown */}
      {clientStatements.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-foreground flex items-center gap-1">
            <FileText className="h-3.5 w-3.5" /> بيانات الأتعاب ({clientStatements.length})
          </p>
          <div className="space-y-2">
            {clientStatements.map(stmt => {
              const stmtInvoices = clientInvoices.filter(inv => inv.fee_statement_id === stmt.id);
              const stmtPaid = stmtInvoices.reduce((s, inv) => s + Number(inv.amount), 0);
              const stmtTotal = Number(stmt.total_amount);
              const stmtRemaining = Math.max(0, stmtTotal - stmtPaid);
              const stmtProgress = stmtTotal > 0 ? Math.min(100, Math.round((stmtPaid / stmtTotal) * 100)) : 0;

              return (
                <div key={stmt.id} className="rounded-lg border p-2.5 space-y-1.5">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-medium">{stmt.statement_number}</span>
                    <span className="text-[10px] text-muted-foreground">
                      {new Date(stmt.created_at).toLocaleDateString('ar-MA')}
                    </span>
                  </div>
                  <div className="flex justify-between text-[10px]">
                    <span className="text-muted-foreground">المبلغ: {stmtTotal.toLocaleString('ar-u-nu-latn')} د</span>
                    <span className="text-muted-foreground">المدفوع: {stmtPaid.toLocaleString('ar-u-nu-latn')} د</span>
                    <span className={stmtRemaining > 0 ? 'font-bold text-destructive' : 'text-primary font-bold'}>
                      {stmtRemaining > 0 ? `متبقي: ${stmtRemaining.toLocaleString('ar-u-nu-latn')} د` : '✅'}
                    </span>
                  </div>
                  <Progress value={stmtProgress} className="h-1.5" />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Recent receipts */}
      {clientInvoices.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-foreground flex items-center gap-1">
            <Receipt className="h-3.5 w-3.5" /> الوصولات ({clientInvoices.length})
          </p>
          <div className="space-y-1">
            {clientInvoices.slice(0, 5).map(inv => (
              <div key={inv.id} className="flex justify-between items-center text-[10px] rounded border px-2 py-1.5">
                <span className="font-medium">{inv.invoice_number}</span>
                <span className="text-primary font-bold">{Number(inv.amount).toLocaleString('ar-u-nu-latn')} د</span>
                <span className="text-muted-foreground">{new Date(inv.created_at).toLocaleDateString('ar-MA')}</span>
              </div>
            ))}
            {clientInvoices.length > 5 && (
              <p className="text-[10px] text-muted-foreground text-center">+{clientInvoices.length - 5} وصولات أخرى</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ClientFinanceSection;
