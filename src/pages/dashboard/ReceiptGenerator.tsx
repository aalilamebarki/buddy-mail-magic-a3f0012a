import { useState, useRef, useCallback, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
import {
  Receipt, Download, Printer, Loader2, Plus, AlertCircle, QrCode,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useClients } from '@/hooks/useClients';
import { useCases } from '@/hooks/useCases';
import { useLetterheadOptions, useInvoices } from '@/hooks/useInvoices';
import { useFeeStatements } from '@/hooks/useFeeStatements';
import { generateInvoicePDF } from '@/lib/generate-invoice-pdf';
import { formatDateArabic } from '@/lib/formatters';
import { supabase } from '@/integrations/supabase/client';
import CreateCaseDialog from '@/components/cases/CreateCaseDialog';

/* ── Tafkeet (number to Arabic words) ── */
const numberToArabicWords = (num: number): string => {
  if (num === 0) return 'صفر درهم';
  const ones = ['', 'واحد', 'اثنان', 'ثلاثة', 'أربعة', 'خمسة', 'ستة', 'سبعة', 'ثمانية', 'تسعة'];
  const teens = ['عشرة', 'أحد عشر', 'اثنا عشر', 'ثلاثة عشر', 'أربعة عشر', 'خمسة عشر', 'ستة عشر', 'سبعة عشر', 'ثمانية عشر', 'تسعة عشر'];
  const tens = ['', '', 'عشرون', 'ثلاثون', 'أربعون', 'خمسون', 'ستون', 'سبعون', 'ثمانون', 'تسعون'];
  const hundreds = ['', 'مائة', 'مائتان', 'ثلاثمائة', 'أربعمائة', 'خمسمائة', 'ستمائة', 'سبعمائة', 'ثمانمائة', 'تسعمائة'];
  const parts: string[] = [];
  const millions = Math.floor(num / 1000000);
  const thousands = Math.floor((num % 1000000) / 1000);
  const remainder = Math.floor(num % 1000);
  if (millions > 0) {
    if (millions === 1) parts.push('مليون');
    else if (millions === 2) parts.push('مليونان');
    else parts.push(`${ones[millions]} ملايين`);
  }
  if (thousands > 0) {
    if (thousands === 1) parts.push('ألف');
    else if (thousands === 2) parts.push('ألفان');
    else if (thousands >= 3 && thousands <= 10) parts.push(`${ones[thousands]} آلاف`);
    else {
      const tH = Math.floor(thousands / 100);
      const tR = thousands % 100;
      const tP: string[] = [];
      if (tH > 0) tP.push(hundreds[tH]);
      if (tR >= 10 && tR < 20) tP.push(teens[tR - 10]);
      else {
        const tO = tR % 10, tT = Math.floor(tR / 10);
        if (tO > 0) tP.push(ones[tO]);
        if (tT > 0) tP.push(tens[tT]);
      }
      parts.push(tP.join(' و') + ' ألف');
    }
  }
  if (remainder > 0) {
    const rH = Math.floor(remainder / 100), rR = remainder % 100;
    if (rH > 0) parts.push(hundreds[rH]);
    if (rR >= 10 && rR < 20) parts.push(teens[rR - 10]);
    else {
      const rO = rR % 10, rT = Math.floor(rR / 10);
      if (rO > 0 && rT > 0) parts.push(`${ones[rO]} و${tens[rT]}`);
      else if (rO > 0) parts.push(ones[rO]);
      else if (rT > 0) parts.push(tens[rT]);
    }
  }
  return `فقط ${parts.join(' و')} درهم مغربي لا غير.`;
};

const PAYMENT_METHODS = [
  { value: 'cash', label: 'نقداً' },
  { value: 'check', label: 'شيك' },
  { value: 'transfer', label: 'تحويل بنكي' },
  { value: 'card', label: 'بطاقة بنكية' },
];

const ReceiptGenerator = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { clients } = useClients();
  const { cases, refetch: refetchCases } = useCases({ withClients: false });
  const letterheads = useLetterheadOptions();
  const { invoices: allInvoices } = useInvoices();
  const { statements } = useFeeStatements();
  const previewRef = useRef<HTMLDivElement>(null);
  const [showCaseDialog, setShowCaseDialog] = useState(false);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    clientId: '',
    caseId: '',
    letterheadId: '',
    feeStatementId: '',
    amount: '',
    description: '',
    paymentMethod: 'cash',
    city: '',
  });

  const update = (field: string, value: string) => setForm(prev => ({ ...prev, [field]: value }));

  const client = clients.find(c => c.id === form.clientId);
  const caseItem = cases.find(c => c.id === form.caseId);
  const letterhead = letterheads.find(l => l.id === form.letterheadId);
  const amount = parseFloat(form.amount) || 0;
  const paymentLabel = PAYMENT_METHODS.find(m => m.value === form.paymentMethod)?.label || form.paymentMethod;

  // Auto-set city from letterhead
  const city = form.city || letterhead?.city || '';

  const filteredCases = form.clientId ? cases.filter(c => c.client_id === form.clientId) : cases;

  const clientStatements = useMemo(() => {
    if (!form.clientId) return [];
    return statements.filter(s => s.client_id === form.clientId);
  }, [form.clientId, statements]);

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

  const feeStatementOptions = useMemo(() => {
    return clientStatements.map(s => {
      const paidSoFar = allInvoices
        .filter(inv => inv.fee_statement_id === s.id)
        .reduce((sum, inv) => sum + Number(inv.amount), 0);
      const remaining = Math.max(0, Number(s.total_amount) - paidSoFar);
      return {
        value: s.id,
        label: s.statement_number,
        sublabel: remaining > 0 ? `متبقي: ${remaining.toLocaleString('ar-u-nu-latn')} د` : '✅ مؤدى بالكامل',
      };
    });
  }, [clientStatements, allInvoices]);

  const canSubmit = form.clientId && form.letterheadId && form.amount && amount > 0;

  const handleClientChange = (v: string) => {
    setForm(prev => ({ ...prev, clientId: v, feeStatementId: '', caseId: '' }));
  };

  const handleFeeStatementChange = (v: string) => {
    update('feeStatementId', v);
    if (v) {
      const stmt = statements.find(s => s.id === v);
      if (stmt) {
        const paidSoFar = allInvoices.filter(inv => inv.fee_statement_id === v).reduce((sum, inv) => sum + Number(inv.amount), 0);
        const remaining = Math.max(0, Number(stmt.total_amount) - paidSoFar);
        if (remaining > 0) update('amount', String(remaining));
        if (stmt.case_id && !form.caseId) update('caseId', stmt.case_id);
      }
    }
  };

  const handleSubmitAndDownload = async () => {
    if (!user || !canSubmit) return;
    setSaving(true);
    try {
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

      // Upload PDF
      const pdfPath = `${user.id}/${invoice.id}.pdf`;
      await supabase.storage.from('invoices').upload(pdfPath, pdfBlob, { contentType: 'application/pdf' });
      await supabase.from('invoices').update({ pdf_path: pdfPath }).eq('id', invoice.id);

      // Download
      const url = URL.createObjectURL(pdfBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${invoiceNumber}.pdf`;
      link.click();
      URL.revokeObjectURL(url);

      toast({ title: 'تم إنشاء الوصل وتحميله بنجاح ✅' });
    } catch (e: any) {
      toast({ title: 'خطأ', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handlePrint = () => {
    if (!previewRef.current) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.write(`
      <html dir="rtl"><head>
        <link href="https://fonts.googleapis.com/css2?family=Amiri:wght@400;700&display=swap" rel="stylesheet">
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: 'Amiri', serif; direction: rtl; padding: 20mm; }
          @media print { body { padding: 10mm; } }
        </style>
      </head><body>${previewRef.current.innerHTML}</body></html>
    `);
    printWindow.document.close();
    printWindow.onload = () => { printWindow.print(); printWindow.close(); };
  };

  const dateStr = formatDateArabic(new Date(), { year: 'numeric', month: 'long', day: 'numeric' });

  const clientOptions = clients.map(c => ({ value: c.id, label: c.full_name, sublabel: c.phone || c.email || undefined }));
  const caseOptions = filteredCases.map(c => ({ value: c.id, label: c.title, sublabel: c.case_number ? `ملف: ${c.case_number}` : undefined }));
  const letterheadOptions = letterheads.map(l => ({ value: l.id, label: l.lawyer_name }));

  const lawyerNameAr = letterhead?.lawyer_name || 'الأستاذ ..................';
  const lawyerNameFr = letterhead?.name_fr || '';
  const titleAr = letterhead?.title_ar || '';
  const titleFr = letterhead?.title_fr || '';
  const barAr = letterhead?.bar_name_ar || '';
  const barFr = letterhead?.bar_name_fr || '';
  const lhAddress = letterhead?.address || '';
  const lhPhone = letterhead?.phone || '';
  const lhEmail = letterhead?.email || '';
  const lhCity = city;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Receipt className="h-5 w-5 text-primary" />
            مُصدر الوصولات
          </h1>
          <p className="text-muted-foreground text-xs mt-1">إنشاء وصولات أداء بمعاينة حية وتحميل PDF</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handlePrint} disabled={!canSubmit} className="gap-1.5">
            <Printer className="h-4 w-4" /> طباعة
          </Button>
          <Button size="sm" onClick={handleSubmitAndDownload} disabled={!canSubmit || saving} className="gap-1.5">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            {saving ? 'جاري الإنشاء...' : 'إصدار وتحميل PDF'}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ═══ LEFT: FORM ═══ */}
        <Card className="order-2 lg:order-1">
          <CardContent className="pt-5 space-y-4">
            <h2 className="text-sm font-semibold text-foreground border-b border-border pb-2">بيانات الوصل</h2>

            {/* Letterhead */}
            <div className="space-y-1.5">
              <Label className="text-xs">الترويسة *</Label>
              <SearchableSelect options={letterheadOptions} value={form.letterheadId} onValueChange={v => update('letterheadId', v)} placeholder="اختر الترويسة" searchPlaceholder="ابحث..." />
            </div>

            {/* Client */}
            <div className="space-y-1.5">
              <Label className="text-xs">الموكل *</Label>
              <SearchableSelect options={clientOptions} value={form.clientId} onValueChange={handleClientChange} placeholder="اختر الموكل" searchPlaceholder="ابحث باسم الموكل..." />
            </div>

            {/* Fee Statement */}
            {form.clientId && clientStatements.length > 0 && (
              <div className="space-y-1.5">
                <Label className="text-xs flex items-center gap-1.5">
                  ربط ببيان أتعاب <Badge variant="outline" className="text-[10px] font-normal">اختياري</Badge>
                </Label>
                <SearchableSelect
                  options={[{ value: '__none__', label: 'بدون ربط' }, ...feeStatementOptions]}
                  value={form.feeStatementId || '__none__'}
                  onValueChange={v => handleFeeStatementChange(v === '__none__' ? '' : v)}
                  placeholder="اختر بيان أتعاب"
                  searchPlaceholder="ابحث برقم البيان..."
                />
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
                    <Progress value={selectedStatementInfo.progress} className="h-1.5" />
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] text-muted-foreground">{selectedStatementInfo.progress}% مؤدى</span>
                      <span className="text-xs font-bold">متبقي: {selectedStatementInfo.remaining.toLocaleString('ar-u-nu-latn')} د</span>
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

            {/* Case */}
            <div className="space-y-1.5">
              <Label className="text-xs">الملف</Label>
              <div className="flex gap-2">
                <div className="flex-1">
                  <SearchableSelect options={caseOptions} value={form.caseId} onValueChange={v => update('caseId', v)} placeholder="ربط بملف (اختياري)" searchPlaceholder="ابحث..." />
                </div>
                <Button variant="outline" size="icon" className="shrink-0 h-10 w-10" onClick={() => setShowCaseDialog(true)}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <Separator />

            {/* Amount */}
            <div className="space-y-1.5">
              <Label className="text-xs">المبلغ (درهم) *</Label>
              <Input
                type="number"
                placeholder="0.00"
                value={form.amount}
                onChange={e => update('amount', e.target.value)}
                className="text-lg font-bold"
                dir="ltr"
              />
              {amount > 0 && (
                <p className="text-xs text-muted-foreground bg-muted/50 rounded-md px-2 py-1.5 leading-relaxed">
                  {numberToArabicWords(amount)}
                </p>
              )}
            </div>

            {/* Payment Method */}
            <div className="space-y-1.5">
              <Label className="text-xs">طريقة الأداء</Label>
              <Select value={form.paymentMethod} onValueChange={v => update('paymentMethod', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent dir="rtl">
                  {PAYMENT_METHODS.map(m => (
                    <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* City override */}
            <div className="space-y-1.5">
              <Label className="text-xs">المدينة</Label>
              <Input placeholder={letterhead?.city || 'المدينة'} value={form.city} onChange={e => update('city', e.target.value)} />
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <Label className="text-xs">البيان (اختياري)</Label>
              <Textarea placeholder="بيان أو ملاحظات..." value={form.description} onChange={e => update('description', e.target.value)} rows={2} />
            </div>
          </CardContent>
        </Card>

        {/* ═══ RIGHT: LIVE PREVIEW ═══ */}
        <div className="order-1 lg:order-2 lg:sticky lg:top-6 self-start">
          <div className="mb-2 flex items-center gap-2">
            <Badge variant="outline" className="text-[10px]">معاينة حية</Badge>
          </div>
          <div
            ref={previewRef}
            className="bg-white text-black rounded-lg shadow-lg border overflow-hidden"
            style={{
              fontFamily: "'Amiri', serif",
              direction: 'rtl',
              aspectRatio: '210/297',
              maxHeight: '80vh',
              padding: '6%',
              fontSize: '11px',
            }}
          >
            {/* ── Bilingual Header ── */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
              {/* Arabic (right) */}
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '16px', fontWeight: 700, color: '#1a2b3c' }}>
                  الأستاذ {letterhead?.lawyer_name || '..................'}
                </div>
                {titleAr && <div style={{ fontSize: '10px', color: '#666', marginTop: '2px' }}>{titleAr}</div>}
                {barAr && <div style={{ fontSize: '10px', color: '#666' }}>هيئة {barAr}</div>}
              </div>
              {/* French (left) */}
              <div style={{ textAlign: 'left', direction: 'ltr' }}>
                {lawyerNameFr && <div style={{ fontSize: '12px', fontWeight: 700, color: '#1a2b3c' }}>Maître {lawyerNameFr}</div>}
                {titleFr && <div style={{ fontSize: '9px', color: '#666', marginTop: '2px' }}>{titleFr}</div>}
                {barFr && <div style={{ fontSize: '9px', color: '#666' }}>au Barreau de {barFr}</div>}
                {lhPhone && <div style={{ fontSize: '8px', color: '#888', marginTop: '2px' }}>Tél: {lhPhone}</div>}
              </div>
            </div>

            {/* Separator lines */}
            <div style={{ borderTop: '2px solid #1a2b3c', marginBottom: '3px' }} />
            <div style={{ borderTop: '1px solid #1a2b3c', width: '60%', margin: '0 auto 6px' }} />

            {/* Address centered */}
            {lhAddress && (
              <div style={{ textAlign: 'center', fontSize: '9px', color: '#333', marginBottom: '2px' }}>
                {lhAddress}{lhCity ? ` - ${lhCity}` : ''}
              </div>
            )}
            {lhEmail && (
              <div style={{ textAlign: 'center', fontSize: '8px', color: '#888', marginBottom: '6px' }}>
                E-mail : {lhEmail}
              </div>
            )}

            {/* City & Date */}
            <div style={{ textAlign: 'right', fontSize: '10px', marginBottom: '16px', color: '#333' }}>
              {lhCity ? `${lhCity} في: ${dateStr}` : dateStr}
            </div>

            {/* ── Title ── */}
            <div style={{ textAlign: 'center', marginBottom: '16px' }}>
              <div style={{ fontSize: '22px', fontWeight: 700, color: '#1a2b3c', letterSpacing: '2px' }}>
                وصل أداء
              </div>
              <div style={{ width: '50px', height: '2px', background: '#1a2b3c', margin: '4px auto' }} />
            </div>

            {/* ── Client Info Box ── */}
            <div style={{
              background: '#f7f8fa',
              borderRight: '4px solid #1a2b3c',
              padding: '10px 14px',
              marginBottom: '14px',
              borderRadius: '4px',
            }}>
              <div style={{ fontSize: '12px', marginBottom: '6px' }}>
                <span style={{ color: '#888' }}>الموكل(ة): </span>
                <span style={{ fontWeight: 700 }}>{client?.full_name || '..................'}</span>
              </div>
              {caseItem?.case_number && (
                <div style={{ fontSize: '11px', marginBottom: '4px' }}>
                  <span style={{ color: '#888' }}>رقم الملف: </span>
                  <span dir="ltr" style={{ fontWeight: 600 }}>{caseItem.case_number}</span>
                </div>
              )}
              {(caseItem?.case_type || caseItem?.title) && (
                <div style={{ fontSize: '11px' }}>
                  <span style={{ color: '#888' }}>الموضوع: </span>
                  <span>{caseItem.case_type || caseItem.title}</span>
                </div>
              )}
            </div>

            {/* ── Amount Section ── */}
            <div style={{ borderTop: '1px solid #ddd', paddingTop: '10px', marginBottom: '10px' }}>
              <div style={{ fontSize: '11px', color: '#888', marginBottom: '4px' }}>المبلغ المستلم:</div>
              <div style={{ fontSize: '20px', fontWeight: 700, color: '#1a2b3c', marginBottom: '4px' }}>
                {amount > 0 ? `${amount.toLocaleString('fr-MA', { minimumFractionDigits: 2 })} درهم` : '.................. درهم'}
              </div>
              {amount > 0 && (
                <div style={{ fontSize: '9px', color: '#888', lineHeight: '1.5', marginBottom: '6px' }}>
                  {numberToArabicWords(amount)}
                </div>
              )}
              <div style={{ fontSize: '11px' }}>
                <span style={{ color: '#888' }}>طريقة الأداء: </span>
                <span style={{ fontWeight: 600 }}>{paymentLabel}</span>
              </div>
              {form.description && (
                <div style={{ fontSize: '10px', color: '#888', marginTop: '4px' }}>
                  البيان: {form.description}
                </div>
              )}
            </div>

            <div style={{ borderTop: '1px solid #ddd', marginBottom: '10px' }} />

            {/* ── Legal Text ── */}
            <div style={{ fontSize: '10px', lineHeight: '1.8', color: '#333', marginBottom: '14px' }}>
              يشهد مكتب الأستاذ {letterhead?.lawyer_name || '......'} باستلام المبلغ المذكور أعلاه من السيد(ة) {client?.full_name || '......'}، وذلك رسم مستحقات الملف المشار إليه أعلاه، ويعتبر هذا الوصل بمثابة إبراء ذمة بخصوص هذا الدفع.
            </div>

            {/* ── Signature & QR ── */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: '20px' }}>
              {/* QR Placeholder */}
              <div style={{ textAlign: 'center' }}>
                <div style={{
                  width: '52px', height: '52px',
                  border: '1px dashed #ccc',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  borderRadius: '4px',
                }}>
                  <QrCode style={{ width: '28px', height: '28px', color: '#bbb' }} />
                </div>
                <div style={{ fontSize: '7px', color: '#bbb', marginTop: '2px' }}>رمز التحقق</div>
              </div>

              {/* Signature */}
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '11px', fontWeight: 600, marginBottom: '20px' }}>التوقيع والختم</div>
                <div style={{
                  width: '120px',
                  borderBottom: '2px dotted #ccc',
                }} />
              </div>
            </div>

            {/* ── Footer ── */}
            <div style={{
              borderTop: '1px solid #ddd',
              marginTop: '16px',
              paddingTop: '4px',
              textAlign: 'center',
              fontSize: '7px',
              color: '#bbb',
            }}>
              وثيقة موقعة إلكترونياً
            </div>
          </div>
        </div>
      </div>

      <CreateCaseDialog
        open={showCaseDialog}
        onOpenChange={setShowCaseDialog}
        onCreated={() => { refetchCases(); setShowCaseDialog(false); }}
      />
    </div>
  );
};

export default ReceiptGenerator;
