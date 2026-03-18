import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { FileText, Plus, Download, Loader2, Search, Pencil, Eye, FileDown } from 'lucide-react';
import DocxPreview, { type DocxPreviewHandle } from '@/components/DocxPreview';
import { Input } from '@/components/ui/input';
import { useFeeStatements, type FeeStatementRecord } from '@/hooks/useFeeStatements';
import { useToast } from '@/hooks/use-toast';
import { formatDateShort } from '@/lib/formatters';
import CreateFeeStatementDialog from '@/components/invoices/CreateFeeStatementDialog';
import { downloadFeeStatementPdf } from '@/lib/dynamic-pdf-downloads';
import { exportFeeStatementDocx, generateFeeStatementDocxBlob } from '@/lib/export-fee-statement-docx';

/** بيان الأتعاب للسيد X ملف عدد Y — تاريخ — رقم */
const buildStatementLabel = (s: FeeStatementRecord) => {
  const clientName = s.clients?.full_name || '—';
  const caseNumbers = (s.fee_statement_cases && s.fee_statement_cases.length > 0)
    ? s.fee_statement_cases.map(fc => fc.cases?.case_number).filter(Boolean).join(' / ')
    : s.cases?.case_number || '—';
  const date = formatDateShort(s.created_at);
  return `بيان الأتعاب للسيد ${clientName} ملف عدد ${caseNumbers} ${date} ${s.statement_number}`;
};

const FeeStatements = () => {
  const { statements, loading, refetch } = useFeeStatements();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editStatement, setEditStatement] = useState<FeeStatementRecord | null>(null);
  const [search, setSearch] = useState('');
  const [downloading, setDownloading] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState<string | null>(null);
  const docxPreviewRef = useRef<DocxPreviewHandle>(null);

  const previewDocx = async (statement: FeeStatementRecord) => {
    setPreviewing(statement.id);
    try {
      const blob = await generateFeeStatementDocxBlob(statement);
      await docxPreviewRef.current?.previewBlob(blob);
    } catch (e: any) {
      toast({ title: 'خطأ في المعاينة', description: e.message, variant: 'destructive' });
    } finally {
      setPreviewing(null);
    }
  };

  const filtered = statements.filter(s =>
    !search ||
    s.statement_number.toLowerCase().includes(search.toLowerCase()) ||
    s.clients?.full_name?.includes(search) ||
    s.cases?.title?.includes(search)
  );

  const totalAmount = filtered.reduce((sum, s) => sum + Number(s.total_amount), 0);

  const downloadPdf = async (statement: FeeStatementRecord) => {
    setDownloading(statement.id);
    try {
      await downloadFeeStatementPdf(statement);
    } catch (e: any) {
      toast({ title: 'خطأ في التحميل', description: e.message, variant: 'destructive' });
    } finally {
      setDownloading(null);
    }
  };

  const downloadDocx = async (statement: FeeStatementRecord) => {
    setDownloading(`docx-${statement.id}`);
    try {
      await exportFeeStatementDocx(statement);
    } catch (e: any) {
      toast({ title: 'خطأ في التحميل', description: e.message, variant: 'destructive' });
    } finally {
      setDownloading(null);
    }
  };

  const openEdit = (s: FeeStatementRecord) => {
    setEditStatement(s);
    setDialogOpen(true);
  };

  const openCreate = () => {
    setEditStatement(null);
    setDialogOpen(true);
  };

  const handleDialogClose = (open: boolean) => {
    setDialogOpen(open);
    if (!open) setEditStatement(null);
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
            <FileText className="h-5 w-5 text-primary" />
            بيانات الأتعاب والمصاريف
          </h1>
          <p className="text-muted-foreground text-xs mt-1">فواتير تفصيلية للمصاريف القضائية وأتعاب المحاماة</p>
        </div>
        <Button onClick={openCreate} className="gap-1.5">
          <Plus className="h-4 w-4" /> بيان جديد
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">عدد البيانات</p>
            <p className="text-xl font-bold text-foreground">{filtered.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">المجموع الكلي</p>
            <p className="text-xl font-bold text-primary">{totalAmount.toLocaleString('ar-u-nu-latn')} درهم</p>
          </CardContent>
        </Card>
        <Card className="col-span-2 sm:col-span-1">
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">آخر بيان</p>
            <p className="text-sm font-medium text-foreground">
              {statements.length > 0 ? formatDateShort(statements[0].created_at) : '—'}
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
                  {filtered.map(s => {
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
                              onClick={() => openEdit(s)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0"
                              title="معاينة Word"
                              onClick={() => previewDocx(s)}
                              disabled={previewing === s.id}
                            >
                              {previewing === s.id
                                ? <Loader2 className="h-4 w-4 animate-spin" />
                                : <Eye className="h-4 w-4" />}
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0"
                              title="تحميل PDF"
                              onClick={() => downloadPdf(s)}
                              disabled={downloading === s.id}
                            >
                              {downloading === s.id
                                ? <Loader2 className="h-4 w-4 animate-spin" />
                                : <Download className="h-4 w-4" />}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0"
                              title="تحميل Word"
                              onClick={() => downloadDocx(s)}
                              disabled={downloading === `docx-${s.id}`}
                            >
                              {downloading === `docx-${s.id}`
                                ? <Loader2 className="h-4 w-4 animate-spin" />
                                : <FileDown className="h-4 w-4" />}
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

      <CreateFeeStatementDialog
        open={dialogOpen}
        onOpenChange={handleDialogClose}
        onCreated={refetch}
        editData={editStatement}
      />

      <DocxPreview ref={docxPreviewRef} title="معاينة بيان الأتعاب" />
    </div>
  );
};

export default FeeStatements;
