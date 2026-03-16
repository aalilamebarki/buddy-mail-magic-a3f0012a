import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Plus, Search, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const Cases = () => {
  const [cases, setCases] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const fetchCases = async () => {
      const { data } = await supabase.from('cases').select('*').order('created_at', { ascending: false });
      if (data) setCases(data);
      setLoading(false);
    };
    fetchCases();
  }, []);

  const deleteCase = async (id: string) => {
    const { error } = await supabase.from('cases').delete().eq('id', id);
    if (error) {
      toast.error('خطأ في حذف الملف');
    } else {
      setCases(prev => prev.filter(c => c.id !== id));
      toast.success('تم حذف الملف وجميع مستنداته ✅');
    }
  };

  const filtered = cases.filter(c =>
    c.title?.includes(search) || c.case_number?.includes(search)
  );

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-foreground">القضايا</h1>
          <p className="text-sm text-muted-foreground">إدارة جميع القضايا</p>
        </div>
        <Button className="gap-2 w-full sm:w-auto"><Plus className="h-4 w-4" /> قضية جديدة</Button>
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
          <p className="text-center py-8 text-muted-foreground">لا توجد قضايا</p>
        ) : (
          filtered.map((c) => (
            <Card key={c.id}>
              <CardContent className="pt-4 pb-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-foreground text-sm truncate">{c.title}</p>
                    <p className="text-xs text-muted-foreground font-mono">{c.case_number}</p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Badge variant="secondary" className="text-xs">{c.status}</Badge>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive hover:text-destructive hover:bg-destructive/10">
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>حذف القضية</AlertDialogTitle>
                          <AlertDialogDescription>
                            سيتم حذف هذه القضية وجميع المستندات المرتبطة بها نهائياً. هل أنت متأكد؟
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>إلغاء</AlertDialogCancel>
                          <AlertDialogAction onClick={() => deleteCase(c.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">حذف</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{c.court}</span>
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
                  <TableHead>رقم الملف</TableHead>
                  <TableHead>العنوان</TableHead>
                  <TableHead>المحكمة</TableHead>
                  <TableHead>الحالة</TableHead>
                  <TableHead>التاريخ</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8">جاري التحميل...</TableCell></TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">لا توجد قضايا</TableCell></TableRow>
                ) : (
                  filtered.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-mono">{c.case_number}</TableCell>
                      <TableCell>{c.title}</TableCell>
                      <TableCell>{c.court}</TableCell>
                      <TableCell><Badge variant="secondary">{c.status}</Badge></TableCell>
                      <TableCell>{new Date(c.created_at).toLocaleDateString('ar-MA')}</TableCell>
                      <TableCell>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive hover:text-destructive hover:bg-destructive/10">
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>حذف القضية</AlertDialogTitle>
                              <AlertDialogDescription>
                                سيتم حذف هذه القضية وجميع المستندات المرتبطة بها نهائياً. هل أنت متأكد؟
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>إلغاء</AlertDialogCancel>
                              <AlertDialogAction onClick={() => deleteCase(c.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">حذف</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Cases;
