import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollText, Search, Download, Copy, FileText, Shield, Users, DollarSign } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

interface AuditRecord {
  id: string;
  invoice_number: string;
  signature_uuid: string | null;
  security_seal: string | null;
  client_name_ar: string | null;
  client_name_fr: string | null;
  client_cin: string | null;
  amount: number;
  payment_method: string | null;
  case_number: string | null;
  lawyer_name: string | null;
  pdf_path: string | null;
  user_agent: string | null;
  issued_at: string;
  created_at: string;
}

const PAYMENT_LABELS: Record<string, string> = {
  cash: 'نقداً', check: 'شيك', transfer: 'تحويل', card: 'بطاقة',
};

const AuditLog = () => {
  const { user } = useAuth();
  const [records, setRecords] = useState<AuditRecord[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from('invoice_receipts_audit')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500);
      setRecords((data as AuditRecord[]) || []);
      setLoading(false);
    })();
  }, [user]);

  const filtered = records.filter(r => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      r.invoice_number.toLowerCase().includes(s) ||
      r.client_name_ar?.toLowerCase().includes(s) ||
      r.client_name_fr?.toLowerCase().includes(s) ||
      r.security_seal?.toLowerCase().includes(s) ||
      r.case_number?.toLowerCase().includes(s)
    );
  });

  const totalAmount = filtered.reduce((s, r) => s + Number(r.amount), 0);
  const uniqueClients = new Set(filtered.map(r => r.client_name).filter(Boolean)).size;
  const withPdf = filtered.filter(r => r.pdf_path).length;

  const copyHash = (hash: string) => {
    navigator.clipboard.writeText(hash);
    toast.success('تم نسخ الختم الأمني');
  };

  const exportCSV = () => {
    const headers = ['رقم الوصل', 'الموكل', 'CIN', 'المبلغ', 'طريقة الأداء', 'رقم الملف', 'المحامي', 'الختم الأمني', 'التاريخ'];
    const rows = filtered.map(r => [
      r.invoice_number, r.client_name || '', r.client_cin || '', r.amount,
      PAYMENT_LABELS[r.payment_method || ''] || r.payment_method || '', r.case_number || '',
      r.lawyer_name || '', r.security_hash, new Date(r.created_at).toLocaleString('ar-MA'),
    ]);
    const csv = '\uFEFF' + [headers, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('تم تصدير الأرشيف');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">أرشيف الوصولات</h1>
          <p className="text-muted-foreground text-sm">سجل قانوني غير قابل للتعديل أو الحذف</p>
        </div>
        <Button variant="outline" size="sm" onClick={exportCSV} disabled={filtered.length === 0}>
          <Download className="h-4 w-4 ml-1.5" /> تصدير CSV
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="p-4 flex items-center gap-3">
          <ScrollText className="h-8 w-8 text-primary" />
          <div><p className="text-2xl font-bold">{filtered.length}</p><p className="text-xs text-muted-foreground">وصل</p></div>
        </CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3">
          <DollarSign className="h-8 w-8 text-emerald-500" />
          <div><p className="text-2xl font-bold">{totalAmount.toLocaleString('ar-u-nu-latn')}</p><p className="text-xs text-muted-foreground">درهم</p></div>
        </CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3">
          <Users className="h-8 w-8 text-blue-500" />
          <div><p className="text-2xl font-bold">{uniqueClients}</p><p className="text-xs text-muted-foreground">موكل</p></div>
        </CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3">
          <FileText className="h-8 w-8 text-amber-500" />
          <div><p className="text-2xl font-bold">{withPdf}</p><p className="text-xs text-muted-foreground">مع PDF</p></div>
        </CardContent></Card>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="بحث بالاسم أو رقم الوصل أو الختم..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pr-10"
        />
      </div>

      {/* Records */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Shield className="h-5 w-5" /> السجلات ({filtered.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <p className="text-center text-muted-foreground py-12">جاري التحميل...</p>
          ) : filtered.length === 0 ? (
            <p className="text-center text-muted-foreground py-12">لا توجد سجلات بعد</p>
          ) : (
            <div className="divide-y">
              {filtered.map(r => (
                <div key={r.id} className="px-4 py-3 hover:bg-muted/30 transition-colors">
                  <div
                    className="flex items-center justify-between cursor-pointer"
                    onClick={() => setExpandedId(expandedId === r.id ? null : r.id)}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Badge variant="secondary" className="shrink-0 font-mono text-xs">{r.invoice_number}</Badge>
                      <span className="text-sm truncate">{r.client_name || '—'}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-sm font-bold">{Number(r.amount).toLocaleString('ar-u-nu-latn')} د</span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(r.created_at).toLocaleDateString('ar-MA')}
                      </span>
                    </div>
                  </div>
                  {expandedId === r.id && (
                    <div className="mt-3 p-3 rounded-lg bg-muted/50 space-y-2 text-sm">
                      <div className="grid grid-cols-2 gap-2">
                        <div><span className="text-muted-foreground">CIN:</span> {r.client_cin || '—'}</div>
                        <div><span className="text-muted-foreground">الأداء:</span> {PAYMENT_LABELS[r.payment_method || ''] || r.payment_method || '—'}</div>
                        <div><span className="text-muted-foreground">الملف:</span> {r.case_number || '—'}</div>
                        <div><span className="text-muted-foreground">المحامي:</span> {r.lawyer_name || '—'}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground text-xs">الختم:</span>
                        <code className="text-[10px] font-mono bg-background px-2 py-0.5 rounded truncate flex-1">{r.security_hash}</code>
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => copyHash(r.security_hash)}>
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(r.created_at).toLocaleString('ar-MA')}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AuditLog;
