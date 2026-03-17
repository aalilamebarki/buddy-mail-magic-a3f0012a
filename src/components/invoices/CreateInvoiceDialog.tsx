import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Loader2, Receipt } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useClients } from '@/hooks/useClients';
import { useCases } from '@/hooks/useCases';
import { useLetterheadOptions } from '@/hooks/useInvoices';
import { generateInvoicePDF } from '@/lib/generate-invoice-pdf';
import { formatDateArabic } from '@/lib/formatters';

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
  const { cases } = useCases({ withClients: false });
  const letterheads = useLetterheadOptions();

  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    clientId: '',
    caseId: '',
    letterheadId: '',
    amount: '',
    description: '',
    paymentMethod: 'cash',
  });

  const update = (field: string, value: string) => setForm(prev => ({ ...prev, [field]: value }));

  const filteredCases = form.clientId
    ? cases.filter(c => c.client_id === form.clientId)
    : cases;

  const handleSubmit = async () => {
    if (!user || !form.clientId || !form.amount) return;

    setSaving(true);
    try {
      const amount = parseFloat(form.amount);
      if (isNaN(amount) || amount <= 0) {
        toast({ title: 'يرجى إدخال مبلغ صحيح', variant: 'destructive' });
        setSaving(false);
        return;
      }

      // Get sequential number from DB
      const { data: seqNumber, error: seqError } = await supabase
        .rpc('next_accounting_number', { _user_id: user.id, _type: 'invoice' });
      if (seqError) throw seqError;
      const invoiceNumber = seqNumber as string;

      const now = new Date();
      const client = clients.find(c => c.id === form.clientId);
      const caseItem = cases.find(c => c.id === form.caseId);
      const letterhead = letterheads.find(l => l.id === form.letterheadId);

      // Insert invoice record
      const { data: invoice, error } = await supabase
        .from('invoices')
        .insert({
          user_id: user.id,
          client_id: form.clientId || null,
          case_id: form.caseId || null,
          letterhead_id: form.letterheadId || null,
          invoice_number: invoiceNumber,
          amount,
          description: form.description || null,
          payment_method: form.paymentMethod,
        })
        .select('id, signature_uuid')
        .single();

      if (error) throw error;

      // Record accounting entry
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

      // Generate PDF
      const pdfBlob = await generateInvoicePDF({
        invoiceNumber,
        signatureUuid: invoice.signature_uuid,
        clientName: client?.full_name || 'غير محدد',
        caseName: caseItem?.title,
        caseNumber: caseItem?.case_number || undefined,
        amount,
        description: form.description || undefined,
        paymentMethod: form.paymentMethod,
        date: formatDateArabic(now, { year: 'numeric', month: 'long', day: 'numeric' }),
        lawyerName: letterhead?.lawyer_name || 'مكتب المحاماة',
      });

      // Upload PDF
      const pdfPath = `${user.id}/${invoice.id}.pdf`;
      const { error: uploadError } = await supabase.storage
        .from('invoices')
        .upload(pdfPath, pdfBlob, { contentType: 'application/pdf' });
      if (uploadError) throw uploadError;

      await supabase.from('invoices').update({ pdf_path: pdfPath }).eq('id', invoice.id);

      toast({ title: 'تم إنشاء الوصل بنجاح ✅' });
      setForm({ clientId: '', caseId: '', letterheadId: '', amount: '', description: '', paymentMethod: 'cash' });
      onOpenChange(false);
      onCreated();
    } catch (e: any) {
      toast({ title: 'خطأ', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5 text-primary" />
            وصل أداء جديد
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>الموكل *</Label>
            <Select value={form.clientId} onValueChange={v => update('clientId', v)}>
              <SelectTrigger><SelectValue placeholder="اختر الموكل" /></SelectTrigger>
              <SelectContent>
                {clients.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.full_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>الملف (اختياري)</Label>
            <Select value={form.caseId} onValueChange={v => update('caseId', v)}>
              <SelectTrigger><SelectValue placeholder="ربط بملف" /></SelectTrigger>
              <SelectContent>
                {filteredCases.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>الترويسة</Label>
            <Select value={form.letterheadId} onValueChange={v => update('letterheadId', v)}>
              <SelectTrigger><SelectValue placeholder="اختر الترويسة" /></SelectTrigger>
              <SelectContent>
                {letterheads.map(l => (
                  <SelectItem key={l.id} value={l.id}>{l.lawyer_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
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

          <Button onClick={handleSubmit} disabled={saving || !form.clientId || !form.amount} className="w-full gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Receipt className="h-4 w-4" />}
            {saving ? 'جاري الإنشاء...' : 'إنشاء الوصل وتحميل PDF'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CreateInvoiceDialog;
