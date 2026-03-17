import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Loader2, FileBarChart, Download, TrendingUp, Receipt, DollarSign, Calendar } from 'lucide-react';
import { useAccountingEntries } from '@/hooks/useAccounting';
import { exportTaxReportPDF } from '@/lib/export-tax-report';

const currentYear = new Date().getFullYear();
const years = Array.from({ length: 5 }, (_, i) => currentYear - i);

const QUARTER_LABELS: Record<number, string> = {
  1: 'الفصل الأول (يناير – مارس)',
  2: 'الفصل الثاني (أبريل – يونيو)',
  3: 'الفصل الثالث (يوليوز – شتنبر)',
  4: 'الفصل الرابع (أكتوبر – دجنبر)',
};

const QUARTER_MONTHS: Record<number, number[]> = {
  1: [1, 2, 3],
  2: [4, 5, 6],
  3: [7, 8, 9],
  4: [10, 11, 12],
};

const MONTH_NAMES: Record<number, string> = {
  1: 'يناير', 2: 'فبراير', 3: 'مارس', 4: 'أبريل',
  5: 'ماي', 6: 'يونيو', 7: 'يوليوز', 8: 'غشت',
  9: 'شتنبر', 10: 'أكتوبر', 11: 'نونبر', 12: 'دجنبر',
};

interface QuarterData {
  quarter: number;
  invoiceCount: number;
  feeStatementCount: number;
  totalHT: number;
  totalTax: number;
  totalTTC: number;
  months: MonthData[];
}

interface MonthData {
  month: number;
  invoiceCount: number;
  feeStatementCount: number;
  totalHT: number;
  totalTax: number;
  totalTTC: number;
}

const fmtNum = (n: number) =>
  n.toLocaleString('ar-u-nu-latn', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const Reports = () => {
  const [year, setYear] = useState(currentYear);
  const { entries, loading } = useAccountingEntries(year);

  const quarterData = useMemo(() => {
    const quarters: QuarterData[] = [1, 2, 3, 4].map(q => {
      const months = QUARTER_MONTHS[q].map(m => {
        const monthEntries = entries.filter(e => {
          const d = new Date(e.entry_date);
          return d.getMonth() + 1 === m;
        });
        return {
          month: m,
          invoiceCount: monthEntries.filter(e => e.entry_type === 'invoice').length,
          feeStatementCount: monthEntries.filter(e => e.entry_type === 'fee_statement').length,
          totalHT: monthEntries.reduce((s, e) => s + Number(e.amount_ht), 0),
          totalTax: monthEntries.reduce((s, e) => s + Number(e.tax_amount), 0),
          totalTTC: monthEntries.reduce((s, e) => s + Number(e.amount_ttc), 0),
        };
      });
      return {
        quarter: q,
        invoiceCount: months.reduce((s, m) => s + m.invoiceCount, 0),
        feeStatementCount: months.reduce((s, m) => s + m.feeStatementCount, 0),
        totalHT: months.reduce((s, m) => s + m.totalHT, 0),
        totalTax: months.reduce((s, m) => s + m.totalTax, 0),
        totalTTC: months.reduce((s, m) => s + m.totalTTC, 0),
        months,
      };
    });
    return quarters;
  }, [entries]);

  const annualTotals = useMemo(() => ({
    invoiceCount: quarterData.reduce((s, q) => s + q.invoiceCount, 0),
    feeStatementCount: quarterData.reduce((s, q) => s + q.feeStatementCount, 0),
    totalHT: quarterData.reduce((s, q) => s + q.totalHT, 0),
    totalTax: quarterData.reduce((s, q) => s + q.totalTax, 0),
    totalTTC: quarterData.reduce((s, q) => s + q.totalTTC, 0),
  }), [quarterData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <FileBarChart className="h-5 w-5 text-primary" />
            التقرير الضريبي السنوي
          </h1>
          <p className="text-muted-foreground text-xs mt-1">
            ملخص الإيرادات والضرائب المستحقة حسب الفصول — السنة المالية {year}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 text-xs"
            onClick={() => exportTaxReportPDF(quarterData, annualTotals, year)}
            disabled={entries.length === 0}
          >
            <Download className="h-3.5 w-3.5" /> تصدير PDF
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

      {/* Annual Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] text-muted-foreground">إجمالي الإيرادات TTC</p>
                <p className="text-lg font-bold text-primary">{fmtNum(annualTotals.totalTTC)} د</p>
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
                <p className="text-lg font-bold text-foreground">{fmtNum(annualTotals.totalHT)} د</p>
              </div>
              <DollarSign className="h-6 w-6 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] text-muted-foreground">مجموع TVA المستحقة</p>
                <p className="text-lg font-bold text-orange-600">{fmtNum(annualTotals.totalTax)} د</p>
              </div>
              <Receipt className="h-6 w-6 text-orange-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] text-muted-foreground">عدد الوثائق</p>
                <p className="text-lg font-bold text-foreground">
                  {annualTotals.invoiceCount + annualTotals.feeStatementCount}
                </p>
              </div>
              <Calendar className="h-6 w-6 text-blue-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quarterly Breakdown Table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">تفصيل الإيرادات والضرائب حسب الفصول</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {entries.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <FileBarChart className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p>لا توجد بيانات مالية لهذه السنة</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">الفترة</TableHead>
                    <TableHead className="text-right">وصولات</TableHead>
                    <TableHead className="text-right">بيانات أتعاب</TableHead>
                    <TableHead className="text-right">المبلغ HT</TableHead>
                    <TableHead className="text-right">TVA المستحقة</TableHead>
                    <TableHead className="text-right">المبلغ TTC</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {quarterData.map(q => (
                    <>
                      {/* Quarter header row */}
                      <TableRow key={`q-${q.quarter}`} className="bg-muted/40 font-semibold">
                        <TableCell className="text-sm font-bold text-primary">
                          {QUARTER_LABELS[q.quarter]}
                        </TableCell>
                        <TableCell className="font-bold">{q.invoiceCount}</TableCell>
                        <TableCell className="font-bold">{q.feeStatementCount}</TableCell>
                        <TableCell className="font-bold">{fmtNum(q.totalHT)} د</TableCell>
                        <TableCell className="font-bold text-orange-600">{fmtNum(q.totalTax)} د</TableCell>
                        <TableCell className="font-bold text-primary">{fmtNum(q.totalTTC)} د</TableCell>
                      </TableRow>
                      {/* Month rows */}
                      {q.months.map(m => (
                        <TableRow key={`m-${m.month}`} className="text-muted-foreground">
                          <TableCell className="text-xs pr-8">{MONTH_NAMES[m.month]}</TableCell>
                          <TableCell className="text-xs">{m.invoiceCount}</TableCell>
                          <TableCell className="text-xs">{m.feeStatementCount}</TableCell>
                          <TableCell className="text-xs">{fmtNum(m.totalHT)} د</TableCell>
                          <TableCell className="text-xs text-orange-600">{fmtNum(m.totalTax)} د</TableCell>
                          <TableCell className="text-xs">{fmtNum(m.totalTTC)} د</TableCell>
                        </TableRow>
                      ))}
                    </>
                  ))}
                </TableBody>
                <TableFooter>
                  <TableRow className="bg-primary/10 font-bold">
                    <TableCell className="text-sm font-bold">المجموع السنوي</TableCell>
                    <TableCell className="font-bold">{annualTotals.invoiceCount}</TableCell>
                    <TableCell className="font-bold">{annualTotals.feeStatementCount}</TableCell>
                    <TableCell className="font-bold">{fmtNum(annualTotals.totalHT)} د</TableCell>
                    <TableCell className="font-bold text-orange-600">{fmtNum(annualTotals.totalTax)} د</TableCell>
                    <TableCell className="font-bold text-primary">{fmtNum(annualTotals.totalTTC)} د</TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quarterly Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {quarterData.map(q => (
          <Card key={q.quarter} className={q.totalTTC > 0 ? 'border-primary/30' : ''}>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs flex items-center justify-between">
                <span>{QUARTER_LABELS[q.quarter]}</span>
                {q.totalTTC > 0 && (
                  <Badge variant="outline" className="bg-primary/10 text-primary text-[10px]">
                    نشط
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">الإيرادات HT</span>
                <span className="font-semibold">{fmtNum(q.totalHT)} د</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">TVA المستحقة</span>
                <span className="font-semibold text-orange-600">{fmtNum(q.totalTax)} د</span>
              </div>
              <div className="flex justify-between text-xs border-t pt-1">
                <span className="text-muted-foreground">المجموع TTC</span>
                <span className="font-bold text-primary">{fmtNum(q.totalTTC)} د</span>
              </div>
              <div className="flex gap-3 text-[10px] text-muted-foreground">
                <span>{q.invoiceCount} وصل</span>
                <span>{q.feeStatementCount} بيان أتعاب</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default Reports;
