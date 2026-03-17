import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowRight, FileText, User, Scale, MapPin, ClipboardList } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const CaseDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [caseData, setCaseData] = useState<any>(null);
  const [documents, setDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    const fetchCase = async () => {
      const [caseRes, docsRes] = await Promise.all([
        supabase.from('cases').select('*, clients(full_name, phone, email, cin, address)').eq('id', id).single(),
        supabase.from('generated_documents').select('id, title, doc_type, status, created_at, next_court').eq('case_id', id).order('created_at', { ascending: false }),
      ]);
      if (caseRes.error) {
        toast.error('لم يتم العثور على الملف');
        navigate('/dashboard/cases');
        return;
      }
      setCaseData(caseRes.data);
      if (docsRes.data) setDocuments(docsRes.data);
      setLoading(false);
    };
    fetchCase();
  }, [id, navigate]);

  if (loading) return <div className="text-center py-12 text-muted-foreground">جاري التحميل...</div>;
  if (!caseData) return null;

  const clientName = caseData.clients?.full_name || '—';

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => navigate('/dashboard/cases')}>
              <ArrowRight className="h-4 w-4" />
            </Button>
            <h1 className="text-xl md:text-2xl font-bold text-foreground truncate">لفائدة: {clientName}</h1>
          </div>
          <p className="text-sm text-muted-foreground mr-10">ضد: {caseData.opposing_party || '—'}</p>
        </div>
        <div className="flex gap-2 shrink-0">
          {caseData.case_type && <Badge variant="secondary">{caseData.case_type}</Badge>}
          <Badge>{caseData.status}</Badge>
        </div>
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Client Info */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <User className="h-4 w-4" /> بيانات الموكل
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">الاسم:</span><span>{clientName}</span></div>
            {caseData.clients?.phone && <div className="flex justify-between"><span className="text-muted-foreground">الهاتف:</span><span dir="ltr">{caseData.clients.phone}</span></div>}
            {caseData.clients?.email && <div className="flex justify-between"><span className="text-muted-foreground">البريد:</span><span>{caseData.clients.email}</span></div>}
            {caseData.clients?.cin && <div className="flex justify-between"><span className="text-muted-foreground">رقم البطاقة:</span><span>{caseData.clients.cin}</span></div>}
            {caseData.clients?.address && <div className="flex justify-between"><span className="text-muted-foreground">العنوان:</span><span>{caseData.clients.address}</span></div>}
          </CardContent>
        </Card>

        {/* Opposing Party */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Scale className="h-4 w-4" /> بيانات الخصم
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">الاسم:</span><span>{caseData.opposing_party || '—'}</span></div>
            {caseData.opposing_party_address && <div className="flex justify-between"><span className="text-muted-foreground">العنوان:</span><span>{caseData.opposing_party_address}</span></div>}
            {caseData.opposing_party_phone && <div className="flex justify-between"><span className="text-muted-foreground">الهاتف:</span><span dir="ltr">{caseData.opposing_party_phone}</span></div>}
          </CardContent>
        </Card>

        {/* Case Info */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <MapPin className="h-4 w-4" /> بيانات الملف
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {caseData.title && <div className="flex justify-between"><span className="text-muted-foreground">العنوان:</span><span>{caseData.title}</span></div>}
            <div className="flex justify-between"><span className="text-muted-foreground">المحكمة:</span><span>{caseData.court || '—'}</span></div>
            {caseData.case_number && <div className="flex justify-between"><span className="text-muted-foreground">رقم الملف:</span><span className="font-mono">{caseData.case_number}</span></div>}
            <div className="flex justify-between"><span className="text-muted-foreground">التاريخ:</span><span>{new Date(caseData.created_at).toLocaleDateString('ar-MA')}</span></div>
            {caseData.description && <div className="pt-2 border-t"><p className="text-muted-foreground">{caseData.description}</p></div>}
          </CardContent>
        </Card>
      </div>

      {/* Documents */}
      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4" /> المستندات ({documents.length})
          </CardTitle>
          <Button size="sm" onClick={() => navigate(`/dashboard/document-generator?case_id=${caseData.id}`)}>
            إنشاء مستند
          </Button>
        </CardHeader>
        <CardContent>
          {documents.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-6">لا توجد مستندات بعد</p>
          ) : (
            <div className="space-y-2">
              {documents.map(doc => (
                <div key={doc.id} className="flex items-center justify-between p-3 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => navigate(`/dashboard/document-generator?doc_id=${doc.id}`)}>
                  <div>
                    <p className="text-sm font-medium">{doc.title}</p>
                    <p className="text-xs text-muted-foreground">{doc.doc_type} • {new Date(doc.created_at).toLocaleDateString('ar-MA')}</p>
                  </div>
                  <Badge variant="secondary" className="text-xs">{doc.status}</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default CaseDetail;
