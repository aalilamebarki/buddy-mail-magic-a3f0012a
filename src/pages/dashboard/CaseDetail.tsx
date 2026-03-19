import { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowRight, FileText, User, Scale, MapPin, ClipboardList, CalendarDays, Plus, Pencil, Trash2, Check, X, ExternalLink } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { cn } from '@/lib/utils';

const CaseDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [caseData, setCaseData] = useState<any>(null);
  const [documents, setDocuments] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [opponents, setOpponents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [sessionDialogOpen, setSessionDialogOpen] = useState(false);
  const [editingSession, setEditingSession] = useState<any>(null);
  const [sessionDate, setSessionDate] = useState<Date | undefined>(undefined);
  const [sessionNotes, setSessionNotes] = useState('');
  const [caseNumberInput, setCaseNumberInput] = useState('');
  const [editingCaseNumber, setEditingCaseNumber] = useState(false);
  const [caseNumberEdit, setCaseNumberEdit] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchData = async () => {
    if (!id) return;
    const [caseRes, docsRes, sessionsRes, opponentsRes] = await Promise.all([
      supabase.from('cases').select('*, clients(full_name, phone, email, cin, address)').eq('id', id).single(),
      supabase.from('generated_documents').select('id, title, doc_type, status, created_at, next_court').eq('case_id', id).order('created_at', { ascending: false }),
      supabase.from('court_sessions').select('*').eq('case_id', id).order('session_date', { ascending: true }),
      supabase.from('case_opponents').select('*').eq('case_id', id).order('sort_order'),
    ]);
    if (caseRes.error) {
      toast.error('لم يتم العثور على الملف');
      navigate('/dashboard/cases');
      return;
    }
    setCaseData(caseRes.data);
    if (docsRes.data) setDocuments(docsRes.data);
    if (sessionsRes.data) setSessions(sessionsRes.data);
    if (opponentsRes.data) setOpponents(opponentsRes.data);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [id, navigate]);

  // Auto-open add session dialog when navigating from notification
  useEffect(() => {
    if (!loading && caseData && (location.state as any)?.openAddSession) {
      openAddSession();
      // Clear the state so it doesn't re-trigger
      window.history.replaceState({}, '');
    }
  }, [loading, caseData, location.state]);

  const needsCaseNumber = caseData && !caseData.case_number;

  const openEditSession = (session: any) => {
    setEditingSession(session);
    setSessionDate(new Date(session.session_date + 'T00:00:00'));
    setSessionNotes(session.notes || '');
    setSessionDialogOpen(true);
  };

  const openAddSession = () => {
    setEditingSession(null);
    setSessionDate(undefined);
    setSessionNotes('');
    setCaseNumberInput('');
    setSessionDialogOpen(true);
  };

  const handleSaveSession = async () => {
    if (!sessionDate || !user || !id) {
      toast.error('يرجى اختيار تاريخ الجلسة');
      return;
    }
    if (!editingSession) {
      const finalCaseNumber = caseData?.case_number || caseNumberInput.trim();
      if (!finalCaseNumber) {
        toast.error('رقم الملف مطلوب');
        return;
      }
    }
    setSaving(true);
    try {
      if (!editingSession && needsCaseNumber && caseNumberInput.trim()) {
        await supabase.from('cases').update({ case_number: caseNumberInput.trim() }).eq('id', id);
      }
      if (editingSession) {
        const { error } = await supabase.from('court_sessions').update({
          session_date: format(sessionDate, 'yyyy-MM-dd'),
          notes: sessionNotes || null,
        }).eq('id', editingSession.id);
        if (error) throw error;
        toast.success('تم تعديل الجلسة');
      } else {
        const { error } = await supabase.from('court_sessions').insert({
          case_id: id,
          session_date: format(sessionDate, 'yyyy-MM-dd'),
          notes: sessionNotes || null,
          user_id: user.id,
        });
        if (error) throw error;
        toast.success('تمت إضافة الجلسة');
      }
      setSessionDialogOpen(false);
      setEditingSession(null);
      setSessionDate(undefined);
      setSessionNotes('');
      setCaseNumberInput('');
      fetchData();
    } catch {
      toast.error('خطأ في حفظ الجلسة');
    }
    setSaving(false);
  };

  const handleDeleteSession = async (sessionId: string) => {
    if (!confirm('هل تريد حذف هذه الجلسة؟')) return;
    const { error } = await supabase.from('court_sessions').delete().eq('id', sessionId);
    if (error) { toast.error('خطأ في حذف الجلسة'); return; }
    toast.success('تم حذف الجلسة');
    fetchData();
  };

  if (loading) return <div className="text-center py-12 text-muted-foreground">جاري التحميل...</div>;
  if (!caseData) return null;

  const clientName = caseData.clients?.full_name || '—';
  const today = format(new Date(), 'yyyy-MM-dd');

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

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Scale className="h-4 w-4" /> بيانات الخصوم ({opponents.length || 1})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {opponents.length > 0 ? opponents.map((opp, i) => (
              <div key={opp.id || i} className={cn("space-y-1", i > 0 && "pt-2 border-t")}>
                <div className="flex justify-between"><span className="text-muted-foreground">الخصم {opponents.length > 1 ? i + 1 : ''}:</span><span className="font-medium">{opp.name}</span></div>
                {opp.address && <div className="flex justify-between"><span className="text-muted-foreground">العنوان:</span><span>{opp.address}</span></div>}
                {opp.phone && <div className="flex justify-between"><span className="text-muted-foreground">الهاتف:</span><span dir="ltr">{opp.phone}</span></div>}
              </div>
            )) : (
              <div className="space-y-1">
                <div className="flex justify-between"><span className="text-muted-foreground">الاسم:</span><span>{caseData.opposing_party || '—'}</span></div>
                {caseData.opposing_party_address && <div className="flex justify-between"><span className="text-muted-foreground">العنوان:</span><span>{caseData.opposing_party_address}</span></div>}
                {caseData.opposing_party_phone && <div className="flex justify-between"><span className="text-muted-foreground">الهاتف:</span><span dir="ltr">{caseData.opposing_party_phone}</span></div>}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <MapPin className="h-4 w-4" /> بيانات الملف
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {caseData.title && <div className="flex justify-between"><span className="text-muted-foreground">العنوان:</span><span>{caseData.title}</span></div>}
            <div className="flex justify-between"><span className="text-muted-foreground">المحكمة:</span><span>{caseData.court || '—'}</span></div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">رقم الملف:</span>
              {editingCaseNumber ? (
                <div className="flex items-center gap-1">
                  <Input
                    value={caseNumberEdit}
                    onChange={e => setCaseNumberEdit(e.target.value)}
                    className="h-7 w-40 text-sm"
                    dir="ltr"
                    placeholder="رقم/رمز/سنة"
                    autoFocus
                    onKeyDown={async e => {
                      if (e.key === 'Enter') {
                        const val = caseNumberEdit.trim();
                        if (!val) { toast.error('رقم الملف مطلوب'); return; }
                        await supabase.from('cases').update({ case_number: val }).eq('id', id);
                        toast.success('تم تحديث رقم الملف');
                        setEditingCaseNumber(false);
                        fetchData();
                      }
                      if (e.key === 'Escape') setEditingCaseNumber(false);
                    }}
                  />
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={async () => {
                    const val = caseNumberEdit.trim();
                    if (!val) { toast.error('رقم الملف مطلوب'); return; }
                    await supabase.from('cases').update({ case_number: val }).eq('id', id);
                    toast.success('تم تحديث رقم الملف');
                    setEditingCaseNumber(false);
                    fetchData();
                  }}>
                    <Check className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditingCaseNumber(false)}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-1">
                  <span dir="ltr">{caseData.case_number || '—'}</span>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => { setCaseNumberEdit(caseData.case_number || ''); setEditingCaseNumber(true); }}>
                    <Pencil className="h-3 w-3" />
                  </Button>
                </div>
              )}
            </div>
            <div className="flex justify-between"><span className="text-muted-foreground">التاريخ:</span><span>{new Date(caseData.created_at).toLocaleDateString('ar-MA')}</span></div>
            {caseData.description && <div className="pt-2 border-t"><p className="text-muted-foreground">{caseData.description}</p></div>}
            {caseData.case_number && (
              <div className="pt-2 border-t">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full gap-2 text-primary"
                  onClick={() => window.open('https://www.mahakim.ma/#/suivi/dossier-suivi', '_blank')}
                >
                  <ExternalLink className="h-4 w-4" />
                  تتبع الملف على بوابة محاكم
                </Button>
                <p className="text-[11px] text-muted-foreground mt-1 text-center">
                  رقم الملف: <span dir="ltr" className="font-mono">{caseData.case_number}</span> — انسخه وألصقه في بوابة محاكم
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* الجلسات */}
      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <CalendarDays className="h-4 w-4" /> الجلسات ({sessions.length})
          </CardTitle>
          <Button size="sm" onClick={openAddSession} className="gap-1">
            <Plus className="h-4 w-4" /> إضافة جلسة
          </Button>
        </CardHeader>
        <CardContent>
          {sessions.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-6">لا توجد جلسات بعد</p>
          ) : (
            <div className="space-y-2">
              {sessions.map(s => (
                <div key={s.id} className="flex items-center justify-between p-3 rounded-lg border gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">
                      {new Date(s.session_date + 'T00:00:00').toLocaleDateString('ar-MA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                    </p>
                    {s.notes && <p className="text-xs text-muted-foreground mt-1">{s.notes}</p>}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {s.session_date === today ? (
                      <Badge className="bg-primary text-primary-foreground">اليوم</Badge>
                    ) : s.session_date > today ? (
                      <Badge variant="outline" className="text-emerald-600 border-emerald-300">قادمة</Badge>
                    ) : (
                      <Badge variant="secondary">منتهية</Badge>
                    )}
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditSession(s)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => handleDeleteSession(s.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* سجل الإجراءات */}
      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <ClipboardList className="h-4 w-4" /> سجل الإجراءات ({documents.length})
          </CardTitle>
          <Button size="sm" onClick={() => navigate(`/dashboard/document-generator?case_id=${caseData.id}`)}>
            إنشاء مستند
          </Button>
        </CardHeader>
        <CardContent>
          {documents.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-6">لا توجد إجراءات بعد</p>
          ) : (
            <div className="overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">التاريخ</TableHead>
                    <TableHead className="text-right">نوع الإجراء</TableHead>
                    <TableHead className="text-right">العنوان</TableHead>
                    <TableHead className="text-right">الجلسة المقبلة</TableHead>
                    <TableHead className="text-right">الحالة</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {documents.map(doc => (
                    <TableRow key={doc.id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/dashboard/document-generator?doc_id=${doc.id}`)}>
                      <TableCell className="text-sm whitespace-nowrap">{new Date(doc.created_at).toLocaleDateString('ar-MA')}</TableCell>
                      <TableCell><Badge variant="outline" className="text-xs">{doc.doc_type}</Badge></TableCell>
                      <TableCell className="text-sm font-medium">{doc.title}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{doc.next_court || '—'}</TableCell>
                      <TableCell><Badge variant="secondary" className="text-xs">{doc.status}</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Session Dialog */}
      <Dialog open={sessionDialogOpen} onOpenChange={(open) => { setSessionDialogOpen(open); if (!open) setEditingSession(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingSession ? 'تعديل الجلسة' : 'إضافة جلسة جديدة'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {!editingSession && needsCaseNumber && (
              <div className="space-y-2">
                <Label>رقم الملف *</Label>
                <Input
                  value={caseNumberInput}
                  onChange={e => setCaseNumberInput(e.target.value)}
                  placeholder="مثال: 123/1234/2025"
                  className=""
                  dir="ltr"
                />
                <p className="text-xs text-muted-foreground">هذا الملف لا يحتوي على رقم بعد. أدخل الرقم الكامل (رقم/رمز/سنة)</p>
              </div>
            )}
            <div className="space-y-2">
              <Label>تاريخ الجلسة *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start font-normal", !sessionDate && "text-muted-foreground")}>
                    <CalendarDays className="h-4 w-4 ml-2" />
                    {sessionDate ? format(sessionDate, 'PPP', { locale: ar }) : 'اختر التاريخ'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={sessionDate} onSelect={setSessionDate} className={cn("p-3 pointer-events-auto")} />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-2">
              <Label>ملاحظات</Label>
              <Textarea value={sessionNotes} onChange={e => setSessionNotes(e.target.value)} placeholder="ملاحظات اختيارية..." rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSessionDialogOpen(false)}>إلغاء</Button>
            <Button onClick={handleSaveSession} disabled={saving}>{saving ? 'جاري الحفظ...' : 'حفظ'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CaseDetail;
