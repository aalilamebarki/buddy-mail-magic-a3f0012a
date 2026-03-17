import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Loader2, FileText, Plus, Trash2, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useClients } from '@/hooks/useClients';
import { useCases } from '@/hooks/useCases';
import { useLetterheadOptions } from '@/hooks/useInvoices';
import { generateFeeStatementPDF } from '@/lib/generate-fee-statement-pdf';
import { formatDateArabic } from '@/lib/formatters';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}

interface ExpenseItem {
  description: string;
  amount: string;
}

const COMMON_EXPENSES = [
  'مقال افتتاحي',
  'رسوم التسجيل',
  'مصاريف التنفيذ',
  'رسوم الخبرة',
  'مصاريف التبليغ',
  'رسوم الاستئناف',
  'واجبات الدمغة',
  'مصاريف النقل',
];

const CreateFeeStatementDialog = ({ open, onOpenChange, onCreated }: Props) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { clients } = useClients();
  const { cases } = useCases({ withClients: false });
  const letterheads = useLetterheadOptions();

  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    clientId: '',
    letterheadId: '',
    powerOfAttorneyDate: '',
    lawyerFees: '',
    taxRate: '10',
    notes: '',
  });
  const [selectedCaseIds, setSelectedCaseIds] = useState<string[]>([]);
  const [caseSelectValue, setCaseSelectValue] = useState('');
  const [items, setItems] = useState<ExpenseItem[]>([{ description: '', amount: '' }]);

  const update = (field: string, value: string) => setForm(prev => ({ ...prev, [field]: value }));

  const updateItem = (index: number, field: keyof ExpenseItem, value: string) => {
    setItems(prev => prev.map((item, i) => i === index ? { ...item, [field]: value } : item));
  };

  const addItem = () => setItems(prev => [...prev, { description: '', amount: '' }]);

  const removeItem = (index: number) => {
    if (items.length <= 1) return;
    setItems(prev => prev.filter((_, i) => i !== index));
  };

  const addCommonExpense = (desc: string) => {
    const emptyIdx = items.findIndex(i => !i.description);
    if (emptyIdx >= 0) {
      updateItem(emptyIdx, 'description', desc);
    } else {
      setItems(prev => [...prev, { description: desc, amount: '' }]);
    }
  };

  const addCase = (caseId: string) => {
    if (!caseId || selectedCaseIds.includes(caseId)) return;
    const caseItem = cases.find(c => c.id === caseId);
    if (!caseItem?.case_number) {
      toast({ title: 'هذا الملف لا يحتوي على رقم ملف', variant: 'destructive' });
      return;
    }
    setSelectedCaseIds(prev => [...prev, caseId]);
    setCaseSelectValue('');
  };

  const removeCase = (caseId: string) => {
    setSelectedCaseIds(prev => prev.filter(id => id !== caseId));
  };

  const filteredCases = form.clientId
    ? cases.filter(c => c.client_id === form.clientId)
    : cases;

  const availableCases = filteredCases.filter(c => !selectedCaseIds.includes(c.id));
  const selectedCases = cases.filter(c => selectedCaseIds.includes(c.id));

  const expensesTotal = items.reduce((s, i) => s + (parseFloat(i.amount) || 0), 0);
  const lawyerFees = parseFloat(form.lawyerFees) || 0;
  const taxRate = parseFloat(form.taxRate) || 0;
  const subtotal = expensesTotal + lawyerFees;
  const taxAmount = subtotal * taxRate / 100;
  const totalAmount = subtotal + taxAmount;

  const canSubmit = form.clientId && selectedCaseIds.length > 0 && !saving;

  const handleSubmit = async () => {
    if (!user || !canSubmit) return;
    if (items.every(i => !i.description && !i.amount) && !form.lawyerFees) {
      toast({ title: 'يرجى إضافة مصاريف أو أتعاب', variant: 'destructive' });
      return;
    }

    // Validate all cases have case_number
    const missingNumber = selectedCases.find(c => !c.case_number);
    if (missingNumber) {
      toast({ title: `الملف "${missingNumber.title}" لا يحتوي على رقم ملف`, variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      const now = new Date();
      const statementNumber = `FEE-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`;

      const client = clients.find(c => c.id === form.clientId);
      const letterhead = letterheads.find(l => l.id === form.letterheadId);

      // Use first case as primary case_id for backward compat
      const { data: stmt, error } = await supabase
        .from('fee_statements')
        .insert({
          user_id: user.id,
          client_id: form.clientId || null,
          case_id: selectedCaseIds[0] || null,
          letterhead_id: form.letterheadId || null,
          statement_number: statementNumber,
          power_of_attorney_date: form.powerOfAttorneyDate || null,
          lawyer_fees: lawyerFees,
          tax_rate: taxRate,
          tax_amount: taxAmount,
          subtotal,
          total_amount: totalAmount,
          notes: form.notes || null,
        })
        .select('id, signature_uuid')
        .single();

      if (error) throw error;

      // Insert junction cases
      if (selectedCaseIds.length > 0) {
        const { error: casesError } = await supabase
          .from('fee_statement_cases')
          .insert(selectedCaseIds.map(caseId => ({
            fee_statement_id: stmt.id,
            case_id: caseId,
          })));
        if (casesError) throw casesError;
      }

      // Insert items
      const validItems = items.filter(i => i.description && parseFloat(i.amount) > 0);
      if (validItems.length > 0) {
        const { error: itemsError } = await supabase
          .from('fee_statement_items')
          .insert(validItems.map((item, idx) => ({
            fee_statement_id: stmt.id,
            description: item.description,
            amount: parseFloat(item.amount),
            sort_order: idx,
          })));
        if (itemsError) throw itemsError;
      }

      // Generate PDF
      const pdfBlob = await generateFeeStatementPDF({
        statementNumber,
        signatureUuid: stmt.signature_uuid,
        clientName: client?.full_name || '—',
        clientCin: client?.cin || undefined,
        clientPhone: client?.phone || undefined,
        cases: selectedCases.map(c => ({
          title: c.title,
          caseNumber: c.case_number || '',
          court: c.court || undefined,
        })),
        powerOfAttorneyDate: form.powerOfAttorneyDate
          ? formatDateArabic(form.powerOfAttorneyDate, { year: 'numeric', month: 'long', day: 'numeric' })
          : undefined,
        items: validItems.map(i => ({ description: i.description, amount: parseFloat(i.amount) })),
        lawyerFees,
        taxRate,
        taxAmount,
        subtotal,
        totalAmount,
        notes: form.notes || undefined,
        date: formatDateArabic(now, { year: 'numeric', month: 'long', day: 'numeric' }),
        lawyerName: letterhead?.lawyer_name || 'مكتب المحاماة',
      });

      // Upload PDF
      const pdfPath = `fee-statements/${user.id}/${stmt.id}.pdf`;
      const { error: uploadError } = await supabase.storage
        .from('invoices')
        .upload(pdfPath, pdfBlob, { contentType: 'application/pdf' });
      if (uploadError) throw uploadError;

      await supabase.from('fee_statements').update({ pdf_path: pdfPath }).eq('id', stmt.id);

      toast({ title: 'تم إنشاء بيان الأتعاب بنجاح ✅' });
      setForm({ clientId: '', letterheadId: '', powerOfAttorneyDate: '', lawyerFees: '', taxRate: '10', notes: '' });
      setSelectedCaseIds([]);
      setItems([{ description: '', amount: '' }]);
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
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            بيان أتعاب ومصاريف جديد
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Client & Letterhead */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">الموكل *</Label>
              <Select value={form.clientId} onValueChange={v => update('clientId', v)}>
                <SelectTrigger className="text-sm"><SelectValue placeholder="اختر" /></SelectTrigger>
                <SelectContent>
                  {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.full_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">الترويسة</Label>
              <Select value={form.letterheadId} onValueChange={v => update('letterheadId', v)}>
                <SelectTrigger className="text-sm"><SelectValue placeholder="اختر" /></SelectTrigger>
                <SelectContent>
                  {letterheads.map(l => <SelectItem key={l.id} value={l.id}>{l.lawyer_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Cases - Multiple Selection */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold">الملفات * (يجب أن تحتوي على رقم ملف)</Label>
            <Select value={caseSelectValue} onValueChange={addCase}>
              <SelectTrigger className="text-sm"><SelectValue placeholder="اختر ملفاً لإضافته" /></SelectTrigger>
              <SelectContent>
                {availableCases.map(c => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.title} {c.case_number ? `(${c.case_number})` : '⚠️ بدون رقم'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {selectedCases.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {selectedCases.map(c => (
                  <Badge key={c.id} variant="secondary" className="text-xs gap-1 pr-1">
                    {c.title} — {c.case_number}
                    <button onClick={() => removeCase(c.id)} className="hover:text-destructive">
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
            {selectedCaseIds.length === 0 && (
              <p className="text-[10px] text-destructive">يرجى اختيار ملف واحد على الأقل</p>
            )}
          </div>

          {/* Power of Attorney Date */}
          <div className="space-y-1.5">
            <Label className="text-xs">تاريخ التوكيل</Label>
            <Input
              type="date"
              value={form.powerOfAttorneyDate}
              onChange={e => update('powerOfAttorneyDate', e.target.value)}
              className="text-sm"
            />
          </div>

          {/* Expense Items */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold">المصاريف القضائية</Label>
              <Button type="button" variant="ghost" size="sm" onClick={addItem} className="h-7 text-xs gap-1">
                <Plus className="h-3 w-3" /> إضافة سطر
              </Button>
            </div>

            <div className="flex flex-wrap gap-1">
              {COMMON_EXPENSES.map(exp => (
                <Button
                  key={exp}
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-6 text-[10px] px-2"
                  onClick={() => addCommonExpense(exp)}
                >
                  {exp}
                </Button>
              ))}
            </div>

            <div className="space-y-2 max-h-48 overflow-y-auto">
              {items.map((item, idx) => (
                <div key={idx} className="flex gap-2 items-center">
                  <Input
                    placeholder="البيان"
                    value={item.description}
                    onChange={e => updateItem(idx, 'description', e.target.value)}
                    className="text-sm flex-1"
                  />
                  <Input
                    type="number"
                    placeholder="المبلغ"
                    min="0"
                    step="0.01"
                    value={item.amount}
                    onChange={e => updateItem(idx, 'amount', e.target.value)}
                    className="text-sm w-24"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 text-destructive"
                    onClick={() => removeItem(idx)}
                    disabled={items.length <= 1}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>

            <div className="text-xs text-muted-foreground text-left">
              مجموع المصاريف: <span className="font-bold text-foreground">{expensesTotal.toLocaleString('ar-u-nu-latn')} درهم</span>
            </div>
          </div>

          {/* Lawyer Fees & Tax */}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">أتعاب المحامي (درهم)</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={form.lawyerFees}
                onChange={e => update('lawyerFees', e.target.value)}
                className="text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">نسبة الضريبة (%)</Label>
              <Input
                type="number"
                min="0"
                max="100"
                value={form.taxRate}
                onChange={e => update('taxRate', e.target.value)}
                className="text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">المجموع الكلي</Label>
              <div className="h-9 flex items-center justify-center rounded-md border bg-muted/30 text-sm font-bold text-primary">
                {totalAmount.toLocaleString('ar-u-nu-latn', { minimumFractionDigits: 2 })} د
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label className="text-xs">ملاحظات</Label>
            <Textarea
              placeholder="ملاحظات إضافية..."
              value={form.notes}
              onChange={e => update('notes', e.target.value)}
              rows={2}
              className="text-sm"
            />
          </div>

          <Button onClick={handleSubmit} disabled={!canSubmit} className="w-full gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
            {saving ? 'جاري الإنشاء...' : 'إنشاء البيان وتحميل PDF'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CreateFeeStatementDialog;
