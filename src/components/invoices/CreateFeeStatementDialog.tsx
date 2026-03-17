import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, FileText, Plus, Trash2, X, ChevronDown, ChevronUp } from 'lucide-react';
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
  items: ExpenseItem[];
  collapsed: boolean;
}

const COMMON_EXPENSES = [
  'مقال افتتاحي', 'رسوم التسجيل', 'مصاريف التنفيذ', 'رسوم الخبرة',
  'مصاريف التبليغ', 'رسوم الاستئناف', 'واجبات الدمغة', 'مصاريف النقل',
];

const TAX_RATE = 10; // Fixed 10% per case

const CreateFeeStatementDialog = ({ open, onOpenChange, onCreated, editData }: Props) => {
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
    notes: '',
  });
  const [caseBlocks, setCaseBlocks] = useState<CaseBlock[]>([]);
  const [caseSelectValue, setCaseSelectValue] = useState('');

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
          items: caseItems.length > 0 ? caseItems : [{ description: '', amount: '' }],
          collapsed: false,
        }]);
      }
    } else if (!open) {
      setForm({ clientId: '', letterheadId: '', powerOfAttorneyDate: '', notes: '' });
      setCaseBlocks([]);
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

  const filteredCases = form.clientId ? cases.filter(c => c.client_id === form.clientId) : cases;
  const selectedCaseIds = caseBlocks.map(b => b.caseId);
  const availableCases = filteredCases.filter(c => !selectedCaseIds.includes(c.id));
  const selectedCasesData = cases.filter(c => selectedCaseIds.includes(c.id));

  // Per-case calculations
  const caseCalcs = caseBlocks.map(b => {
    const expensesTotal = b.items.reduce((s, i) => s + (parseFloat(i.amount) || 0), 0);
    const lawyerFees = parseFloat(b.lawyerFees) || 0;
    const subtotal = expensesTotal + lawyerFees;
    const taxAmount = subtotal * TAX_RATE / 100;
    const totalAmount = subtotal + taxAmount;
    return { caseId: b.caseId, expensesTotal, lawyerFees, subtotal, taxAmount, totalAmount };
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
            tax_rate: TAX_RATE,
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
            tax_rate: TAX_RATE,
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
          tax_rate: TAX_RATE,
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
        taxRate: TAX_RATE,
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            {isEdit ? 'تعديل بيان الأتعاب' : 'بيان أتعاب ومصاريف جديد'}
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
            {caseBlocks.length === 0 && (
              <p className="text-[10px] text-destructive">يرجى اختيار ملف واحد على الأقل</p>
            )}
          </div>

          {/* Per-Case Blocks */}
          {caseBlocks.map((block, blockIdx) => {
            const caseInfo = cases.find(c => c.id === block.caseId);
            const calc = caseCalcs[blockIdx];
            return (
              <Card key={block.caseId} className="border-primary/20">
                {/* Case Header */}
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
                    {/* Expenses */}
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

                    {/* Lawyer Fees & Case Total */}
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
                        <div className="h-8 flex items-center justify-center rounded-md border bg-muted/30 text-xs text-orange-600 font-semibold">
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
                <span className="font-bold text-orange-600">{grandTotal.taxAmount.toLocaleString('ar-u-nu-latn', { minimumFractionDigits: 2 })} د</span>
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

          <Button onClick={handleSubmit} disabled={!canSubmit} className="w-full gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
            {saving ? 'جاري الحفظ...' : isEdit ? 'حفظ التعديلات وتحميل PDF' : 'إنشاء البيان وتحميل PDF'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CreateFeeStatementDialog;
