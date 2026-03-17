import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Receipt, FileText, Plus, Download, Loader2, QrCode, Search, Pencil, DollarSign } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useInvoices } from '@/hooks/useInvoices';
import { useFeeStatements, type FeeStatementRecord } from '@/hooks/useFeeStatements';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { formatDateShort } from '@/lib/formatters';
import CreateInvoiceDialog from '@/components/invoices/CreateInvoiceDialog';
import CreateFeeStatementDialog from '@/components/invoices/CreateFeeStatementDialog';

const PAYMENT_LABELS: Record<string, string> = {
  cash: 'نقداً',
  check: 'شيك',
  transfer: 'تحويل بنكي',
  card: 'بطاقة بنكية',
};

const buildStatementLabel = (s: FeeStatementRecord) => {
  const clientName = s.clients?.full_name || '—';
  const caseNumbers = (s.fee_statement_cases && s.fee_statement_cases.length > 0)
    ? s.fee_statement_cases.map(fc => fc.cases?.case_number).filter(Boolean).join(' / ')
    : s.cases?.case_number || '—';
  const date = formatDateShort(s.created_at);
  return `بيان الأتعاب للسيد ${clientName} ملف عدد ${caseNumbers} ${date} ${s.statement_number}`;
};

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

  // Filtered data
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
            <DollarSign className="h-5 w-5 text-primary" />
            الفوترة والمالية
          </h1>
          <p className="text-muted-foreground text-xs mt-1">إدارة الوصولات وبيانات الأتعاب في مكان واحد</p>
        </div>
        <Button
          onClick={() => activeTab === 'invoices' ? setInvDialogOpen(true) : openCreateFs()}
          className="gap-1.5"
        >
          <Plus className="h-4 w-4" />
          {activeTab === 'invoices' ? 'وصل جديد' : 'بيان جديد'}
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
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

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="بحث بالرقم أو اسم الموكل..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pr-9 text-sm"
        />
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
        </TabsList>

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
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 w-7 p-0"
                                  title="تعديل"
                                  onClick={() => openEditFs(s)}
                                >
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
