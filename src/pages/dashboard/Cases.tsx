import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Plus, Search, Trash2, Pencil, FolderOpen, User } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface CaseForm {
  title: string;
  case_type: string;
  description: string;
  client_id: string;
}

const emptyForm: CaseForm = { title: '', case_type: '', description: '', client_id: '' };

const caseTypes = [
  'مدني', 'جنائي', 'تجاري', 'إداري', 'عقاري', 'أسري', 'شغل', 'آخر'
];

const Cases = () => {
  const [searchParams] = useSearchParams();
  const preselectedClientId = searchParams.get('client_id');

  const [cases, setCases] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCase, setEditingCase] = useState<any>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingCase, setDeletingCase] = useState<any>(null);
  const [form, setForm] = useState<CaseForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [filterClientId, setFilterClientId] = useState<string>(preselectedClientId || '');

  const fetchData = async () => {
    const [casesRes, clientsRes] = await Promise.all([
      supabase.from('cases').select('*, clients(full_name)').order('created_at', { ascending: false }),
      supabase.from('clients').select('id, full_name').order('full_name'),
    ]);
    if (casesRes.data) setCases(casesRes.data);
    if (clientsRes.data) setClients(clientsRes.data);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  useEffect(() => {
    if (preselectedClientId) {
      setFilterClientId(preselectedClientId);
    }
  }, [preselectedClientId]);

  const getClientName = (c: any) => c.clients?.full_name || '—';

  const filtered = cases.filter(c => {
    const matchesSearch = !search || c.title?.includes(search) || c.case_number?.includes(search) || getClientName(c).includes(search);
    const matchesClient = !filterClientId || c.client_id === filterClientId;
    return matchesSearch && matchesClient;
  });

  const openNew = () => {
    setEditingCase(null);
    setForm({ ...emptyForm, client_id: filterClientId || '' });
    setDialogOpen(true);
  };

  const openEdit = (c: any) => {
    setEditingCase(c);
    setForm({
      title: c.title || '',
      case_type: c.case_type || '',
      description: c.description || '',
      client_id: c.client_id || '',
    });
    setDialogOpen(true);
  };

  const openDelete = (c: any) => {
    setDeletingCase(c);
    setDeleteDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.title.trim()) { toast.error('عنوان الملف مطلوب'); return; }
    if (!form.client_id) { toast.error('يجب اختيار الموكل'); return; }
    setSaving(true);
    try {
      const payload = {
        title: form.title.trim(),
        case_type: form.case_type || null,
        description: form.description.trim() || null,
        client_id: form.client_id,
      };
      if (editingCase) {
        const { error } = await supabase.from('cases').update(payload).eq('id', editingCase.id);
        if (error) throw error;
        toast.success('تم تحديث الملف');
      } else {
        const { error } = await supabase.from('cases').insert(payload);
        if (error) throw error;
        toast.success('تم إنشاء الملف بنجاح');
      }
      setDialogOpen(false);
      fetchData();
    } catch (err: any) {
      toast.error(err.message || 'حدث خطأ');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingCase) return;
    const { error } = await supabase.from('cases').delete().eq('id', deletingCase.id);
    if (error) {
      toast.error('خطأ في حذف الملف');
    } else {
      setCases(prev => prev.filter(c => c.id !== deletingCase.id));
      toast.success('تم حذف الملف وجميع مستنداته ✅');
    }
    setDeleteDialogOpen(false);
    setDeletingCase(null);
  };

  const updateField = (field: keyof CaseForm, value: string) => setForm(prev => ({ ...prev, [field]: value }));

  const selectedClientName = filterClientId ? clients.find(c => c.id === filterClientId)?.full_name : null;

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-foreground">الملفات</h1>
          <p className="text-sm text-muted-foreground">
            {selectedClientName ? `ملفات الموكل: ${selectedClientName}` : 'إدارة جميع الملفات'}
          </p>
        </div>
        <div className="flex gap-2">
          {filterClientId && (
            <Button variant="outline" onClick={() => setFilterClientId('')} className="gap-2">
              <User className="h-4 w-4" /> عرض الكل
            </Button>
          )}
          <Button onClick={openNew} className="gap-2 w-full sm:w-auto"><Plus className="h-4 w-4" /> ملف جديد</Button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="بحث بالعنوان أو رقم الملف أو اسم الموكل..." value={search} onChange={(e) => setSearch(e.target.value)} className="pr-10" />
        </div>
        <Select value={filterClientId} onValueChange={setFilterClientId}>
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue placeholder="كل الموكلين" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كل الموكلين</SelectItem>
            {clients.map(c => (
              <SelectItem key={c.id} value={c.id}>{c.full_name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Mobile: card view */}
      <div className="md:hidden space-y-3">
        {loading ? (
          <p className="text-center py-8 text-muted-foreground">جاري التحميل...</p>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 space-y-3">
            <FolderOpen className="h-12 w-12 text-muted-foreground/30 mx-auto" />
            <p className="text-muted-foreground">لا توجد ملفات</p>
            <Button variant="outline" onClick={openNew} className="gap-2"><Plus className="h-4 w-4" /> إنشاء ملف</Button>
          </div>
        ) : (
          filtered.map((c) => (
            <Card key={c.id}>
              <CardContent className="pt-4 pb-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-foreground text-sm truncate">{c.title}</p>
                    <p className="text-xs text-muted-foreground">{getClientName(c)}</p>
                    {c.case_number && <p className="text-xs text-muted-foreground font-mono">{c.case_number}</p>}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {c.case_type && <Badge variant="secondary" className="text-xs">{c.case_type}</Badge>}
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => openEdit(c)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => openDelete(c)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{c.court || '—'}</span>
                  <span>{new Date(c.created_at).toLocaleDateString('ar-MA')}</span>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Desktop: table view */}
      <Card className="hidden md:block">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>العنوان</TableHead>
                  <TableHead>الموكل</TableHead>
                  <TableHead>النوع</TableHead>
                  <TableHead>المحكمة</TableHead>
                  <TableHead>رقم الملف</TableHead>
                  <TableHead>الحالة</TableHead>
                  <TableHead>التاريخ</TableHead>
                  <TableHead className="w-24">إجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={8} className="text-center py-8">جاري التحميل...</TableCell></TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">لا توجد ملفات</TableCell></TableRow>
                ) : (
                  filtered.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{c.title}</TableCell>
                      <TableCell>{getClientName(c)}</TableCell>
                      <TableCell>{c.case_type || '—'}</TableCell>
                      <TableCell>{c.court || '—'}</TableCell>
                      <TableCell className="font-mono">{c.case_number || '—'}</TableCell>
                      <TableCell><Badge variant="secondary">{c.status}</Badge></TableCell>
                      <TableCell>{new Date(c.created_at).toLocaleDateString('ar-MA')}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(c)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => openDelete(c)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingCase ? 'تعديل الملف' : 'إنشاء ملف جديد'}</DialogTitle>
            <DialogDescription>{editingCase ? 'قم بتعديل بيانات الملف' : 'أدخل بيانات الملف الجديد'}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>الموكل *</Label>
              <Select value={form.client_id} onValueChange={(v) => updateField('client_id', v)}>
                <SelectTrigger>
                  <SelectValue placeholder="اختر الموكل" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>عنوان الملف *</Label>
              <Input value={form.title} onChange={e => updateField('title', e.target.value)} placeholder="مثال: نزاع عقاري - الدار البيضاء" />
            </div>
            <div>
              <Label>نوع القضية</Label>
              <Select value={form.case_type} onValueChange={(v) => updateField('case_type', v)}>
                <SelectTrigger>
                  <SelectValue placeholder="اختر النوع" />
                </SelectTrigger>
                <SelectContent>
                  {caseTypes.map(t => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>ملاحظات</Label>
              <Textarea value={form.description} onChange={e => updateField('description', e.target.value)} placeholder="وصف مختصر للملف..." rows={3} />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>إلغاء</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? 'جاري الحفظ...' : 'حفظ'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>حذف الملف</AlertDialogTitle>
            <AlertDialogDescription>
              سيتم حذف هذا الملف وجميع المستندات المرتبطة به نهائياً. هل أنت متأكد؟
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">حذف</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Cases;
