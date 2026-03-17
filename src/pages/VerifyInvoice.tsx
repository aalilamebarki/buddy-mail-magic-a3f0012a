import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, ShieldCheck, ShieldX, ArrowRight } from 'lucide-react';
import { formatDateShort } from '@/lib/formatters';

const PAYMENT_LABELS: Record<string, string> = {
  cash: 'نقداً',
  check: 'شيك',
  transfer: 'تحويل بنكي',
  card: 'بطاقة بنكية',
};

const VerifyInvoice = () => {
  const { uuid } = useParams<{ uuid: string }>();
  const [loading, setLoading] = useState(true);
  const [invoice, setInvoice] = useState<any>(null);

  useEffect(() => {
    if (!uuid) return;
    const verify = async () => {
      const { data } = await supabase
        .from('invoices')
        .select('invoice_number, amount, payment_method, created_at, description, status, clients(full_name), cases(title, case_number), letterheads(lawyer_name)')
        .eq('signature_uuid', uuid)
        .maybeSingle();
      setInvoice(data);
      setLoading(false);
    };
    verify();
  }, [uuid]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-muted/40 to-background flex items-center justify-center p-4" dir="rtl">
      <Card className="w-full max-w-md shadow-xl border-2">
        {/* Top accent bar */}
        <div className="h-2 bg-gradient-to-l from-primary to-primary/60 rounded-t-lg" />

        <CardHeader className="text-center pb-3 pt-6">
          {invoice ? (
            <div className="flex flex-col items-center gap-3">
              <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center ring-4 ring-primary/20">
                <ShieldCheck className="h-10 w-10 text-primary" />
              </div>
              <CardTitle className="text-xl text-primary">وصل موثّق ✓</CardTitle>
              <p className="text-xs text-muted-foreground">تم التحقق من صحة هذا الوصل بنجاح</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3">
              <div className="h-20 w-20 rounded-full bg-destructive/10 flex items-center justify-center ring-4 ring-destructive/20">
                <ShieldX className="h-10 w-10 text-destructive" />
              </div>
              <CardTitle className="text-xl text-destructive">وصل غير موجود</CardTitle>
              <p className="text-xs text-muted-foreground">لم يتم العثور على وصل مطابق لهذا الرمز</p>
            </div>
          )}
        </CardHeader>

        {invoice && (
          <CardContent className="space-y-0 pt-2 px-6">
            {/* Lawyer name header */}
            {invoice.letterheads?.lawyer_name && (
              <div className="text-center pb-4 mb-4 border-b-2 border-primary/20">
                <p className="text-sm font-semibold text-primary">{invoice.letterheads.lawyer_name}</p>
                <p className="text-[10px] text-muted-foreground">محامٍ لدى محاكم المملكة المغربية</p>
              </div>
            )}

            <div className="space-y-3">
              <Row label="رقم الوصل" value={invoice.invoice_number} mono />
              <Row label="المبلغ" value={`${Number(invoice.amount).toLocaleString('ar-u-nu-latn')} درهم`} bold />
              <Row label="طريقة الأداء" value={PAYMENT_LABELS[invoice.payment_method] || invoice.payment_method} />
              <Row label="الموكل" value={invoice.clients?.full_name} />
              <Row label="الملف" value={invoice.cases?.title} />
              {invoice.cases?.case_number && <Row label="رقم الملف" value={invoice.cases.case_number} />}
              <Row label="التاريخ" value={formatDateShort(invoice.created_at)} />
              {invoice.description && <Row label="البيان" value={invoice.description} />}
            </div>

            <div className="flex justify-center pt-4 mt-3">
              <Badge
                variant={invoice.status === 'paid' ? 'default' : 'outline'}
                className="text-xs px-4 py-1"
              >
                {invoice.status === 'paid' ? '✓ مؤدى' : invoice.status}
              </Badge>
            </div>
          </CardContent>
        )}

        <div className="p-5 pt-3 text-center">
          <Link to="/" className="text-xs text-primary hover:underline inline-flex items-center gap-1">
            الرئيسية <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </Card>
    </div>
  );
};

const Row = ({ label, value, mono, bold }: { label: string; value?: string | null; mono?: boolean; bold?: boolean }) => {
  if (!value) return null;
  return (
    <div className="flex justify-between items-center text-sm py-2.5 border-b border-border/40 last:border-b-0">
      <span className="text-muted-foreground text-xs">{label}</span>
      <span className={`${mono ? 'font-mono text-xs tracking-wider' : ''} ${bold ? 'font-bold text-base text-primary' : 'text-foreground font-medium'}`}>
        {value}
      </span>
    </div>
  );
};

export default VerifyInvoice;
