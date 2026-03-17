import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, ShieldCheck, ShieldX, Receipt, ArrowRight } from 'lucide-react';
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
    <div className="min-h-screen bg-background flex items-center justify-center p-4" dir="rtl">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center pb-2">
          {invoice ? (
            <div className="flex flex-col items-center gap-2">
              <div className="h-16 w-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <ShieldCheck className="h-8 w-8 text-green-600 dark:text-green-400" />
              </div>
              <CardTitle className="text-green-700 dark:text-green-400">وصل موثّق ✓</CardTitle>
              <p className="text-xs text-muted-foreground">تم التحقق من صحة هذا الوصل بنجاح</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <div className="h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center">
                <ShieldX className="h-8 w-8 text-destructive" />
              </div>
              <CardTitle className="text-destructive">وصل غير موجود</CardTitle>
              <p className="text-xs text-muted-foreground">لم يتم العثور على وصل مطابق لهذا الرمز</p>
            </div>
          )}
        </CardHeader>

        {invoice && (
          <CardContent className="space-y-3 pt-4">
            <Row label="رقم الوصل" value={invoice.invoice_number} mono />
            <Row label="المبلغ" value={`${Number(invoice.amount).toLocaleString('ar-u-nu-latn')} درهم`} bold />
            <Row label="طريقة الأداء" value={PAYMENT_LABELS[invoice.payment_method] || invoice.payment_method} />
            <Row label="الموكل" value={invoice.clients?.full_name} />
            <Row label="الملف" value={invoice.cases?.title} />
            {invoice.cases?.case_number && <Row label="رقم الملف" value={invoice.cases.case_number} />}
            <Row label="المحامي" value={invoice.letterheads?.lawyer_name} />
            <Row label="التاريخ" value={formatDateShort(invoice.created_at)} />
            {invoice.description && <Row label="البيان" value={invoice.description} />}
            <div className="flex justify-center pt-2">
              <Badge variant="outline" className="text-xs">{invoice.status === 'paid' ? 'مؤدى' : invoice.status}</Badge>
            </div>
          </CardContent>
        )}

        <div className="p-4 pt-0 text-center">
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
    <div className="flex justify-between items-center text-sm border-b border-border/50 pb-2">
      <span className="text-muted-foreground">{label}</span>
      <span className={`${mono ? 'font-mono text-xs' : ''} ${bold ? 'font-bold text-primary' : 'text-foreground'}`}>{value}</span>
    </div>
  );
};

export default VerifyInvoice;
