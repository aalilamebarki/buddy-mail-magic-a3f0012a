import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Plus, Trash2, FileImage, Loader2, Eye, Stamp } from 'lucide-react';

interface Letterhead {
  id: string;
  lawyer_name: string;
  header_image_path: string | null;
  footer_image_path: string | null;
  created_at: string;
}

const Letterheads = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [letterheads, setLetterheads] = useState<Letterhead[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [previewImg, setPreviewImg] = useState<string | null>(null);

  // Form
  const [lawyerName, setLawyerName] = useState('');
  const [headerFile, setHeaderFile] = useState<File | null>(null);
  const [footerFile, setFooterFile] = useState<File | null>(null);
  const [headerPreview, setHeaderPreview] = useState<string | null>(null);
  const [footerPreview, setFooterPreview] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    loadLetterheads();
  }, [user]);

  const loadLetterheads = async () => {
    const { data } = await supabase
      .from('letterheads')
      .select('*')
      .order('created_at', { ascending: false }) as any;
    if (data) setLetterheads(data);
    setLoading(false);
  };

  const getPublicUrl = (path: string) => {
    const { data } = supabase.storage.from('letterheads').getPublicUrl(path);
    return data.publicUrl;
  };

  const handleFileSelect = (file: File, type: 'header' | 'footer') => {
    const url = URL.createObjectURL(file);
    if (type === 'header') { setHeaderFile(file); setHeaderPreview(url); }
    else { setFooterFile(file); setFooterPreview(url); }
  };

  const save = async () => {
    if (!user || !lawyerName.trim()) return;
    setSaving(true);

    try {
      let headerPath: string | null = null;
      let footerPath: string | null = null;
      const id = crypto.randomUUID();

      if (headerFile) {
        const ext = headerFile.name.split('.').pop();
        const path = `${user.id}/${id}/header.${ext}`;
        const { error } = await supabase.storage.from('letterheads').upload(path, headerFile);
        if (error) throw error;
        headerPath = path;
      }

      if (footerFile) {
        const ext = footerFile.name.split('.').pop();
        const path = `${user.id}/${id}/footer.${ext}`;
        const { error } = await supabase.storage.from('letterheads').upload(path, footerFile);
        if (error) throw error;
        footerPath = path;
      }

      const { error } = await supabase.from('letterheads').insert({
        id,
        user_id: user.id,
        lawyer_name: lawyerName.trim(),
        header_image_path: headerPath,
        footer_image_path: footerPath,
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
      // Delete files
      const paths = [lh.header_image_path, lh.footer_image_path].filter(Boolean) as string[];
      if (paths.length) await supabase.storage.from('letterheads').remove(paths);
      
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
    setLawyerName('');
    setHeaderFile(null);
    setFooterFile(null);
    setHeaderPreview(null);
    setFooterPreview(null);
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
          <p className="text-muted-foreground text-xs mt-1">إدارة ترويسات المحامين (Header & Footer)</p>
        </div>
        <Button onClick={() => setShowForm(true)} className="gap-1.5">
          <Plus className="h-4 w-4" /> ترويسة جديدة
        </Button>
      </div>

      {/* Add form */}
      {showForm && (
        <Card className="border-primary/20">
          <CardContent className="pt-5 space-y-4">
            <Input
              placeholder="اسم المحامي *"
              value={lawyerName}
              onChange={e => setLawyerName(e.target.value)}
              className="text-sm"
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Header upload */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">ترويسة أعلى (Header)</label>
                <label className="flex flex-col items-center justify-center border-2 border-dashed border-border rounded-lg p-4 cursor-pointer hover:border-primary/40 transition-colors min-h-[120px]">
                  {headerPreview ? (
                    <img src={headerPreview} alt="Header" className="max-h-[100px] object-contain" />
                  ) : (
                    <>
                      <FileImage className="h-8 w-8 text-muted-foreground mb-2" />
                      <span className="text-xs text-muted-foreground">اختر صورة الترويسة العلوية</span>
                    </>
                  )}
                  <input type="file" accept="image/*" className="hidden"
                    onChange={e => e.target.files?.[0] && handleFileSelect(e.target.files[0], 'header')} />
                </label>
              </div>

              {/* Footer upload */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">ترويسة أسفل (Footer)</label>
                <label className="flex flex-col items-center justify-center border-2 border-dashed border-border rounded-lg p-4 cursor-pointer hover:border-primary/40 transition-colors min-h-[120px]">
                  {footerPreview ? (
                    <img src={footerPreview} alt="Footer" className="max-h-[100px] object-contain" />
                  ) : (
                    <>
                      <FileImage className="h-8 w-8 text-muted-foreground mb-2" />
                      <span className="text-xs text-muted-foreground">اختر صورة التذييل</span>
                    </>
                  )}
                  <input type="file" accept="image/*" className="hidden"
                    onChange={e => e.target.files?.[0] && handleFileSelect(e.target.files[0], 'footer')} />
                </label>
              </div>
            </div>

            <div className="flex gap-2">
              <Button onClick={save} disabled={!lawyerName.trim() || saving} className="gap-1.5">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                حفظ الترويسة
              </Button>
              <Button variant="ghost" onClick={resetForm}>إلغاء</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Letterheads list */}
      {letterheads.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground text-sm">
            <Stamp className="h-8 w-8 mx-auto mb-2 opacity-20" />
            لا توجد ترويسات. أضف ترويسة جديدة لاستخدامها في تصدير المستندات.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {letterheads.map(lh => (
            <Card key={lh.id} className="hover:border-primary/30 transition-colors">
              <CardContent className="pt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-foreground text-sm">{lh.lawyer_name}</h3>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive"
                      onClick={() => deleteLetterhead(lh)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {lh.header_image_path ? (
                    <button onClick={() => setPreviewImg(getPublicUrl(lh.header_image_path!))}
                      className="border border-border rounded-lg overflow-hidden h-16 flex items-center justify-center bg-muted/30 hover:border-primary/40 transition-colors">
                      <img src={getPublicUrl(lh.header_image_path)} alt="Header" className="max-h-full object-contain" />
                    </button>
                  ) : (
                    <div className="border border-border rounded-lg h-16 flex items-center justify-center text-xs text-muted-foreground">بدون Header</div>
                  )}
                  {lh.footer_image_path ? (
                    <button onClick={() => setPreviewImg(getPublicUrl(lh.footer_image_path!))}
                      className="border border-border rounded-lg overflow-hidden h-16 flex items-center justify-center bg-muted/30 hover:border-primary/40 transition-colors">
                      <img src={getPublicUrl(lh.footer_image_path)} alt="Footer" className="max-h-full object-contain" />
                    </button>
                  ) : (
                    <div className="border border-border rounded-lg h-16 flex items-center justify-center text-xs text-muted-foreground">بدون Footer</div>
                  )}
                </div>

                <p className="text-[10px] text-muted-foreground">
                  {new Date(lh.created_at).toLocaleDateString('ar-MA')}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Image preview */}
      <Dialog open={!!previewImg} onOpenChange={() => setPreviewImg(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>معاينة</DialogTitle></DialogHeader>
          {previewImg && <img src={previewImg} alt="Preview" className="w-full object-contain" />}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Letterheads;
