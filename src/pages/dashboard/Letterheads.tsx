import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Plus, Trash2, FileText, Loader2, Stamp, Download } from 'lucide-react';

interface Letterhead {
  id: string;
  lawyer_name: string;
  template_path: string | null;
  created_at: string;
}

const Letterheads = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [letterheads, setLetterheads] = useState<Letterhead[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  const [lawyerName, setLawyerName] = useState('');
  const [templateFile, setTemplateFile] = useState<File | null>(null);

  useEffect(() => {
    if (!user) return;
    loadLetterheads();
  }, [user]);

  const loadLetterheads = async () => {
    const { data } = await supabase
      .from('letterheads')
      .select('id, lawyer_name, template_path, created_at')
      .order('created_at', { ascending: false }) as any;
    if (data) setLetterheads(data);
    setLoading(false);
  };

  const save = async () => {
    if (!user || !lawyerName.trim() || !templateFile) return;
    const fileName = templateFile.name.toLowerCase();
    if (!fileName.endsWith('.docx')) {
      toast({ title: 'يجب رفع ملف Word بصيغة .docx فقط', variant: 'destructive' });
      return;
    }
    setSaving(true);

    try {
      const id = crypto.randomUUID();
      const path = `${user.id}/${id}/template.docx`;
      const { error: upErr } = await supabase.storage.from('letterheads').upload(path, templateFile);
      if (upErr) throw upErr;

      const { error } = await supabase.from('letterheads').insert({
        id,
        user_id: user.id,
        lawyer_name: lawyerName.trim(),
        template_path: path,
      } as any);
      if (error) throw error;

      toast({ title: 'تم إضافة الترويسة ✅' });
      resetForm();
      loadLetterheads();
    } catch (e: any) {
      toast({ title: 'خطأ', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const deleteLetterhead = async (lh: Letterhead) => {
    try {
      const paths = [lh.template_path].filter(Boolean) as string[];
      if (paths.length) await supabase.storage.from('letterheads').remove(paths);
      const { error } = await supabase.from('letterheads').delete().eq('id', lh.id) as any;
      if (error) throw error;
      setLetterheads(prev => prev.filter(x => x.id !== lh.id));
      toast({ title: 'تم حذف الترويسة' });
    } catch (e: any) {
      toast({ title: 'خطأ', description: e.message, variant: 'destructive' });
    }
  };

  const downloadTemplate = (path: string) => {
    const { data } = supabase.storage.from('letterheads').getPublicUrl(path);
    window.open(data.publicUrl, '_blank');
  };

  const resetForm = () => {
    setShowForm(false);
    setLawyerName('');
    setTemplateFile(null);
  };

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
          <p className="text-muted-foreground text-xs mt-1">ارفع ملف Word يحتوي على ترويسة المكتب وسيتم دمج المستندات فيه</p>
        </div>
        <Button onClick={() => setShowForm(true)} className="gap-1.5">
          <Plus className="h-4 w-4" /> ترويسة جديدة
        </Button>
      </div>

      {showForm && (
        <Card className="border-primary/20">
          <CardContent className="pt-5 space-y-4">
            <Input
              placeholder="اسم المحامي *"
              value={lawyerName}
              onChange={e => setLawyerName(e.target.value)}
              className="text-sm"
            />

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">ملف الترويسة (Word .docx)</label>
              <label className="flex flex-col items-center justify-center border-2 border-dashed border-border rounded-lg p-6 cursor-pointer hover:border-primary/40 transition-colors">
                {templateFile ? (
                  <div className="flex items-center gap-2 text-primary">
                    <FileText className="h-6 w-6" />
                    <span className="text-sm font-medium">{templateFile.name}</span>
                  </div>
                ) : (
                  <>
                    <FileText className="h-8 w-8 text-muted-foreground mb-2" />
                    <span className="text-xs text-muted-foreground">اختر ملف Word (.docx) يحتوي على ترويسة المكتب</span>
                    <span className="text-[10px] text-muted-foreground mt-1">سيتم إدراج نص المستند داخل هذا القالب مع الحفاظ على التنسيق</span>
                  </>
                )}
                <input type="file" accept=".docx,.doc" className="hidden"
                  onChange={e => e.target.files?.[0] && setTemplateFile(e.target.files[0])} />
              </label>
            </div>

            <div className="flex gap-2">
              <Button onClick={save} disabled={!lawyerName.trim() || !templateFile || saving} className="gap-1.5">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                حفظ الترويسة
              </Button>
              <Button variant="ghost" onClick={resetForm}>إلغاء</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {letterheads.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground text-sm">
            <Stamp className="h-8 w-8 mx-auto mb-2 opacity-20" />
            لا توجد ترويسات. أضف ملف Word يحتوي على ترويسة المكتب.
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
                      <p className="text-[10px] text-muted-foreground">
                        {new Date(lh.created_at).toLocaleDateString('ar-MA')}
                        {lh.template_path && ' • ملف Word'}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    {lh.template_path && (
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0"
                        onClick={() => downloadTemplate(lh.template_path!)}>
                        <Download className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-destructive"
                      onClick={() => deleteLetterhead(lh)}>
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
