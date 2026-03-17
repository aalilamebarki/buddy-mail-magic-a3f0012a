import { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Plus, Search, Trash2, Pencil, FolderOpen, User } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useCases } from '@/hooks/useCases';
import { useClients } from '@/hooks/useClients';
import { toast } from 'sonner';
import CreateCaseDialog from '@/components/cases/CreateCaseDialog';

const Cases = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const preselectedClientId = searchParams.get('client_id');

  const { cases, setCases, loading: casesLoading, refetch: refetchCases } = useCases();
  const { clients, loading: clientsLoading } = useClients();
  const loading = casesLoading || clientsLoading;

  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCase, setEditingCase] = useState<any>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingCase, setDeletingCase] = useState<any>(null);
  const [filterClientId, setFilterClientId] = useState<string>(preselectedClientId || '');

  useEffect(() => {
    if (preselectedClientId) setFilterClientId(preselectedClientId);
  }, [preselectedClientId]);

  const getClientName = (c: any) => c.clients?.full_name || '—';
  const getOpposingLabel = (c: any) => c.opposing_party || '—';

  const filtered = cases.filter(c => {
    const matchesSearch = !search || c.title?.includes(search) || c.case_number?.includes(search) || getClientName(c).includes(search);
    const matchesClient = !filterClientId || c.client_id === filterClientId;
    return matchesSearch && matchesClient;
  });

  const openNew = () => {
    setEditingCase(null);
    setDialogOpen(true);
  };

  const openEdit = (c: any) => {
    setEditingCase(c);
    setDialogOpen(true);
  };

  const openDelete = (c: any) => {
    setDeletingCase(c);
    setDeleteDialogOpen(true);
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

  const handleCaseCreated = () => {
    refetchCases();
  };

  const handleDialogClose = (open: boolean) => {
    setDialogOpen(open);
    if (!open) setEditingCase(null);
  };

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
        <SearchableSelect
          options={[
            { value: 'all', label: 'كل الموكلين' },
            ...clients.map(c => ({ value: c.id, label: c.full_name, sublabel: c.phone || undefined })),
          ]}
          value={filterClientId || 'all'}
          onValueChange={(v) => setFilterClientId(v === 'all' ? '' : v)}
          placeholder="كل الموكلين"
          searchPlaceholder="ابحث باسم الموكل..."
          triggerClassName="w-full sm:w-[200px]"
        />
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
            <Card key={c.id} className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => navigate(`/dashboard/cases/${c.id}`)}>
              <CardContent className="pt-4 pb-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-foreground text-sm truncate">لفائدة: {getClientName(c)}</p>
                    <p className="text-xs text-muted-foreground">ضد: {getOpposingLabel(c)}</p>
                    {c.title && <p className="text-xs text-muted-foreground">{c.title}</p>}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {c.case_type && <Badge variant="secondary" className="text-xs">{c.case_type}</Badge>}
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={(e) => { e.stopPropagation(); openEdit(c); }}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={(e) => { e.stopPropagation(); openDelete(c); }}>
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
                  <TableHead>لفائدة</TableHead>
                  <TableHead>ضد</TableHead>
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
                  <TableRow><TableCell colSpan={9} className="text-center py-8">جاري التحميل...</TableCell></TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">لا توجد ملفات</TableCell></TableRow>
                ) : (
                  filtered.map((c) => (
                    <TableRow key={c.id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/dashboard/cases/${c.id}`)}>
                      <TableCell className="font-medium">{c.title}</TableCell>
                      <TableCell>{getClientName(c)}</TableCell>
                      <TableCell>{getOpposingLabel(c)}</TableCell>
                      <TableCell>{c.case_type || '—'}</TableCell>
                      <TableCell>{c.court || '—'}</TableCell>
                      <TableCell className="font-mono" dir="ltr">{c.case_number || '—'}</TableCell>
                      <TableCell><Badge variant="secondary">{c.status}</Badge></TableCell>
                      <TableCell>{new Date(c.created_at).toLocaleDateString('ar-MA')}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); openEdit(c); }}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={(e) => { e.stopPropagation(); openDelete(c); }}>
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

      {/* Create/Edit Case Dialog (shared component) */}
      <CreateCaseDialog
        open={dialogOpen}
        onOpenChange={handleDialogClose}
        onCreated={handleCaseCreated}
        editingCase={editingCase}
        preselectedClientId={filterClientId || undefined}
      />

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
