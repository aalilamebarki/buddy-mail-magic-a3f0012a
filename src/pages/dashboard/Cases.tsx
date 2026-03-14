import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Search, Gavel } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

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
                  <Badge variant="secondary" className="shrink-0 text-xs">{c.status}</Badge>
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
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-8">جاري التحميل...</TableCell></TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">لا توجد قضايا</TableCell></TableRow>
                ) : (
                  filtered.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-mono">{c.case_number}</TableCell>
                      <TableCell>{c.title}</TableCell>
                      <TableCell>{c.court}</TableCell>
                      <TableCell><Badge variant="secondary">{c.status}</Badge></TableCell>
                      <TableCell>{new Date(c.created_at).toLocaleDateString('ar-MA')}</TableCell>
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
