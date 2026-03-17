import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DollarSign, TrendingUp, Receipt, FileText, BookOpen, Loader2, Download } from 'lucide-react';
import { useAccountingEntries } from '@/hooks/useAccounting';
import { formatDateShort } from '@/lib/formatters';
import { exportAccountingExcel, exportAccountingPDF } from '@/lib/export-accounting';

const ENTRY_TYPE_LABELS: Record<string, { label: string; color: string }> = {
  invoice: { label: 'وصل أداء', color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200' },
  fee_statement: { label: 'بيان أتعاب', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' },
};

const PAYMENT_LABELS: Record<string, string> = {
  cash: 'نقداً',
  check: 'شيك',
  transfer: 'تحويل بنكي',
  card: 'بطاقة بنكية',
};

const currentYear = new Date().getFullYear();
const years = Array.from({ length: 5 }, (_, i) => currentYear - i);

const Finance = () => {
  const [year, setYear] = useState(currentYear);
  const { entries, loading, stats } = useAccountingEntries(year);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" />
            السجل المحاسبي
          </h1>
          <p className="text-muted-foreground text-xs mt-1">سجل محاسبي مرقم حسب القانون — السنة المالية {year}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 text-xs"
            onClick={() => exportAccountingExcel(entries, year)}
            disabled={entries.length === 0}
          >
            <Download className="h-3.5 w-3.5" /> Excel
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 text-xs"
            onClick={() => exportAccountingPDF(entries, year)}
            disabled={entries.length === 0}
          >
            <Download className="h-3.5 w-3.5" /> PDF
          </Button>
          <Select value={String(year)} onValueChange={v => setYear(Number(v))}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {years.map(y => (
                <SelectItem key={y} value={String(y)}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] text-muted-foreground">إجمالي الإيرادات TTC</p>
                <p className="text-lg font-bold text-primary">{stats.totalTTC.toLocaleString('ar-u-nu-latn')} د</p>
              </div>
              <TrendingUp className="h-6 w-6 text-emerald-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] text-muted-foreground">المبلغ قبل الضريبة HT</p>
                <p className="text-lg font-bold text-foreground">{stats.totalHT.toLocaleString('ar-u-nu-latn')} د</p>
              </div>
              <DollarSign className="h-6 w-6 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] text-muted-foreground">مجموع الضرائب TVA</p>
                <p className="text-lg font-bold text-orange-600">{stats.totalTax.toLocaleString('ar-u-nu-latn')} د</p>
              </div>
              <Receipt className="h-6 w-6 text-orange-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] text-muted-foreground">عدد القيود</p>
                <p className="text-lg font-bold text-foreground">{stats.count}</p>
              </div>
              <FileText className="h-6 w-6 text-blue-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Breakdown */}
      <div className="grid grid-cols-2 gap-3">
        <Card>
          <CardContent className="pt-4 pb-3 flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-emerald-100 dark:bg-emerald-900 flex items-center justify-center">
              <Receipt className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground">وصولات الأداء</p>
              <p className="text-sm font-bold">{stats.totalInvoices.toLocaleString('ar-u-nu-latn')} د</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
              <FileText className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground">بيانات الأتعاب</p>
              <p className="text-sm font-bold">{stats.totalFeeStatements.toLocaleString('ar-u-nu-latn')} د</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Ledger Table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">دفتر القيود المحاسبية — {year}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {entries.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <BookOpen className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p>لا توجد قيود محاسبية لهذه السنة</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">الرقم التسلسلي</TableHead>
                    <TableHead className="text-right">النوع</TableHead>
                    <TableHead className="text-right">الموكل</TableHead>
                    <TableHead className="text-right">البيان</TableHead>
                    <TableHead className="text-right">HT</TableHead>
                    <TableHead className="text-right">TVA</TableHead>
                    <TableHead className="text-right">TTC</TableHead>
                    <TableHead className="text-right">الأداء</TableHead>
                    <TableHead className="text-right">التاريخ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries.map(entry => {
                    const typeInfo = ENTRY_TYPE_LABELS[entry.entry_type] || { label: entry.entry_type, color: '' };
                    return (
                      <TableRow key={entry.id}>
                        <TableCell className="font-mono text-xs font-bold" dir="ltr">{entry.entry_number}</TableCell>
                        <TableCell>
                          <Badge className={`text-[10px] ${typeInfo.color}`} variant="outline">
                            {typeInfo.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">{entry.clients?.full_name || '—'}</TableCell>
                        <TableCell className="text-xs max-w-32 truncate">{entry.description || '—'}</TableCell>
                        <TableCell className="text-xs">{Number(entry.amount_ht).toLocaleString('ar-u-nu-latn')} د</TableCell>
                        <TableCell className="text-xs text-orange-600">{Number(entry.tax_amount).toLocaleString('ar-u-nu-latn')} د</TableCell>
                        <TableCell className="font-bold text-sm">{Number(entry.amount_ttc).toLocaleString('ar-u-nu-latn')} د</TableCell>
                        <TableCell className="text-xs">{PAYMENT_LABELS[entry.payment_method || ''] || entry.payment_method || '—'}</TableCell>
                        <TableCell className="text-xs">{formatDateShort(entry.entry_date)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Finance;
