import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Receipt, Plus, Download, Loader2, QrCode, Search, FileText } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useInvoices, type InvoiceRecord } from '@/hooks/useInvoices';
import { useToast } from '@/hooks/use-toast';
import { formatDateShort } from '@/lib/formatters';
import CreateInvoiceDialog from '@/components/invoices/CreateInvoiceDialog';
import { downloadInvoicePdf } from '@/lib/dynamic-pdf-downloads';
import { exportInvoiceDocx } from '@/lib/generate-invoice-docx';

const PAYMENT_LABELS: Record<string, string> = {
  cash: 'نقداً',
  check: 'شيك',
  transfer: 'تحويل بنكي',
  card: 'بطاقة بنكية',
};

const Invoices = () => {
  const { invoices, loading, refetch } = useInvoices();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [downloading, setDownloading] = useState<string | null>(null);
  const [downloadingDocx, setDownloadingDocx] = useState<string | null>(null);

  const filtered = invoices.filter(inv =>
    !search ||
    inv.invoice_number.toLowerCase().includes(search.toLowerCase()) ||
    inv.clients?.full_name?.includes(search) ||
    inv.cases?.title?.includes(search)
  );

  const totalAmount = filtered.reduce((sum, inv) => sum + Number(inv.amount), 0);

  const downloadPdf = async (invoice: InvoiceRecord) => {
    setDownloading(invoice.id);
    try {
      await downloadInvoicePdf(invoice);
    } catch (e: any) {
      toast({ title: 'خطأ في التحميل', description: e.message, variant: 'destructive' });
    } finally {
      setDownloading(null);
    }
  };

  const downloadDocx = async (invoice: InvoiceRecord) => {
    setDownloadingDocx(invoice.id);
    try {
      await exportInvoiceDocx(invoice);
    } catch (e: any) {
      toast({ title: 'خطأ في التحميل', description: e.message, variant: 'destructive' });
    } finally {
      setDownloadingDocx(null);
    }
  };

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
            <Receipt className="h-5 w-5 text-primary" />
            سجل الوصولات
          </h1>
          <p className="text-muted-foreground text-xs mt-1">وصولات أداء الأتعاب مع توقيع إلكتروني فريد</p>
        </div>
        <Button onClick={() => setDialogOpen(true)} className="gap-1.5">
          <Plus className="h-4 w-4" /> وصل جديد
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">عدد الوصولات</p>
            <p className="text-xl font-bold text-foreground">{filtered.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">المجموع</p>
            <p className="text-xl font-bold text-primary">{totalAmount.toLocaleString('ar-u-nu-latn')} درهم</p>
          </CardContent>
        </Card>
        <Card className="col-span-2 sm:col-span-1">
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">آخر وصل</p>
            <p className="text-sm font-medium text-foreground">
              {invoices.length > 0 ? formatDateShort(invoices[0].created_at) : '—'}
            </p>
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

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {filtered.length === 0 ? (
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
                  {filtered.map(inv => (
                    <TableRow key={inv.id}>
                      <TableCell className="text-xs" dir="ltr">{inv.invoice_number}</TableCell>
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
                          onClick={() => downloadPdf(inv)}
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

      <CreateInvoiceDialog open={dialogOpen} onOpenChange={setDialogOpen} onCreated={refetch} />
    </div>
  );
};

export default Invoices;
