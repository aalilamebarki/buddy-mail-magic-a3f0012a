import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Loader2, FileText, Plus, Trash2, X, ChevronDown, ChevronUp, Eye, ArrowRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useClients } from '@/hooks/useClients';
import { useCases } from '@/hooks/useCases';
import { useLetterheadOptions } from '@/hooks/useInvoices';
import { generateFeeStatementPDF } from '@/lib/generate-fee-statement-pdf';
import { formatDateArabic } from '@/lib/formatters';
import type { FeeStatementRecord } from '@/hooks/useFeeStatements';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
  editData?: FeeStatementRecord | null;
}

interface ExpenseItem {
  description: string;
  amount: string;
}

interface CaseBlock {
  caseId: string;
  lawyerFees: string;
  taxRate: string;
  items: ExpenseItem[];
  collapsed: boolean;
}

const COMMON_EXPENSES = [
  'مقال افتتاحي', 'رسوم التسجيل', 'مصاريف التنفيذ', 'رسوم الخبرة',
  'مصاريف التبليغ', 'رسوم الاستئناف', 'واجبات الدمغة', 'مصاريف النقل',
];

const DEFAULT_TAX_RATE = '10';

const CreateFeeStatementDialog = ({ open, onOpenChange, onCreated, editData }: Props) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { clients } = useClients();
  const { cases, refetch: refetchCases } = useCases({ withClients: false });
  const letterheads = useLetterheadOptions();

  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState<'form' | 'preview'>('form');
  const [form, setForm] = useState({
    clientId: '',
    letterheadId: '',
    powerOfAttorneyDate: '',
    notes: '',
  });
  const [caseBlocks, setCaseBlocks] = useState<CaseBlock[]>([]);
  const [caseSelectValue, setCaseSelectValue] = useState('');
  const [showNewCase, setShowNewCase] = useState(false);
  const [creatingCase, setCreatingCase] = useState(false);
  const [newCase, setNewCase] = useState({ title: '', case_number: '', court: '', case_type: '' });

  const isEdit = !!editData;

  // Pre-fill form when editing
  useEffect(() => {
    if (editData && open) {
      setForm({
        clientId: editData.client_id || '',
        letterheadId: editData.letterhead_id || '',
        powerOfAttorneyDate: editData.power_of_attorney_date || '',
        notes: editData.notes || '',
      });

      // Build case blocks from junction + items
      if (editData.fee_statement_cases && editData.fee_statement_cases.length > 0) {
        const blocks: CaseBlock[] = editData.fee_statement_cases.map(fc => {
          const caseItems = (editData.fee_statement_items || [])
            .filter(i => i.case_id === fc.case_id)
            .sort((a, b) => a.sort_order - b.sort_order)
            .map(i => ({ description: i.description, amount: String(i.amount) }));
          return {
            caseId: fc.case_id,
            lawyerFees: String(fc.lawyer_fees || editData.lawyer_fees || ''),
            taxRate: String(fc.tax_rate ?? editData.tax_rate ?? DEFAULT_TAX_RATE),
            items: caseItems.length > 0 ? caseItems : [{ description: '', amount: '' }],
            collapsed: false,
          };
        });
        setCaseBlocks(blocks);
      } else if (editData.case_id) {
        // Legacy: single case
        const caseItems = (editData.fee_statement_items || [])
          .sort((a, b) => a.sort_order - b.sort_order)
          .map(i => ({ description: i.description, amount: String(i.amount) }));
        setCaseBlocks([{
          caseId: editData.case_id,
          lawyerFees: String(editData.lawyer_fees || ''),
          taxRate: String(editData.tax_rate ?? DEFAULT_TAX_RATE),
          items: caseItems.length > 0 ? caseItems : [{ description: '', amount: '' }],
          collapsed: false,
        }]);
      }
    } else if (!open) {
      setForm({ clientId: '', letterheadId: '', powerOfAttorneyDate: '', notes: '' });
      setCaseBlocks([]);
      setStep('form');
    }
  }, [editData, open]);

  const update = (field: string, value: string) => setForm(prev => ({ ...prev, [field]: value }));

  // Case block helpers
  const addCase = (caseId: string) => {
    if (!caseId || caseBlocks.some(b => b.caseId === caseId)) return;
    const caseItem = cases.find(c => c.id === caseId);
    if (!caseItem?.case_number) {
      toast({ title: 'هذا الملف لا يحتوي على رقم ملف', variant: 'destructive' });
      return;
    }
    setCaseBlocks(prev => [...prev, {
      caseId,
      lawyerFees: '',
      taxRate: DEFAULT_TAX_RATE,
      items: [{ description: '', amount: '' }],
      collapsed: false,
    }]);
    setCaseSelectValue('');
  };

  const removeCase = (caseId: string) => {
    setCaseBlocks(prev => prev.filter(b => b.caseId !== caseId));
  };

  const updateCaseBlock = (caseId: string, field: keyof CaseBlock, value: any) => {
    setCaseBlocks(prev => prev.map(b => b.caseId === caseId ? { ...b, [field]: value } : b));
  };

  const updateCaseItem = (caseId: string, idx: number, field: keyof ExpenseItem, value: string) => {
    setCaseBlocks(prev => prev.map(b => {
      if (b.caseId !== caseId) return b;
      const newItems = b.items.map((item, i) => i === idx ? { ...item, [field]: value } : item);
      return { ...b, items: newItems };
    }));
  };

  const addCaseItem = (caseId: string) => {
    setCaseBlocks(prev => prev.map(b => {
      if (b.caseId !== caseId) return b;
      return { ...b, items: [...b.items, { description: '', amount: '' }] };
    }));
  };

  const removeCaseItem = (caseId: string, idx: number) => {
    setCaseBlocks(prev => prev.map(b => {
      if (b.caseId !== caseId || b.items.length <= 1) return b;
      return { ...b, items: b.items.filter((_, i) => i !== idx) };
    }));
  };

  const addCommonExpense = (caseId: string, desc: string) => {
    setCaseBlocks(prev => prev.map(b => {
      if (b.caseId !== caseId) return b;
      const emptyIdx = b.items.findIndex(i => !i.description);
      if (emptyIdx >= 0) {
        const newItems = b.items.map((item, i) => i === emptyIdx ? { ...item, description: desc } : item);
        return { ...b, items: newItems };
      }
      return { ...b, items: [...b.items, { description: desc, amount: '' }] };
    }));
  };

  const toggleCollapse = (caseId: string) => {
    setCaseBlocks(prev => prev.map(b => b.caseId === caseId ? { ...b, collapsed: !b.collapsed } : b));
  };

  const handleCreateCase = async () => {
    if (!user || !newCase.title.trim() || !newCase.case_number.trim()) return;
    setCreatingCase(true);
    try {
      const { data, error } = await supabase
        .from('cases')
        .insert({
          title: newCase.title.trim(),
          case_number: newCase.case_number.trim(),
          court: newCase.court.trim() || null,
          case_type: newCase.case_type || null,
          client_id: form.clientId || null,
          assigned_to: user.id,
        })
        .select('id')
        .single();
      if (error) throw error;
      const newCaseId = data.id;
      await refetchCases();
      setCaseBlocks(prev => [...prev, {
        caseId: newCaseId,
        lawyerFees: '',
        taxRate: DEFAULT_TAX_RATE,
        items: [{ description: '', amount: '' }],
        collapsed: false,
      }]);
      setNewCase({ title: '', case_number: '', court: '', case_type: '' });
      setShowNewCase(false);
      toast({ title: 'تم إنشاء الملف وإضافته ✅' });
    } catch (e: any) {
      toast({ title: 'خطأ في إنشاء الملف', description: e.message, variant: 'destructive' });
    } finally {
      setCreatingCase(false);
    }
  };

  const filteredCases = form.clientId ? cases.filter(c => c.client_id === form.clientId) : cases;
  const selectedCaseIds = caseBlocks.map(b => b.caseId);
  const availableCases = filteredCases.filter(c => !selectedCaseIds.includes(c.id));
  const selectedCasesData = cases.filter(c => selectedCaseIds.includes(c.id));

  // Per-case calculations
  const caseCalcs = caseBlocks.map(b => {
    const expensesTotal = b.items.reduce((s, i) => s + (parseFloat(i.amount) || 0), 0);
    const lawyerFees = parseFloat(b.lawyerFees) || 0;
    const taxRate = parseFloat(b.taxRate) || 0;
    const subtotal = expensesTotal + lawyerFees;
    const taxAmount = subtotal * taxRate / 100;
    const totalAmount = subtotal + taxAmount;
    return { caseId: b.caseId, expensesTotal, lawyerFees, taxRate, subtotal, taxAmount, totalAmount };
  });

  const grandTotal = {
    subtotal: caseCalcs.reduce((s, c) => s + c.subtotal, 0),
    taxAmount: caseCalcs.reduce((s, c) => s + c.taxAmount, 0),
    totalAmount: caseCalcs.reduce((s, c) => s + c.totalAmount, 0),
    lawyerFees: caseCalcs.reduce((s, c) => s + c.lawyerFees, 0),
  };

  const canSubmit = form.clientId && caseBlocks.length > 0 && !saving;

  const handleSubmit = async () => {
    if (!user || !canSubmit) return;
    const hasContent = caseBlocks.some(b =>
      b.lawyerFees || b.items.some(i => i.description && i.amount)
    );
    if (!hasContent) {
      toast({ title: 'يرجى إضافة مصاريف أو أتعاب لملف واحد على الأقل', variant: 'destructive' });
      return;
    }

    const missingNumber = selectedCasesData.find(c => !c.case_number);
    if (missingNumber) {
      toast({ title: `الملف "${missingNumber.title}" لا يحتوي على رقم ملف`, variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      const now = new Date();
      const client = clients.find(c => c.id === form.clientId);
      const letterhead = letterheads.find(l => l.id === form.letterheadId);

      let stmtId: string;
      let signatureUuid: string;
      let statementNumber: string;

      if (isEdit) {
        stmtId = editData.id;
        signatureUuid = editData.signature_uuid;
        statementNumber = editData.statement_number;

        await supabase
          .from('fee_statements')
          .update({
            client_id: form.clientId || null,
            case_id: caseBlocks[0]?.caseId || null,
            letterhead_id: form.letterheadId || null,
            power_of_attorney_date: form.powerOfAttorneyDate || null,
            lawyer_fees: grandTotal.lawyerFees,
            tax_rate: caseCalcs[0]?.taxRate || 10,
            tax_amount: grandTotal.taxAmount,
            subtotal: grandTotal.subtotal,
            total_amount: grandTotal.totalAmount,
            notes: form.notes || null,
          })
          .eq('id', stmtId);

        // Clear old junction + items
        await supabase.from('fee_statement_cases').delete().eq('fee_statement_id', stmtId);
        await supabase.from('fee_statement_items').delete().eq('fee_statement_id', stmtId);
      } else {
        const { data: seqNumber, error: seqError } = await supabase
          .rpc('next_accounting_number', { _user_id: user.id, _type: 'fee_statement' });
        if (seqError) throw seqError;
        statementNumber = seqNumber as string;

        const { data: stmt, error } = await supabase
          .from('fee_statements')
          .insert({
            user_id: user.id,
            client_id: form.clientId || null,
            case_id: caseBlocks[0]?.caseId || null,
            letterhead_id: form.letterheadId || null,
            statement_number: statementNumber,
            power_of_attorney_date: form.powerOfAttorneyDate || null,
            lawyer_fees: grandTotal.lawyerFees,
            tax_rate: caseCalcs[0]?.taxRate || 10,
            tax_amount: grandTotal.taxAmount,
            subtotal: grandTotal.subtotal,
            total_amount: grandTotal.totalAmount,
            notes: form.notes || null,
          })
          .select('id, signature_uuid')
          .single();
        if (error) throw error;
        stmtId = stmt.id;
        signatureUuid = stmt.signature_uuid;
      }

      // Insert per-case junction rows with financials
      for (const block of caseBlocks) {
        const calc = caseCalcs.find(c => c.caseId === block.caseId)!;
        await supabase.from('fee_statement_cases').insert({
          fee_statement_id: stmtId,
          case_id: block.caseId,
          lawyer_fees: calc.lawyerFees,
          tax_rate: calc.taxRate,
          tax_amount: calc.taxAmount,
          subtotal: calc.subtotal,
          total_amount: calc.totalAmount,
        });

        // Insert items for this case
        const validItems = block.items.filter(i => i.description && parseFloat(i.amount) > 0);
        if (validItems.length > 0) {
          await supabase.from('fee_statement_items').insert(
            validItems.map((item, idx) => ({
              fee_statement_id: stmtId,
              case_id: block.caseId,
              description: item.description,
              amount: parseFloat(item.amount),
              sort_order: idx,
            }))
          );
        }
      }

      // Accounting entry
      if (isEdit) {
        await supabase
          .from('accounting_entries')
          .update({
            client_id: form.clientId || null,
            description: `بيان أتعاب — ${client?.full_name || ''} — ${selectedCasesData.map(c => c.case_number).join(', ')}`,
            amount_ht: grandTotal.subtotal,
            tax_amount: grandTotal.taxAmount,
            amount_ttc: grandTotal.totalAmount,
          })
          .eq('reference_id', stmtId)
          .eq('entry_type', 'fee_statement');
      } else {
        await supabase.from('accounting_entries').insert({
          user_id: user.id,
          entry_number: statementNumber,
          entry_type: 'fee_statement',
          reference_id: stmtId,
          client_id: form.clientId || null,
          description: `بيان أتعاب — ${client?.full_name || ''} — ${selectedCasesData.map(c => c.case_number).join(', ')}`,
          amount_ht: grandTotal.subtotal,
          tax_amount: grandTotal.taxAmount,
          amount_ttc: grandTotal.totalAmount,
        });
      }

      // Generate PDF
      const perCasePdfData = caseBlocks.map(block => {
        const calc = caseCalcs.find(c => c.caseId === block.caseId)!;
        const caseInfo = cases.find(c => c.id === block.caseId);
        return {
          caseTitle: caseInfo?.title || '',
          caseNumber: caseInfo?.case_number || '',
          court: caseInfo?.court || undefined,
          items: block.items
            .filter(i => i.description && parseFloat(i.amount) > 0)
            .map(i => ({ description: i.description, amount: parseFloat(i.amount) })),
          lawyerFees: calc.lawyerFees,
          expensesTotal: calc.expensesTotal,
          subtotal: calc.subtotal,
          taxAmount: calc.taxAmount,
          totalAmount: calc.totalAmount,
        };
      });

      const pdfBlob = await generateFeeStatementPDF({
        statementNumber,
        signatureUuid,
        clientName: client?.full_name || '—',
        clientCin: client?.cin || undefined,
        clientPhone: client?.phone || undefined,
        powerOfAttorneyDate: form.powerOfAttorneyDate
          ? formatDateArabic(form.powerOfAttorneyDate, { year: 'numeric', month: 'long', day: 'numeric' })
          : undefined,
        taxRate: caseCalcs[0]?.taxRate || 10,
        grandSubtotal: grandTotal.subtotal,
        grandTaxAmount: grandTotal.taxAmount,
        grandTotal: grandTotal.totalAmount,
        caseDetails: perCasePdfData,
        notes: form.notes || undefined,
        date: formatDateArabic(now, { year: 'numeric', month: 'long', day: 'numeric' }),
        lawyerName: letterhead?.lawyer_name || 'مكتب المحاماة',
      });

      // Upload PDF
      const pdfPath = `fee-statements/${user.id}/${stmtId}.pdf`;
      if (isEdit) {
        await supabase.storage.from('invoices').remove([pdfPath]);
      }
      const { error: uploadError } = await supabase.storage
        .from('invoices')
        .upload(pdfPath, pdfBlob, { contentType: 'application/pdf', upsert: true });
      if (uploadError) throw uploadError;

      await supabase.from('fee_statements').update({ pdf_path: pdfPath }).eq('id', stmtId);

      toast({ title: isEdit ? 'تم تحديث البيان بنجاح ✅' : 'تم إنشاء بيان الأتعاب بنجاح ✅' });
      onOpenChange(false);
      onCreated();
    } catch (e: any) {
      toast({ title: 'خطأ', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleShowPreview = () => {
    const hasContent = caseBlocks.some(b =>
      b.lawyerFees || b.items.some(i => i.description && i.amount)
    );
    if (!hasContent) {
      toast({ title: 'يرجى إضافة مصاريف أو أتعاب لملف واحد على الأقل', variant: 'destructive' });
      return;
    }
    const missingNumber = selectedCasesData.find(c => !c.case_number);
    if (missingNumber) {
      toast({ title: `الملف "${missingNumber.title}" لا يحتوي على رقم ملف`, variant: 'destructive' });
      return;
    }
    setStep('preview');
  };

  const client = clients.find(c => c.id === form.clientId);
  const letterhead = letterheads.find(l => l.id === form.letterheadId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            {step === 'preview' ? 'معاينة البيان' : isEdit ? 'تعديل بيان الأتعاب' : 'بيان أتعاب ومصاريف جديد'}
          </DialogTitle>
        </DialogHeader>

        {step === 'preview' ? (
          /* ─── PREVIEW STEP ─── */
          <div className="space-y-4">
            {/* Client Info */}
            <div className="rounded-lg border bg-muted/20 p-3 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">الموكل</span>
                <span className="font-semibold">{client?.full_name || '—'}</span>
              </div>
              {form.powerOfAttorneyDate && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">تاريخ التوكيل</span>
                  <span>{formatDateArabic(form.powerOfAttorneyDate, { year: 'numeric', month: 'long', day: 'numeric' })}</span>
                </div>
              )}
              {letterhead && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">الترويسة</span>
                  <span>{letterhead.lawyer_name}</span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">عدد الملفات</span>
                <Badge variant="outline">{caseBlocks.length}</Badge>
              </div>
            </div>

            {/* Per-case summary */}
            {caseBlocks.map((block, blockIdx) => {
              const caseInfo = cases.find(c => c.id === block.caseId);
              const calc = caseCalcs[blockIdx];
              const validItems = block.items.filter(i => i.description && parseFloat(i.amount) > 0);
              return (
                <Card key={block.caseId} className="border-primary/20">
                  <div className="px-3 py-2 bg-muted/30 rounded-t-lg flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary">ملف {blockIdx + 1}</Badge>
                    <span className="text-xs font-semibold">{caseInfo?.title} — {caseInfo?.case_number}</span>
                    {caseInfo?.court && <span className="text-[10px] text-muted-foreground mr-auto">({caseInfo.court})</span>}
                  </div>
                  <CardContent className="pt-3 space-y-2">
                    {/* Expense items */}
                    {validItems.length > 0 && (
                      <div className="space-y-1">
                        <p className="text-[10px] font-semibold text-muted-foreground">المصاريف القضائية</p>
                        {validItems.map((item, idx) => (
                          <div key={idx} className="flex justify-between text-xs">
                            <span>{item.description}</span>
                            <span className="font-medium">{parseFloat(item.amount).toLocaleString('ar-u-nu-latn')} د</span>
                          </div>
                        ))}
                        <div className="flex justify-between text-xs border-t border-dashed pt-1">
                          <span className="text-muted-foreground">مجموع المصاريف</span>
                          <span className="font-bold">{calc.expensesTotal.toLocaleString('ar-u-nu-latn')} د</span>
                        </div>
                      </div>
                    )}

                    {/* Lawyer fees */}
                    {calc.lawyerFees > 0 && (
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">أتعاب المحامي</span>
                        <span className="font-bold">{calc.lawyerFees.toLocaleString('ar-u-nu-latn')} د</span>
                      </div>
                    )}

                    <Separator />

                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">المجموع قبل الضريبة (HT)</span>
                      <span className="font-semibold">{calc.subtotal.toLocaleString('ar-u-nu-latn', { minimumFractionDigits: 2 })} د</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">TVA ({calc.taxRate}%)</span>
                      <span className="font-semibold text-destructive">{calc.taxAmount.toLocaleString('ar-u-nu-latn', { minimumFractionDigits: 2 })} د</span>
                    </div>
                    <div className="flex justify-between text-sm font-bold text-primary">
                      <span>المجموع الكلي (TTC)</span>
                      <span>{calc.totalAmount.toLocaleString('ar-u-nu-latn', { minimumFractionDigits: 2 })} د</span>
                    </div>
                  </CardContent>
                </Card>
              );
            })}

            {/* Grand total */}
            {caseBlocks.length > 1 && (
              <div className="rounded-lg border-2 border-primary/30 bg-primary/5 p-3 space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">مجموع الأتعاب والمصاريف HT</span>
                  <span className="font-bold">{grandTotal.subtotal.toLocaleString('ar-u-nu-latn', { minimumFractionDigits: 2 })} د</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">مجموع TVA ({TAX_RATE}%)</span>
                  <span className="font-bold text-destructive">{grandTotal.taxAmount.toLocaleString('ar-u-nu-latn', { minimumFractionDigits: 2 })} د</span>
                </div>
                <div className="flex justify-between text-sm border-t pt-1.5">
                  <span className="font-bold">المبلغ الإجمالي TTC</span>
                  <span className="font-bold text-primary text-base">{grandTotal.totalAmount.toLocaleString('ar-u-nu-latn', { minimumFractionDigits: 2 })} د</span>
                </div>
              </div>
            )}

            {/* Notes */}
            {form.notes && (
              <div className="text-xs text-muted-foreground rounded-lg border p-2">
                <span className="font-semibold">ملاحظات:</span> {form.notes}
              </div>
            )}

            {/* Action buttons */}
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep('form')} className="flex-1 gap-1.5">
                <ArrowRight className="h-4 w-4" /> تعديل
              </Button>
              <Button onClick={handleSubmit} disabled={saving} className="flex-1 gap-1.5">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
                {saving ? 'جاري الحفظ...' : 'تأكيد وإصدار PDF'}
              </Button>
            </div>
          </div>
        ) : (
          /* ─── FORM STEP ─── */
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

            {/* Add Case Selector */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold">الملفات * (يجب أن تحتوي على رقم ملف)</Label>
              <div className="flex gap-2">
                <Select value={caseSelectValue} onValueChange={addCase}>
                  <SelectTrigger className="text-sm flex-1"><SelectValue placeholder="اختر ملفاً لإضافته" /></SelectTrigger>
                  <SelectContent>
                    {availableCases.map(c => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.title} {c.case_number ? `(${c.case_number})` : '⚠️ بدون رقم'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button type="button" variant="outline" size="sm" className="shrink-0 gap-1 text-xs" onClick={() => setShowNewCase(v => !v)}>
                  <Plus className="h-3.5 w-3.5" /> ملف جديد
                </Button>
              </div>
              {caseBlocks.length === 0 && !showNewCase && (
                <p className="text-[10px] text-destructive">يرجى اختيار ملف واحد على الأقل</p>
              )}

              {/* Inline New Case Form */}
              {showNewCase && (
                <Card className="border-dashed border-primary/30">
                  <CardContent className="p-3 space-y-3">
                    <p className="text-xs font-semibold text-primary">إنشاء ملف جديد</p>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label className="text-[10px]">عنوان الملف *</Label>
                        <Input className="text-sm h-8" placeholder="مثال: نزاع عقاري" value={newCase.title} onChange={e => setNewCase(p => ({ ...p, title: e.target.value }))} />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px]">رقم الملف *</Label>
                        <Input className="text-sm h-8" placeholder="مثال: 2026/123" value={newCase.case_number} onChange={e => setNewCase(p => ({ ...p, case_number: e.target.value }))} />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label className="text-[10px]">المحكمة</Label>
                        <Input className="text-sm h-8" placeholder="مثال: المحكمة الابتدائية" value={newCase.court} onChange={e => setNewCase(p => ({ ...p, court: e.target.value }))} />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px]">نوع الملف</Label>
                        <Select value={newCase.case_type} onValueChange={v => setNewCase(p => ({ ...p, case_type: v }))}>
                          <SelectTrigger className="text-sm h-8"><SelectValue placeholder="اختر" /></SelectTrigger>
                          <SelectContent>
                            {['مدني', 'جنائي', 'تجاري', 'أسري', 'إداري', 'عقاري', 'اجتماعي', 'استعجالي', 'أخرى'].map(t => (
                              <SelectItem key={t} value={t}>{t}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button type="button" size="sm" className="flex-1 gap-1 text-xs" disabled={!newCase.title.trim() || !newCase.case_number.trim() || creatingCase} onClick={handleCreateCase}>
                        {creatingCase ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                        إنشاء وإضافة
                      </Button>
                      <Button type="button" variant="ghost" size="sm" className="text-xs" onClick={() => setShowNewCase(false)}>إلغاء</Button>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Per-Case Blocks */}
            {caseBlocks.map((block, blockIdx) => {
              const caseInfo = cases.find(c => c.id === block.caseId);
              const calc = caseCalcs[blockIdx];
              return (
                <Card key={block.caseId} className="border-primary/20">
                  <div
                    className="flex items-center justify-between px-3 py-2 cursor-pointer bg-muted/30 rounded-t-lg"
                    onClick={() => toggleCollapse(block.caseId)}
                  >
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <Badge variant="outline" className="text-[10px] shrink-0 bg-primary/10 text-primary">
                        ملف {blockIdx + 1}
                      </Badge>
                      <span className="text-xs font-semibold truncate">
                        {caseInfo?.title} — {caseInfo?.case_number}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs font-bold text-primary">
                        {calc?.totalAmount.toLocaleString('ar-u-nu-latn', { minimumFractionDigits: 2 })} د
                      </span>
                      <button
                        onClick={e => { e.stopPropagation(); removeCase(block.caseId); }}
                        className="hover:text-destructive"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                      {block.collapsed ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
                    </div>
                  </div>

                  {!block.collapsed && (
                    <CardContent className="pt-3 space-y-3">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label className="text-xs font-semibold">المصاريف القضائية</Label>
                          <Button type="button" variant="ghost" size="sm" onClick={() => addCaseItem(block.caseId)} className="h-6 text-[10px] gap-1">
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
                              className="h-5 text-[9px] px-1.5"
                              onClick={() => addCommonExpense(block.caseId, exp)}
                            >
                              {exp}
                            </Button>
                          ))}
                        </div>

                        <div className="space-y-1.5 max-h-36 overflow-y-auto">
                          {block.items.map((item, idx) => (
                            <div key={idx} className="flex gap-2 items-center">
                              <Input
                                placeholder="البيان"
                                value={item.description}
                                onChange={e => updateCaseItem(block.caseId, idx, 'description', e.target.value)}
                                className="text-xs flex-1 h-8"
                              />
                              <Input
                                type="number"
                                placeholder="المبلغ"
                                min="0"
                                step="0.01"
                                value={item.amount}
                                onChange={e => updateCaseItem(block.caseId, idx, 'amount', e.target.value)}
                                className="text-xs w-20 h-8"
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0 text-destructive"
                                onClick={() => removeCaseItem(block.caseId, idx)}
                                disabled={block.items.length <= 1}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          ))}
                        </div>

                        <div className="text-[10px] text-muted-foreground">
                          مجموع المصاريف: <span className="font-bold text-foreground">
                            {(calc?.expensesTotal || 0).toLocaleString('ar-u-nu-latn')} درهم
                          </span>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-2">
                        <div className="space-y-1">
                          <Label className="text-[10px]">أتعاب المحامي (درهم)</Label>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            placeholder="0.00"
                            value={block.lawyerFees}
                            onChange={e => updateCaseBlock(block.caseId, 'lawyerFees', e.target.value)}
                            className="text-xs h-8"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px]">TVA ({TAX_RATE}%)</Label>
                          <div className="h-8 flex items-center justify-center rounded-md border bg-muted/30 text-xs text-destructive font-semibold">
                            {(calc?.taxAmount || 0).toLocaleString('ar-u-nu-latn', { minimumFractionDigits: 2 })} د
                          </div>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px]">المجموع الكلي</Label>
                          <div className="h-8 flex items-center justify-center rounded-md border bg-primary/10 text-xs font-bold text-primary">
                            {(calc?.totalAmount || 0).toLocaleString('ar-u-nu-latn', { minimumFractionDigits: 2 })} د
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  )}
                </Card>
              );
            })}

            {/* Grand Total */}
            {caseBlocks.length > 0 && (
              <div className="rounded-lg border-2 border-primary/30 bg-primary/5 p-3 space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">مجموع الأتعاب والمصاريف HT</span>
                  <span className="font-bold">{grandTotal.subtotal.toLocaleString('ar-u-nu-latn', { minimumFractionDigits: 2 })} د</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">مجموع TVA ({TAX_RATE}%)</span>
                  <span className="font-bold text-destructive">{grandTotal.taxAmount.toLocaleString('ar-u-nu-latn', { minimumFractionDigits: 2 })} د</span>
                </div>
                <div className="flex justify-between text-sm border-t pt-1.5">
                  <span className="font-bold">المبلغ الإجمالي TTC</span>
                  <span className="font-bold text-primary text-base">{grandTotal.totalAmount.toLocaleString('ar-u-nu-latn', { minimumFractionDigits: 2 })} د</span>
                </div>
              </div>
            )}

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

            <Button onClick={handleShowPreview} disabled={!canSubmit} className="w-full gap-2">
              <Eye className="h-4 w-4" /> معاينة البيان قبل الإصدار
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default CreateFeeStatementDialog;
