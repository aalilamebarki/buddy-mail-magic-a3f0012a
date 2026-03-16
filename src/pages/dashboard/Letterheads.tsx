import { useState, useEffect } from 'react';
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


  const generatePreview = async (file: File) => {
    setPreviewLoading(true);
    try {
      const ext = file.name.split('.').pop()?.toLowerCase();
      const arrayBuffer = await file.arrayBuffer();
      
      if (ext === 'docx') {
        const result = await mammoth.convertToHtml({ arrayBuffer });
        setPreviewHtml(result.value || '<p style="color:gray;text-align:center;">الملف فارغ</p>');
      } else if (ext === 'doc') {
        // mammoth has limited .doc support - try but handle gracefully
        try {
          const result = await mammoth.convertToHtml({ arrayBuffer });
          if (result.value && result.value.trim()) {
            setPreviewHtml(result.value);
          } else {
            setPreviewHtml(`<div style="text-align:center;color:gray;padding:20px;">
              <p style="font-size:14px;">📄 ${file.name}</p>
              <p style="font-size:12px;">ملف .doc تم رفعه بنجاح</p>
              <p style="font-size:11px;color:#999;">المعاينة قد لا تكون متاحة لملفات .doc القديمة</p>
            </div>`);
          }
        } catch {
          setPreviewHtml(`<div style="text-align:center;color:gray;padding:20px;">
            <p style="font-size:14px;">📄 ${file.name}</p>
            <p style="font-size:12px;">ملف .doc تم رفعه بنجاح</p>
            <p style="font-size:11px;color:#999;">المعاينة غير متاحة لهذا النوع من الملفات</p>
          </div>`);
        }
      } else {
        setPreviewHtml('<p style="color:gray;text-align:center;">صيغة غير مدعومة</p>');
      }
    } catch (e) {
      console.error('Preview error:', e);
      setPreviewHtml(`<div style="text-align:center;color:gray;padding:20px;">
        <p style="font-size:14px;">📄 ${file.name}</p>
        <p style="font-size:12px;">تم رفع الملف بنجاح</p>
      </div>`);
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleTemplateChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const nextFile = event.target.files?.[0] ?? null;
    event.target.value = '';

    if (!nextFile) return;

    const ext = nextFile.name.split('.').pop()?.toLowerCase();
    if (ext !== 'doc' && ext !== 'docx') {
      toast({ title: 'صيغة غير مدعومة', description: 'يرجى اختيار ملف .doc أو .docx', variant: 'destructive' });
      return;
    }

    setTemplateFile(nextFile);
    await generatePreview(nextFile);
  };

  const loadLetterheads = async () => {
    const { data } = await supabase
      .from('letterheads')
      .select('id, lawyer_name, template_path, created_at')
      .order('created_at', { ascending: false }) as any;
    if (data) setLetterheads(data);
    setLoading(false);
  };

  const previewExisting = async (lh: Letterhead) => {
    if (!lh.template_path) return;
    setPreviewLoading(true);
    try {
      const { data, error } = await supabase.storage.from('letterhead-templates').download(lh.template_path);
      if (error || !data) throw error;
      const arrayBuffer = await data.arrayBuffer();
      const result = await mammoth.convertToHtml({ arrayBuffer });
      setPreviewHtml(result.value);
    } catch {
      setPreviewHtml('<p style="color:gray;text-align:center;">تعذر عرض معاينة هذا الملف</p>');
    } finally {
      setPreviewLoading(false);
    }
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
        const ext = templateFile.name.split('.').pop()?.toLowerCase() || 'docx';
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
      setLetterheads(prev => prev.filter(x => x.id !== lh.id));
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
              onChange={e => setLawyerName(e.target.value)}
              className="text-sm"
              dir="rtl"
            />
            <div
              className="border-2 border-dashed border-muted-foreground/30 rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => fileRef.current?.click()}
            >
              <input
                ref={fileRef}
                type="file"
                accept=".doc,.docx"
                className="hidden"
                onChange={e => {
                  const f = e.target.files?.[0];
                  if (f) setTemplateFile(f);
                }}
              />
              {templateFile ? (
                <div className="flex items-center justify-center gap-2 text-sm text-foreground">
                  <FileText className="h-5 w-5 text-primary" />
                  <span>{templateFile.name}</span>
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={e => { e.stopPropagation(); setTemplateFile(null); }}>
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ) : (
                <div className="space-y-1">
                  <Upload className="h-8 w-8 mx-auto text-muted-foreground/50" />
                  <p className="text-sm text-muted-foreground">اضغط لرفع ملف الترويسة (.doc أو .docx)</p>
                  {editingId && <p className="text-xs text-muted-foreground/70">اتركه فارغاً للإبقاء على الملف الحالي</p>}
                </div>
              )}
            </div>

            {/* Preview section */}
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
              <Button onClick={save} disabled={!lawyerName.trim() || saving} className="gap-1.5">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {editingId ? 'حفظ التعديلات' : 'حفظ الترويسة'}
              </Button>
              <Button variant="ghost" onClick={resetForm}><X className="h-4 w-4 ml-1" /> إلغاء</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Preview for existing letterheads (outside form) */}
      {!showForm && previewHtml && (
        <Card>
          <CardContent className="pt-4 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Eye className="h-4 w-4 text-primary" />
                <span className="text-sm font-bold text-foreground">معاينة القالب</span>
              </div>
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setPreviewHtml(null)}>
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
                        {lh.template_path ? '📎 ملف مرفق' : 'بدون ملف'}
                        {' • '}{new Date(lh.created_at).toLocaleDateString('ar-MA')}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    {lh.template_path && (
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => previewExisting(lh)} title="معاينة">
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                    )}
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
