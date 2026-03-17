import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Loader2, Receipt, Eye, ArrowRight, Plus, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useClients } from '@/hooks/useClients';
import { useCases } from '@/hooks/useCases';
import { useLetterheadOptions, useInvoices } from '@/hooks/useInvoices';
import { useFeeStatements } from '@/hooks/useFeeStatements';
import { generateInvoicePDF } from '@/lib/generate-invoice-pdf';
import { formatDateArabic } from '@/lib/formatters';
import CreateCaseDialog from '@/components/cases/CreateCaseDialog';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}

const PAYMENT_METHODS = [
  { value: 'cash', label: 'نقداً' },
  { value: 'check', label: 'شيك' },
  { value: 'transfer', label: 'تحويل بنكي' },
  { value: 'card', label: 'بطاقة بنكية' },
];

const CreateInvoiceDialog = ({ open, onOpenChange, onCreated }: Props) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { clients } = useClients();
  const { cases, refetch: refetchCases } = useCases({ withClients: false });
  const letterheads = useLetterheadOptions();
  const { invoices: allInvoices } = useInvoices();
  const { statements } = useFeeStatements();
  const [showCaseDialog, setShowCaseDialog] = useState(false);

  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState<'form' | 'preview'>('form');
  const [form, setForm] = useState({
    clientId: '',
    caseId: '',
    letterheadId: '',
    feeStatementId: '',
    amount: '',
    description: '',
    paymentMethod: 'cash',
  });

  const update = (field: string, value: string) => setForm(prev => ({ ...prev, [field]: value }));

  const filteredCases = form.clientId
    ? cases.filter(c => c.client_id === form.clientId)
    : cases;

  // Fee statements for selected client
  const clientStatements = useMemo(() => {
    if (!form.clientId) return [];
    return statements.filter(s => s.client_id === form.clientId);
  }, [form.clientId, statements]);

  // Calculate remaining for selected fee statement
  const selectedStatementInfo = useMemo(() => {
    if (!form.feeStatementId) return null;
    const stmt = statements.find(s => s.id === form.feeStatementId);
    if (!stmt) return null;

    const paidSoFar = allInvoices
      .filter(inv => inv.fee_statement_id === form.feeStatementId)
      .reduce((sum, inv) => sum + Number(inv.amount), 0);

    const totalAmount = Number(stmt.total_amount);
    const remaining = Math.max(0, totalAmount - paidSoFar);
    const progress = totalAmount > 0 ? Math.min(100, Math.round((paidSoFar / totalAmount) * 100)) : 0;

    return { stmt, totalAmount, paidSoFar, remaining, progress };
  }, [form.feeStatementId, statements, allInvoices]);

  const client = clients.find(c => c.id === form.clientId);
  const caseItem = cases.find(c => c.id === form.caseId);
  const letterhead = letterheads.find(l => l.id === form.letterheadId);
  const amount = parseFloat(form.amount) || 0;
  const paymentLabel = PAYMENT_METHODS.find(m => m.value === form.paymentMethod)?.label || form.paymentMethod;

  const canSubmit = form.clientId && form.letterheadId && form.amount && amount > 0;

  const clientOptions = clients.map(c => ({
    value: c.id,
    label: c.full_name,
    sublabel: c.phone || c.email || undefined,
  }));

  const caseOptions = filteredCases.map(c => ({
    value: c.id,
    label: c.title,
    sublabel: c.case_number || undefined,
  }));

  const letterheadOptions = letterheads.map(l => ({
    value: l.id,
    label: l.lawyer_name,
  }));

  const feeStatementOptions = useMemo(() => {
    return clientStatements.map(s => {
      const paidSoFar = allInvoices
        .filter(inv => inv.fee_statement_id === s.id)
        .reduce((sum, inv) => sum + Number(inv.amount), 0);
      const remaining = Math.max(0, Number(s.total_amount) - paidSoFar);
      return {
        value: s.id,
        label: s.statement_number,
        sublabel: remaining > 0
          ? `متبقي: ${remaining.toLocaleString('ar-u-nu-latn')} د`
          : '✅ مؤدى بالكامل',
      };
    });
  }, [clientStatements, allInvoices]);

  // When fee statement is selected, auto-fill remaining amount
  const handleFeeStatementChange = (v: string) => {
    update('feeStatementId', v);
    if (v) {
      const stmt = statements.find(s => s.id === v);
      if (stmt) {
        const paidSoFar = allInvoices
          .filter(inv => inv.fee_statement_id === v)
          .reduce((sum, inv) => sum + Number(inv.amount), 0);
        const remaining = Math.max(0, Number(stmt.total_amount) - paidSoFar);
        if (remaining > 0) {
          update('amount', String(remaining));
        }
        // Also auto-select the case if the statement has one
        if (stmt.case_id && !form.caseId) {
          update('caseId', stmt.case_id);
        }
      }
    }
  };

  // When client changes, reset fee statement
  const handleClientChange = (v: string) => {
    setForm(prev => ({ ...prev, clientId: v, feeStatementId: '', caseId: '' }));
  };

  const handleShowPreview = () => {
    if (!canSubmit) return;
    setStep('preview');
  };

  const handleSubmit = async () => {
    if (!user || !canSubmit) return;

    setSaving(true);
    try {
      if (isNaN(amount) || amount <= 0) {
        toast({ title: 'يرجى إدخال مبلغ صحيح', variant: 'destructive' });
        setSaving(false);
        return;
      }

      const { data: seqNumber, error: seqError } = await supabase
        .rpc('next_accounting_number', { _user_id: user.id, _type: 'invoice' });
      if (seqError) throw seqError;
      const invoiceNumber = seqNumber as string;

      const now = new Date();

      const { data: invoice, error } = await supabase
        .from('invoices')
        .insert({
          user_id: user.id,
          client_id: form.clientId || null,
          case_id: form.caseId || null,
          letterhead_id: form.letterheadId || null,
          fee_statement_id: form.feeStatementId || null,
          invoice_number: invoiceNumber,
          amount,
          description: form.description || null,
          payment_method: form.paymentMethod,
        })
        .select('id, signature_uuid')
        .single();

      if (error) throw error;

      await supabase.from('accounting_entries').insert({
        user_id: user.id,
        entry_number: invoiceNumber,
        entry_type: 'invoice',
        reference_id: invoice.id,
        client_id: form.clientId || null,
        description: form.description || `وصل أداء أتعاب — ${client?.full_name || ''}`,
        amount_ht: amount,
        tax_amount: 0,
        amount_ttc: amount,
        payment_method: form.paymentMethod,
      });

      const pdfBlob = await generateInvoicePDF({
        invoiceNumber,
        signatureUuid: invoice.signature_uuid,
        clientName: client?.full_name || 'غير محدد',
        caseName: caseItem?.title,
        caseNumber: caseItem?.case_number || undefined,
        caseType: caseItem?.case_type || undefined,
        amount,
        description: form.description || undefined,
        paymentMethod: form.paymentMethod,
        date: formatDateArabic(now, { year: 'numeric', month: 'long', day: 'numeric' }),
        lawyerName: letterhead?.lawyer_name || 'مكتب المحاماة',
        letterhead: letterhead ? {
          lawyerName: letterhead.lawyer_name,
          nameFr: letterhead.name_fr,
          titleAr: letterhead.title_ar,
          titleFr: letterhead.title_fr,
          barNameAr: letterhead.bar_name_ar,
          barNameFr: letterhead.bar_name_fr,
          address: letterhead.address,
          city: letterhead.city,
          phone: letterhead.phone,
          email: letterhead.email,
        } : undefined,
      });

      const pdfPath = `${user.id}/${invoice.id}.pdf`;
      const { error: uploadError } = await supabase.storage
        .from('invoices')
        .upload(pdfPath, pdfBlob, { contentType: 'application/pdf' });
      if (uploadError) throw uploadError;

      await supabase.from('invoices').update({ pdf_path: pdfPath }).eq('id', invoice.id);

      toast({ title: 'تم إنشاء الوصل بنجاح ✅' });
      setForm({ clientId: '', caseId: '', letterheadId: '', feeStatementId: '', amount: '', description: '', paymentMethod: 'cash' });
      setStep('form');
      onOpenChange(false);
      onCreated();
    } catch (e: any) {
      toast({ title: 'خطأ', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleOpenChange = (v: boolean) => {
    if (!v) setStep('form');
    onOpenChange(v);
  };

  return (
    <>
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5 text-primary" />
            {step === 'preview' ? 'معاينة الوصل' : 'وصل أداء جديد'}
          </DialogTitle>
        </DialogHeader>

        {step === 'preview' ? (
          <div className="space-y-4">
            <div className="rounded-lg border bg-muted/20 p-3 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">الموكل</span>
                <span className="font-semibold">{client?.full_name || '—'}</span>
              </div>
              {caseItem && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">الملف</span>
                  <span>{caseItem.title} {caseItem.case_number ? `(${caseItem.case_number})` : ''}</span>
                </div>
              )}
              {selectedStatementInfo && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">بيان الأتعاب</span>
                  <span>{selectedStatementInfo.stmt.statement_number}</span>
                </div>
              )}
              {letterhead && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">الترويسة</span>
                  <span>{letterhead.lawyer_name}</span>
                </div>
              )}
            </div>

            {selectedStatementInfo && (
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">المتفق عليه</span>
                  <span className="font-medium">{selectedStatementInfo.totalAmount.toLocaleString('ar-u-nu-latn')} د</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">المدفوع سابقاً</span>
                  <span className="font-medium">{selectedStatementInfo.paidSoFar.toLocaleString('ar-u-nu-latn')} د</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">هذا الوصل</span>
                  <span className="font-bold text-primary">{amount.toLocaleString('ar-u-nu-latn')} د</span>
                </div>
                <Separator />
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">المتبقي بعد هذا الوصل</span>
                  <span className="font-bold">
                    {Math.max(0, selectedStatementInfo.remaining - amount).toLocaleString('ar-u-nu-latn')} د
                  </span>
                </div>
              </div>
            )}

            <Separator />

            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">المبلغ</span>
                <span className="text-lg font-bold text-primary">{amount.toLocaleString('ar-u-nu-latn')} درهم</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">طريقة الأداء</span>
                <span className="font-medium">{paymentLabel}</span>
              </div>
              {form.description && (
                <div className="text-xs text-muted-foreground rounded-lg border p-2">
                  <span className="font-semibold">البيان:</span> {form.description}
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep('form')} className="flex-1 gap-1.5">
                <ArrowRight className="h-4 w-4" /> تعديل
              </Button>
              <Button onClick={handleSubmit} disabled={saving} className="flex-1 gap-1.5">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Receipt className="h-4 w-4" />}
                {saving ? 'جاري الإنشاء...' : 'تأكيد وإصدار PDF'}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>الموكل *</Label>
              <SearchableSelect
                options={clientOptions}
                value={form.clientId}
                onValueChange={handleClientChange}
                placeholder="اختر الموكل"
                searchPlaceholder="ابحث باسم الموكل..."
              />
            </div>

            {/* Fee Statement linking */}
            {form.clientId && clientStatements.length > 0 && (
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5">
                  ربط ببيان أتعاب
                  <Badge variant="outline" className="text-[10px] font-normal">اختياري</Badge>
                </Label>
                <SearchableSelect
                  options={[
                    { value: '__none__', label: 'بدون ربط' },
                    ...feeStatementOptions,
                  ]}
                  value={form.feeStatementId || '__none__'}
                  onValueChange={v => handleFeeStatementChange(v === '__none__' ? '' : v)}
                  placeholder="اختر بيان أتعاب"
                  searchPlaceholder="ابحث برقم البيان..."
                />

                {/* Remaining balance indicator */}
                {selectedStatementInfo && (
                  <div className="rounded-lg border bg-muted/30 p-2.5 space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">المتفق عليه</span>
                      <span className="font-medium">{selectedStatementInfo.totalAmount.toLocaleString('ar-u-nu-latn')} د</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">المدفوع</span>
                      <span className="font-medium text-primary">{selectedStatementInfo.paidSoFar.toLocaleString('ar-u-nu-latn')} د</span>
                    </div>
                    <Progress value={selectedStatementInfo.progress} className="h-2" />
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] text-muted-foreground">{selectedStatementInfo.progress}% مؤدى</span>
                      <span className="text-xs font-bold">
                        متبقي: {selectedStatementInfo.remaining.toLocaleString('ar-u-nu-latn')} د
                      </span>
                    </div>
                    {selectedStatementInfo.remaining === 0 && (
                      <div className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
                        <AlertCircle className="h-3 w-3" />
                        هذا البيان مؤدى بالكامل
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            <div className="space-y-2">
              <Label>الملف (اختياري)</Label>
              <div className="flex gap-2">
                <div className="flex-1">
                  <SearchableSelect
                    options={caseOptions}
                    value={form.caseId}
                    onValueChange={v => update('caseId', v)}
                    placeholder="ربط بملف"
                    searchPlaceholder="ابحث بعنوان الملف أو رقمه..."
                  />
                </div>
                <Button type="button" variant="outline" size="icon" className="shrink-0" onClick={() => setShowCaseDialog(true)} title="ملف جديد">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label>الترويسة</Label>
              <SearchableSelect
                options={letterheadOptions}
                value={form.letterheadId}
                onValueChange={v => update('letterheadId', v)}
                placeholder="اختر الترويسة"
                searchPlaceholder="ابحث باسم المحامي..."
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>المبلغ (درهم) *</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={form.amount}
                  onChange={e => update('amount', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>طريقة الأداء</Label>
                <Select value={form.paymentMethod} onValueChange={v => update('paymentMethod', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PAYMENT_METHODS.map(m => (
                      <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>البيان</Label>
              <Textarea
                placeholder="تفاصيل الأداء..."
                value={form.description}
                onChange={e => update('description', e.target.value)}
                rows={2}
              />
            </div>

            <Button onClick={handleShowPreview} disabled={!canSubmit} className="w-full gap-2">
              <Eye className="h-4 w-4" /> معاينة الوصل قبل الإصدار
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
    <CreateCaseDialog
      open={showCaseDialog}
      onOpenChange={setShowCaseDialog}
      onCreated={(caseId) => {
        refetchCases();
        update('caseId', caseId);
      }}
      preselectedClientId={form.clientId || undefined}
    />
    </>
  );
};

export default CreateInvoiceDialog;
