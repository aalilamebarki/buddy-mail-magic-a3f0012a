import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Search } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

const Clients = () => {
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const fetchClients = async () => {
      const { data } = await supabase.from('clients').select('*').order('created_at', { ascending: false });
      if (data) setClients(data);
      setLoading(false);
    };
    fetchClients();
  }, []);

  const filtered = clients.filter(c =>
    c.full_name?.includes(search) || c.email?.includes(search) || c.phone?.includes(search)
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">الموكلين</h1>
          <p className="text-muted-foreground">إدارة بيانات الموكلين</p>
        </div>
        <Button className="gap-2"><Plus className="h-4 w-4" /> موكل جديد</Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="بحث..." value={search} onChange={(e) => setSearch(e.target.value)} className="pr-10" />
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>الاسم</TableHead>
                <TableHead>البريد</TableHead>
                <TableHead>الهاتف</TableHead>
                <TableHead>التاريخ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={4} className="text-center py-8">جاري التحميل...</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">لا يوجد موكلين</TableCell></TableRow>
              ) : (
                filtered.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>{c.full_name}</TableCell>
                    <TableCell dir="ltr">{c.email}</TableCell>
                    <TableCell dir="ltr">{c.phone}</TableCell>
                    <TableCell>{new Date(c.created_at).toLocaleDateString('ar-MA')}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default Clients;
