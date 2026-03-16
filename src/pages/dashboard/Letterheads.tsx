import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Plus, Trash2, FileText, Loader2, Stamp, Edit2, Save, X } from 'lucide-react';

interface Letterhead {
  id: string;
  lawyer_name: string;
  name_fr: string | null;
  title_ar: string | null;
  title_fr: string | null;
  bar_name_ar: string | null;
  bar_name_fr: string | null;
  city: string | null;
  address: string | null;
  email: string | null;
  phone: string | null;
  created_at: string;
}

const FIELDS = [
  { key: 'lawyer_name', label: 'اسم المحامي بالعربية *', required: true },
  { key: 'name_fr', label: 'اسم المحامي بالفرنسية' },
  { key: 'title_ar', label: 'الصفة بالعربية', placeholder: 'محام' },
  { key: 'title_fr', label: 'الصفة بالفرنسية', placeholder: 'AVOCAT' },
  { key: 'bar_name_ar', label: 'الهيئة بالعربية', placeholder: 'بهيئة المحامين بالرباط' },
  { key: 'bar_name_fr', label: 'الهيئة بالفرنسية', placeholder: 'AU BARREAU DE RABAT' },
  { key: 'city', label: 'المدينة', placeholder: 'الرباط' },
  { key: 'address', label: 'العنوان' },
  { key: 'email', label: 'البريد الإلكتروني' },
  { key: 'phone', label: 'الهاتف' },
] as const;

const emptyForm = (): Record<string, string> => Object.fromEntries(FIELDS.map(f => [f.key, '']));

const Letterheads = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [letterheads, setLetterheads] = useState<Letterhead[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Record<string, string>>(emptyForm());
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    loadLetterheads();
  }, [user]);

  const loadLetterheads = async () => {
    const { data } = await supabase
      .from('letterheads')
      .select('id, lawyer_name, name_fr, title_ar, title_fr, bar_name_ar, bar_name_fr, city, address, email, phone, created_at')
      .order('created_at', { ascending: false }) as any;
    if (data) setLetterheads(data);
    setLoading(false);
  };

  const save = async () => {
    if (!user || !form.lawyer_name.trim()) return;
    setSaving(true);
    try {
      const payload: any = {
        user_id: user.id,
        lawyer_name: form.lawyer_name.trim(),
        name_fr: form.name_fr || null,
        title_ar: form.title_ar || 'محام',
        title_fr: form.title_fr || 'AVOCAT',
        bar_name_ar: form.bar_name_ar || null,
        bar_name_fr: form.bar_name_fr || null,
        city: form.city || 'الرباط',
        address: form.address || null,
        email: form.email || null,
        phone: form.phone || null,
      };

      if (editingId) {
        const { error } = await supabase.from('letterheads').update(payload).eq('id', editingId) as any;
        if (error) throw error;
        toast({ title: 'تم تعديل الترويسة ✅' });
      } else {
        const { error } = await supabase.from('letterheads').insert(payload) as any;
        if (error) throw error;
        toast({ title: 'تم إضافة الترويسة ✅' });
      }
      resetForm();
      loadLetterheads();
    } catch (e: any) {
      toast({ title: 'خطأ', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (lh: Letterhead) => {
    setEditingId(lh.id);
    setForm({
      lawyer_name: lh.lawyer_name,
      name_fr: lh.name_fr || '',
      title_ar: lh.title_ar || '',
      title_fr: lh.title_fr || '',
      bar_name_ar: lh.bar_name_ar || '',
      bar_name_fr: lh.bar_name_fr || '',
      city: lh.city || '',
      address: lh.address || '',
      email: lh.email || '',
      phone: lh.phone || '',
    });
    setShowForm(true);
  };

  const deleteLetterhead = async (lh: Letterhead) => {
    try {
      const { error } = await supabase.from('letterheads').delete().eq('id', lh.id) as any;
      if (error) throw error;
      setLetterheads(prev => prev.filter(x => x.id !== lh.id));
      toast({ title: 'تم حذف الترويسة' });
    } catch (e: any) {
      toast({ title: 'خطأ', description: e.message, variant: 'destructive' });
    }
  };

  const resetForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm(emptyForm());
  };

  const setField = (key: string, val: string) => setForm(prev => ({ ...prev, [key]: val }));

  if (loading) {
    return <div className="flex items-center justify-center h-[60vh]"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Stamp className="h-5 w-5 text-primary" />
            الترويسات
          </h1>
          <p className="text-muted-foreground text-xs mt-1">أدخل بيانات المحامي وسيتم توليد ترويسة احترافية تلقائياً في كل مستند</p>
        </div>
        <Button onClick={() => { resetForm(); setShowForm(true); }} className="gap-1.5">
          <Plus className="h-4 w-4" /> ترويسة جديدة
        </Button>
      </div>

      {showForm && (
        <Card className="border-primary/20">
          <CardContent className="pt-5 space-y-3">
            <h3 className="text-sm font-bold text-foreground">{editingId ? 'تعديل الترويسة' : 'ترويسة جديدة'}</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {FIELDS.map(f => (
                <Input
                  key={f.key}
                  placeholder={f.label + (('placeholder' in f) ? ` (${f.placeholder})` : '')}
                  value={form[f.key]}
                  onChange={e => setField(f.key, e.target.value)}
                  className="text-sm"
                  dir={f.key.endsWith('_fr') ? 'ltr' : 'rtl'}
                />
              ))}
            </div>
            <div className="flex gap-2 pt-2">
              <Button onClick={save} disabled={!form.lawyer_name.trim() || saving} className="gap-1.5">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {editingId ? 'حفظ التعديلات' : 'حفظ الترويسة'}
              </Button>
              <Button variant="ghost" onClick={resetForm}><X className="h-4 w-4 ml-1" /> إلغاء</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {letterheads.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground text-sm">
            <Stamp className="h-8 w-8 mx-auto mb-2 opacity-20" />
            لا توجد ترويسات. أضف بيانات المحامي لتوليد الترويسة تلقائياً.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {letterheads.map(lh => (
            <Card key={lh.id} className="hover:border-primary/30 transition-colors">
              <CardContent className="py-3 px-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <FileText className="h-5 w-5 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-bold text-foreground text-sm truncate">{lh.lawyer_name}</h3>
                      <p className="text-[10px] text-muted-foreground truncate">
                        {lh.name_fr && `${lh.name_fr} • `}
                        {lh.bar_name_ar || lh.city || ''}
                        {' • '}{new Date(lh.created_at).toLocaleDateString('ar-MA')}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => startEdit(lh)}>
                      <Edit2 className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-destructive" onClick={() => deleteLetterhead(lh)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default Letterheads;
