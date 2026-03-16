import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Plus, Trash2, FileText, Loader2, Stamp, Edit2, Save, X, Upload, Eye } from 'lucide-react';
import mammoth from 'mammoth';

interface Letterhead {
  id: string;
  lawyer_name: string;
  template_path: string | null;
  created_at: string;
}

const fallbackPreview = (fileName: string, message: string) => `
  <div style="text-align:center;color:gray;padding:20px;">
    <p style="font-size:14px;">📄 ${fileName}</p>
    <p style="font-size:12px;">${message}</p>
  </div>
`;

const getFileExtension = (fileName: string) => fileName.split('.').pop()?.toLowerCase();

const Letterheads = () => {
  const { user } = useAuth();
  const { toast } = useToast();

  const [letterheads, setLetterheads] = useState<Letterhead[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [lawyerName, setLawyerName] = useState('');
  const [templateFile, setTemplateFile] = useState<File | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

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

  const buildPreviewHtml = async (fileName: string, arrayBuffer: ArrayBuffer) => {
    const ext = getFileExtension(fileName);

    if (ext === 'docx') {
      const result = await mammoth.convertToHtml({ arrayBuffer });
      return result.value || '<p style="color:gray;text-align:center;">الملف فارغ</p>';
    }

    if (ext === 'doc') {
      try {
        const result = await mammoth.convertToHtml({ arrayBuffer });
        return result.value?.trim()
          ? result.value
          : fallbackPreview(fileName, 'ملف .doc تم اختياره بنجاح، لكن المعاينة قد لا تكون متاحة');
      } catch {
        return fallbackPreview(fileName, 'ملف .doc تم اختياره بنجاح، لكن المعاينة غير متاحة');
      }
    }

    return '<p style="color:gray;text-align:center;">صيغة غير مدعومة</p>';
  };

  const generatePreview = async (file: File) => {
    setPreviewLoading(true);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const html = await buildPreviewHtml(file.name, arrayBuffer);
      setPreviewHtml(html);
    } catch (error) {
      console.error('Preview error:', error);
      setPreviewHtml(fallbackPreview(file.name, 'تم اختيار الملف بنجاح'));
    } finally {
      setPreviewLoading(false);
    }
  };

  const previewExisting = async (lh: Letterhead) => {
    if (!lh.template_path) return;

    setPreviewLoading(true);
    try {
      const { data, error } = await supabase.storage.from('letterhead-templates').download(lh.template_path);
      if (error || !data) throw error;

      const html = await buildPreviewHtml(lh.template_path.split('/').pop() || lh.lawyer_name, await data.arrayBuffer());
      setPreviewHtml(html);
    } catch {
      setPreviewHtml('<p style="color:gray;text-align:center;">تعذر عرض معاينة هذا الملف</p>');
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleTemplateChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const nextFile = event.target.files?.[0] ?? null;
    event.target.value = '';

    if (!nextFile) return;

    const ext = getFileExtension(nextFile.name);
    if (ext !== 'doc' && ext !== 'docx') {
      toast({
        title: 'صيغة غير مدعومة',
        description: 'يرجى اختيار ملف .doc أو .docx',
        variant: 'destructive',
      });
      return;
    }

    setTemplateFile(nextFile);
    setPreviewHtml(null);
    setPreviewLoading(false);
  };

  const save = async () => {
    if (!user || !lawyerName.trim()) return;

    if (!editingId && !templateFile) {
      toast({ title: 'يرجى رفع ملف الترويسة', variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      let templatePath: string | null = null;

      if (templateFile) {
        const ext = getFileExtension(templateFile.name) || 'docx';
        const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
        const { error: uploadErr } = await supabase.storage.from('letterhead-templates').upload(path, templateFile);
        if (uploadErr) throw uploadErr;
        templatePath = path;
      }

      const payload: any = {
        user_id: user.id,
        lawyer_name: lawyerName.trim(),
        ...(templatePath && { template_path: templatePath }),
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
    setLawyerName(lh.lawyer_name);
    setTemplateFile(null);
    setPreviewHtml(null);
    setShowForm(true);
  };

  const deleteLetterhead = async (lh: Letterhead) => {
    try {
      if (lh.template_path) {
        await supabase.storage.from('letterhead-templates').remove([lh.template_path]);
      }

      const { error } = await supabase.from('letterheads').delete().eq('id', lh.id) as any;
      if (error) throw error;

      setLetterheads((prev) => prev.filter((x) => x.id !== lh.id));
      toast({ title: 'تم حذف الترويسة' });
    } catch (e: any) {
      toast({ title: 'خطأ', description: e.message, variant: 'destructive' });
    }
  };

  const resetForm = () => {
    setShowForm(false);
    setEditingId(null);
    setLawyerName('');
    setTemplateFile(null);
    setPreviewHtml(null);
    setPreviewLoading(false);
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
          <p className="text-muted-foreground text-xs mt-1">ارفع ملف Word (.doc أو .docx) كقالب ترويسة وسيتم لصق النص المولّد داخله</p>
        </div>
        <Button type="button" onClick={() => { resetForm(); setShowForm(true); }} className="gap-1.5">
          <Plus className="h-4 w-4" /> ترويسة جديدة
        </Button>
      </div>

      {showForm && (
        <Card className="border-primary/20">
          <CardContent className="pt-5 space-y-3">
            <h3 className="text-sm font-bold text-foreground">{editingId ? 'تعديل الترويسة' : 'ترويسة جديدة'}</h3>

            <Input
              placeholder="اسم المحامي / اسم الترويسة *"
              value={lawyerName}
              onChange={(e) => setLawyerName(e.target.value)}
              className="text-sm"
              dir="rtl"
            />

            <div className="space-y-3 rounded-lg border border-border p-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Upload className="h-4 w-4" />
                <span>اختر ملف الترويسة من جهازك</span>
              </div>

              <input
                type="file"
                accept=".doc,.docx"
                onChange={handleTemplateChange}
                className="block w-full cursor-pointer rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground file:mr-3 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-secondary-foreground"
              />

              {templateFile ? (
                <div className="flex items-center justify-between gap-2 rounded-md bg-muted/50 px-3 py-2 text-sm text-foreground">
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText className="h-4 w-4 text-primary shrink-0" />
                    <span className="truncate">{templateFile.name}</span>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 shrink-0"
                    onClick={() => {
                      setTemplateFile(null);
                      setPreviewHtml(null);
                      setPreviewLoading(false);
                    }}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">الصيغ المدعومة: .doc و .docx</p>
              )}
            </div>

            {templateFile && (
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => generatePreview(templateFile)}
                  disabled={previewLoading}
                  className="gap-1.5"
                >
                  {previewLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}
                  {previewHtml ? 'تحديث المعاينة' : 'معاينة الملف'}
                </Button>
                <span className="text-xs text-muted-foreground">المعاينة اختيارية قبل الحفظ</span>
              </div>
            )}

            {previewLoading && (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                <span className="text-sm text-muted-foreground mr-2">جاري تحميل المعاينة...</span>
              </div>
            )}

            {previewHtml && !previewLoading && (
              <div className="border border-border rounded-lg overflow-hidden">
                <div className="bg-muted/50 px-3 py-1.5 flex items-center gap-1.5 border-b border-border">
                  <Eye className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-xs font-medium text-muted-foreground">معاينة القالب</span>
                </div>
                <ScrollArea className="h-[300px]">
                  <div
                    className="p-4 prose prose-sm max-w-none dark:prose-invert text-foreground"
                    dir="auto"
                    dangerouslySetInnerHTML={{ __html: previewHtml }}
                  />
                </ScrollArea>
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <Button type="button" onClick={save} disabled={!lawyerName.trim() || saving} className="gap-1.5">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {editingId ? 'حفظ التعديلات' : 'حفظ الترويسة'}
              </Button>
              <Button type="button" variant="ghost" onClick={resetForm}><X className="h-4 w-4 ml-1" /> إلغاء</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {!showForm && previewHtml && (
        <Card>
          <CardContent className="pt-4 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Eye className="h-4 w-4 text-primary" />
                <span className="text-sm font-bold text-foreground">معاينة القالب</span>
              </div>
              <Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setPreviewHtml(null)}>
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
            <ScrollArea className="h-[300px] border border-border rounded-lg">
              <div
                className="p-4 prose prose-sm max-w-none dark:prose-invert text-foreground"
                dir="auto"
                dangerouslySetInnerHTML={{ __html: previewHtml }}
              />
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {letterheads.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground text-sm">
            <Stamp className="h-8 w-8 mx-auto mb-2 opacity-20" />
            لا توجد ترويسات. ارفع ملف Word كقالب ترويسة.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {letterheads.map((lh) => (
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
                        {lh.template_path ? '📎 ملف مرفق' : 'بدون ملف'}
                        {' • '}{new Date(lh.created_at).toLocaleDateString('ar-MA')}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    {lh.template_path && (
                      <Button type="button" variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => previewExisting(lh)} title="معاينة">
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    <Button type="button" variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => startEdit(lh)}>
                      <Edit2 className="h-3.5 w-3.5" />
                    </Button>
                    <Button type="button" variant="ghost" size="sm" className="h-8 w-8 p-0 text-destructive" onClick={() => deleteLetterhead(lh)}>
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
