import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Plus, Search, Pencil, Trash2, FolderOpen, DollarSign, ChevronDown } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useInvoices } from '@/hooks/useInvoices';
import { useFeeStatements } from '@/hooks/useFeeStatements';
import ClientFinanceSection from '@/components/clients/ClientFinanceSection';

interface ClientForm {
  full_name: string;
  email: string;
  phone: string;
  cin: string;
  address: string;
  notes: string;
}

const emptyForm: ClientForm = { full_name: '', email: '', phone: '', cin: '', address: '', notes: '' };

const Clients = () => {
  const navigate = useNavigate();
  const [clients, setClients] = useState<any[]>([]);
  const [caseCounts, setCaseCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<any>(null);
  const [deletingClient, setDeletingClient] = useState<any>(null);
  const [form, setForm] = useState<ClientForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [expandedClient, setExpandedClient] = useState<string | null>(null);
  const { invoices } = useInvoices();
  const { statements } = useFeeStatements();

  const fetchClients = async () => {
    const [clientsRes, casesRes] = await Promise.all([
      supabase.from('clients').select('*').order('created_at', { ascending: false }),
      supabase.from('cases').select('client_id'),
    ]);
    if (clientsRes.data) setClients(clientsRes.data);
    if (casesRes.data) {
      const counts: Record<string, number> = {};
      casesRes.data.forEach((c: any) => {
        if (c.client_id) counts[c.client_id] = (counts[c.client_id] || 0) + 1;
      });
      setCaseCounts(counts);
    }
    setLoading(false);
  };

  useEffect(() => { fetchClients(); }, []);

  const filtered = clients.filter(c =>
    c.full_name?.includes(search) || c.email?.includes(search) || c.phone?.includes(search)
  );

  const openNew = () => {
    setEditingClient(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (c: any) => {
    setEditingClient(c);
    setForm({
      full_name: c.full_name || '',
      email: c.email || '',
      phone: c.phone || '',
      cin: c.cin || '',
      address: c.address || '',
      notes: c.notes || '',
    });
    setDialogOpen(true);
  };

  const openDelete = (c: any) => {
    setDeletingClient(c);
    setDeleteDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.full_name.trim()) {
      toast.error('اسم الموكل مطلوب');
      return;
    }
    if (!form.phone.trim()) {
      toast.error('رقم الهاتف مطلوب');
      return;
    }
    if (!form.address.trim()) {
      toast.error('العنوان مطلوب');
      return;
    }
    setSaving(true);
    try {
      if (editingClient) {
        const { error } = await supabase.from('clients').update({
          full_name: form.full_name.trim(),
          email: form.email.trim() || null,
          phone: form.phone.trim() || null,
          cin: form.cin.trim() || null,
          address: form.address.trim() || null,
          notes: form.notes.trim() || null,
        }).eq('id', editingClient.id);
        if (error) throw error;
        toast.success('تم تحديث بيانات الموكل');
      } else {
        const { error } = await supabase.from('clients').insert({
          full_name: form.full_name.trim(),
          email: form.email.trim() || null,
          phone: form.phone.trim() || null,
          cin: form.cin.trim() || null,
          address: form.address.trim() || null,
          notes: form.notes.trim() || null,
        });
        if (error) throw error;
        toast.success('تمت إضافة الموكل بنجاح');
      }
      setDialogOpen(false);
      fetchClients();
    } catch (err: any) {
      toast.error(err.message || 'حدث خطأ');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingClient) return;
    try {
      const { error } = await supabase.from('clients').delete().eq('id', deletingClient.id);
      if (error) throw error;
      toast.success('تم حذف الموكل');
      setDeleteDialogOpen(false);
      setDeletingClient(null);
      fetchClients();
    } catch (err: any) {
      toast.error(err.message || 'حدث خطأ أثناء الحذف');
    }
  };

  const updateField = (field: keyof ClientForm, value: string) => setForm(prev => ({ ...prev, [field]: value }));

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-foreground">الموكلين</h1>
          <p className="text-sm text-muted-foreground">إدارة بيانات الموكلين</p>
        </div>
        <Button onClick={openNew} className="gap-2 w-full sm:w-auto"><Plus className="h-4 w-4" /> موكل جديد</Button>
      </div>

      <div className="relative">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="بحث..." value={search} onChange={(e) => setSearch(e.target.value)} className="pr-10" />
      </div>

      {/* Mobile: card view */}
      <div className="md:hidden space-y-3">
        {loading ? (
          <p className="text-center py-8 text-muted-foreground">جاري التحميل...</p>
        ) : filtered.length === 0 ? (
          <p className="text-center py-8 text-muted-foreground">لا يوجد موكلين</p>
        ) : (
          filtered.map((c) => (
            <Card key={c.id}>
              <CardContent className="pt-4 pb-4 space-y-2">
                <div className="flex items-start justify-between">
                  <div className="space-y-1 flex-1">
                    <p className="font-semibold text-foreground text-sm">{c.full_name}</p>
                    {c.email && <p className="text-xs text-muted-foreground" dir="ltr">{c.email}</p>}
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setExpandedClient(expandedClient === c.id ? null : c.id)} title="الحساب المالي">
                      <DollarSign className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate(`/dashboard/cases?client_id=${c.id}`)}>
                      <FolderOpen className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(c)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => openDelete(c)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <div className="flex items-center gap-2">
                    {c.phone && <span dir="ltr">{c.phone}</span>}
                    <Badge variant="outline" className="text-[10px]">{caseCounts[c.id] || 0} ملف</Badge>
                  </div>
                  <span>{new Date(c.created_at).toLocaleDateString('ar-MA')}</span>
                </div>
                {expandedClient === c.id && (
                  <div className="pt-2 border-t border-border">
                    <ClientFinanceSection clientId={c.id} invoices={invoices} statements={statements} />
                  </div>
                )}
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
                  <TableHead>الاسم</TableHead>
                  <TableHead>البريد</TableHead>
                  <TableHead>الهاتف</TableHead>
                  <TableHead>رقم البطاقة</TableHead>
                  <TableHead>الملفات</TableHead>
                  <TableHead>التاريخ</TableHead>
                  <TableHead className="w-28">إجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8">جاري التحميل...</TableCell></TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">لا يوجد موكلين</TableCell></TableRow>
                ) : (
                  filtered.map((c) => (
                    <>
                      <TableRow key={c.id}>
                        <TableCell className="font-medium">{c.full_name}</TableCell>
                        <TableCell dir="ltr">{c.email}</TableCell>
                        <TableCell dir="ltr">{c.phone}</TableCell>
                        <TableCell dir="ltr">{c.cin}</TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm" className="gap-1 h-7 text-xs" onClick={() => navigate(`/dashboard/cases?client_id=${c.id}`)}>
                            <FolderOpen className="h-3.5 w-3.5" />
                            {caseCounts[c.id] || 0}
                          </Button>
                        </TableCell>
                        <TableCell>{new Date(c.created_at).toLocaleDateString('ar-MA')}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button
                              variant={expandedClient === c.id ? 'secondary' : 'ghost'}
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => setExpandedClient(expandedClient === c.id ? null : c.id)}
                              title="الحساب المالي"
                            >
                              <DollarSign className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(c)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => openDelete(c)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                      {expandedClient === c.id && (
                        <TableRow key={`${c.id}-finance`}>
                          <TableCell colSpan={7} className="bg-muted/30 p-4">
                            <ClientFinanceSection clientId={c.id} invoices={invoices} statements={statements} />
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingClient ? 'تعديل بيانات الموكل' : 'إضافة موكل جديد'}</DialogTitle>
            <DialogDescription>{editingClient ? 'قم بتعديل البيانات ثم اضغط حفظ' : 'أدخل بيانات الموكل الجديد'}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>الاسم الكامل *</Label>
              <Input value={form.full_name} onChange={e => updateField('full_name', e.target.value)} placeholder="الاسم الكامل" />
            </div>
            <div>
              <Label>البريد الإلكتروني</Label>
              <Input value={form.email} onChange={e => updateField('email', e.target.value)} placeholder="email@example.com" dir="ltr" />
            </div>
            <div>
              <Label>الهاتف *</Label>
              <Input value={form.phone} onChange={e => updateField('phone', e.target.value)} placeholder="06..." dir="ltr" />
            </div>
            <div>
              <Label>رقم البطاقة الوطنية</Label>
              <Input value={form.cin} onChange={e => updateField('cin', e.target.value)} placeholder="رقم البطاقة" dir="ltr" />
            </div>
            <div>
              <Label>العنوان *</Label>
              <Input value={form.address} onChange={e => updateField('address', e.target.value)} placeholder="العنوان" />
            </div>
            <div>
              <Label>ملاحظات</Label>
              <Textarea value={form.notes} onChange={e => updateField('notes', e.target.value)} placeholder="ملاحظات..." rows={3} />
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
            <AlertDialogTitle>حذف الموكل</AlertDialogTitle>
            <AlertDialogDescription>
              هل أنت متأكد من حذف الموكل "{deletingClient?.full_name}"؟ لا يمكن التراجع عن هذا الإجراء.
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

export default Clients;
