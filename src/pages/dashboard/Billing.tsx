import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Receipt, FileText, Plus, Download, Loader2, QrCode, Search, Pencil, DollarSign, BookOpen, TrendingUp, Users } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useInvoices } from '@/hooks/useInvoices';
import { useFeeStatements, type FeeStatementRecord } from '@/hooks/useFeeStatements';
import { useAccountingEntries } from '@/hooks/useAccounting';
import { useClientLedger } from '@/hooks/useClientLedger';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { formatDateShort } from '@/lib/formatters';
import { exportAccountingExcel, exportAccountingPDF } from '@/lib/export-accounting';
import CreateInvoiceDialog from '@/components/invoices/CreateInvoiceDialog';
import CreateFeeStatementDialog from '@/components/invoices/CreateFeeStatementDialog';
import ClientLedgerTab from '@/components/billing/ClientLedgerTab';

const PAYMENT_LABELS: Record<string, string> = {
  cash: 'نقداً',
  check: 'شيك',
  transfer: 'تحويل بنكي',
  card: 'بطاقة بنكية',
};

const ENTRY_TYPE_LABELS: Record<string, { label: string; color: string }> = {
  invoice: { label: 'وصل أداء', color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200' },
  fee_statement: { label: 'بيان أتعاب', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' },
};

const buildStatementLabel = (s: FeeStatementRecord) => {
  const clientName = s.clients?.full_name || '—';
  const caseNumbers = (s.fee_statement_cases && s.fee_statement_cases.length > 0)
    ? s.fee_statement_cases.map(fc => fc.cases?.case_number).filter(Boolean).join(' / ')
    : s.cases?.case_number || '—';
  const date = formatDateShort(s.created_at);
  return `بيان الأتعاب للسيد ${clientName} ملف عدد ${caseNumbers} ${date} ${s.statement_number}`;
};

const currentYear = new Date().getFullYear();
const years = Array.from({ length: 5 }, (_, i) => currentYear - i);

const Billing = () => {
  const { invoices, loading: invLoading, refetch: refetchInv } = useInvoices();
  const { statements, loading: fsLoading, refetch: refetchFs } = useFeeStatements();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState('invoices');
  const [invDialogOpen, setInvDialogOpen] = useState(false);
  const [fsDialogOpen, setFsDialogOpen] = useState(false);
  const [editStatement, setEditStatement] = useState<FeeStatementRecord | null>(null);
  const [search, setSearch] = useState('');
  const [downloading, setDownloading] = useState<string | null>(null);

  // Accounting
  const [accYear, setAccYear] = useState(currentYear);
  const { entries, loading: accLoading, stats } = useAccountingEntries(accYear);

  const filteredInvoices = invoices.filter(inv =>
    !search ||
    inv.invoice_number.toLowerCase().includes(search.toLowerCase()) ||
    inv.clients?.full_name?.includes(search) ||
    inv.cases?.title?.includes(search)
  );

  const filteredStatements = statements.filter(s =>
    !search ||
    s.statement_number.toLowerCase().includes(search.toLowerCase()) ||
    s.clients?.full_name?.includes(search) ||
    s.cases?.title?.includes(search)
  );

  const totalInvoices = filteredInvoices.reduce((sum, inv) => sum + Number(inv.amount), 0);
  const totalStatements = filteredStatements.reduce((sum, s) => sum + Number(s.total_amount), 0);

  const downloadPdf = async (id: string, pdfPath: string | null, fileName: string) => {
    if (!pdfPath) {
      toast({ title: 'لا يوجد ملف PDF', variant: 'destructive' });
      return;
    }
    setDownloading(id);
    try {
      const { data, error } = await supabase.storage.from('invoices').download(pdfPath);
      if (error) throw error;
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${fileName}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      toast({ title: 'خطأ في التحميل', description: e.message, variant: 'destructive' });
    } finally {
      setDownloading(null);
    }
  };

  const openEditFs = (s: FeeStatementRecord) => {
    setEditStatement(s);
    setFsDialogOpen(true);
  };

  const openCreateFs = () => {
    setEditStatement(null);
    setFsDialogOpen(true);
  };

  const handleFsDialogClose = (open: boolean) => {
    setFsDialogOpen(open);
    if (!open) setEditStatement(null);
  };

  const loading = invLoading || fsLoading;

  const BillingSkeleton = () => (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="space-y-2">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-10 w-32" />
      </div>
      <Skeleton className="h-10 w-full sm:w-96" />
      <Skeleton className="h-9 w-full max-w-sm" />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}><CardContent className="pt-4 pb-3 space-y-2"><Skeleton className="h-3 w-20" /><Skeleton className="h-6 w-16" /></CardContent></Card>
        ))}
      </div>
      <Card><CardContent className="p-4 space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</CardContent></Card>
    </div>
  );

  if (loading || accLoading) {
    return <BillingSkeleton />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-primary" />
            الفوترة والمالية
          </h1>
          <p className="text-muted-foreground text-xs mt-1">إدارة الوصولات وبيانات الأتعاب والسجل المحاسبي</p>
        </div>
        {activeTab !== 'accounting' && (
          <Button
            onClick={() => activeTab === 'invoices' ? setInvDialogOpen(true) : openCreateFs()}
            className="gap-1.5"
          >
            <Plus className="h-4 w-4" />
            {activeTab === 'invoices' ? 'وصل جديد' : 'بيان جديد'}
          </Button>
        )}
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} dir="rtl">
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="invoices" className="gap-1.5 flex-1 sm:flex-none">
            <Receipt className="h-4 w-4" />
            الوصولات
            <Badge variant="secondary" className="mr-1 text-xs">{filteredInvoices.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="fee-statements" className="gap-1.5 flex-1 sm:flex-none">
            <FileText className="h-4 w-4" />
            بيانات الأتعاب
            <Badge variant="secondary" className="mr-1 text-xs">{filteredStatements.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="accounting" className="gap-1.5 flex-1 sm:flex-none">
            <BookOpen className="h-4 w-4" />
            السجل المحاسبي
          </TabsTrigger>
        </TabsList>

        {/* Search — for invoices & fee statements tabs */}
        {activeTab !== 'accounting' && (
          <div className="relative max-w-sm mt-4">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="بحث بالرقم أو اسم الموكل..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pr-9 text-sm"
            />
          </div>
        )}

        {/* Summary Cards — for invoices & fee statements */}
        {activeTab !== 'accounting' && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
            <Card>
              <CardContent className="pt-4 pb-3">
                <p className="text-xs text-muted-foreground">الوصولات</p>
                <p className="text-xl font-bold text-foreground">{invoices.length}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3">
                <p className="text-xs text-muted-foreground">مجموع الوصولات</p>
                <p className="text-lg font-bold text-primary">{totalInvoices.toLocaleString('ar-u-nu-latn')} د</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3">
                <p className="text-xs text-muted-foreground">بيانات الأتعاب</p>
                <p className="text-xl font-bold text-foreground">{statements.length}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3">
                <p className="text-xs text-muted-foreground">مجموع البيانات</p>
                <p className="text-lg font-bold text-primary">{totalStatements.toLocaleString('ar-u-nu-latn')} د</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Invoices Tab */}
        <TabsContent value="invoices">
          <Card>
            <CardContent className="p-0">
              {filteredInvoices.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Receipt className="h-10 w-10 mx-auto mb-3 opacity-30" />
                  <p>لا توجد وصولات بعد</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-right">الرقم</TableHead>
                        <TableHead className="text-right">الموكل</TableHead>
                        <TableHead className="text-right">الملف</TableHead>
                        <TableHead className="text-right">المبلغ</TableHead>
                        <TableHead className="text-right">الأداء</TableHead>
                        <TableHead className="text-right">التاريخ</TableHead>
                        <TableHead className="text-right">التحقق</TableHead>
                        <TableHead className="text-right">PDF</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredInvoices.map(inv => (
                        <TableRow key={inv.id}>
                          <TableCell className="font-mono text-xs" dir="ltr">{inv.invoice_number}</TableCell>
                          <TableCell>{inv.clients?.full_name || '—'}</TableCell>
                          <TableCell className="text-xs">{inv.cases?.title || '—'}</TableCell>
                          <TableCell className="font-bold">{Number(inv.amount).toLocaleString('ar-u-nu-latn')} د</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">
                              {PAYMENT_LABELS[inv.payment_method] || inv.payment_method}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs">{formatDateShort(inv.created_at)}</TableCell>
                          <TableCell>
                            <span title={inv.signature_uuid}><QrCode className="h-4 w-4 text-primary" /></span>
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0"
                              onClick={() => downloadPdf(inv.id, inv.pdf_path, inv.invoice_number)}
                              disabled={downloading === inv.id}
                            >
                              {downloading === inv.id
                                ? <Loader2 className="h-4 w-4 animate-spin" />
                                : <Download className="h-4 w-4" />}
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Fee Statements Tab */}
        <TabsContent value="fee-statements">
          <Card>
            <CardContent className="p-0">
              {filteredStatements.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <FileText className="h-10 w-10 mx-auto mb-3 opacity-30" />
                  <p>لا توجد بيانات بعد</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-right">التسمية</TableHead>
                        <TableHead className="text-right">المصاريف</TableHead>
                        <TableHead className="text-right">الأتعاب</TableHead>
                        <TableHead className="text-right">المجموع</TableHead>
                        <TableHead className="text-right">إجراءات</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredStatements.map(s => {
                        const expTotal = (s.fee_statement_items || []).reduce((sum, i) => sum + Number(i.amount), 0);
                        return (
                          <TableRow key={s.id}>
                            <TableCell className="text-xs max-w-xs">
                              <p className="font-medium text-foreground">{buildStatementLabel(s)}</p>
                            </TableCell>
                            <TableCell className="text-xs">{expTotal.toLocaleString('ar-u-nu-latn')} د</TableCell>
                            <TableCell className="text-xs">{Number(s.lawyer_fees).toLocaleString('ar-u-nu-latn')} د</TableCell>
                            <TableCell className="font-bold">{Number(s.total_amount).toLocaleString('ar-u-nu-latn')} د</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title="تعديل" onClick={() => openEditFs(s)}>
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 w-7 p-0"
                                  title="تحميل PDF"
                                  onClick={() => downloadPdf(s.id, s.pdf_path, s.statement_number)}
                                  disabled={downloading === s.id}
                                >
                                  {downloading === s.id
                                    ? <Loader2 className="h-4 w-4 animate-spin" />
                                    : <Download className="h-4 w-4" />}
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Accounting Ledger Tab */}
        <TabsContent value="accounting">
          <div className="space-y-4">
            {/* Year selector + export */}
            <div className="flex items-center gap-2 justify-end">
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-xs"
                onClick={() => exportAccountingExcel(entries, accYear)}
                disabled={entries.length === 0}
              >
                <Download className="h-3.5 w-3.5" /> Excel
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-xs"
                onClick={() => exportAccountingPDF(entries, accYear)}
                disabled={entries.length === 0}
              >
                <Download className="h-3.5 w-3.5" /> PDF
              </Button>
              <Select value={String(accYear)} onValueChange={v => setAccYear(Number(v))}>
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

            {/* Accounting Stats */}
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
                <CardTitle className="text-sm">دفتر القيود المحاسبية — {accYear}</CardTitle>
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
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <CreateInvoiceDialog open={invDialogOpen} onOpenChange={setInvDialogOpen} onCreated={refetchInv} />
      <CreateFeeStatementDialog
        open={fsDialogOpen}
        onOpenChange={handleFsDialogClose}
        onCreated={refetchFs}
        editData={editStatement}
      />
    </div>
  );
};

export default Billing;
