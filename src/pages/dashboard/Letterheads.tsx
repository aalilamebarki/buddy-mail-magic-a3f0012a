import React, { useEffect, useMemo, useRef, useState } from 'react';
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

interface DraftState {
  lawyerName: string;
  pendingTemplatePath: string | null;
  pendingTemplateName: string | null;
  showForm: boolean;
}

const DRAFT_STORAGE_KEY = 'letterhead-draft-v1';

const hasDraftData = (draft: DraftState) => Boolean(
  draft.showForm || draft.lawyerName || draft.pendingTemplatePath || draft.pendingTemplateName
);

const readStoredDraft = (): DraftState | null => {
  if (typeof window === 'undefined') return null;

  const rawDraft = window.sessionStorage.getItem(DRAFT_STORAGE_KEY);
  if (!rawDraft) return null;

  return JSON.parse(rawDraft) as DraftState;
};

const writeStoredDraft = (draft: DraftState | null) => {
  if (typeof window === 'undefined') return;

  if (!draft || !hasDraftData(draft)) {
    window.sessionStorage.removeItem(DRAFT_STORAGE_KEY);
    return;
  }

  window.sessionStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
};

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
  const [uploadingTemplate, setUploadingTemplate] = useState(false);
  const [lawyerName, setLawyerName] = useState('');
  const [templateFile, setTemplateFile] = useState<File | null>(null);
  const [pendingTemplatePath, setPendingTemplatePath] = useState<string | null>(null);
  const [pendingTemplateName, setPendingTemplateName] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [draftRestored, setDraftRestored] = useState(false);

  useEffect(() => {
    if (!user) return;
    loadLetterheads();
  }, [user]);

  useEffect(() => {
    if (draftRestored) return;

    try {
      const draft = readStoredDraft();
      if (!draft) {
        setDraftRestored(true);
        return;
      }

      setLawyerName(draft.lawyerName || '');
      setPendingTemplatePath(draft.pendingTemplatePath || null);
      setPendingTemplateName(draft.pendingTemplateName || null);
      setShowForm(Boolean(draft.showForm));
    } catch (error) {
      console.error('Failed to restore draft:', error);
      writeStoredDraft(null);
    } finally {
      setDraftRestored(true);
    }
  }, [draftRestored]);

  useEffect(() => {
    if (!draftRestored) return;

    writeStoredDraft({
      lawyerName,
      pendingTemplatePath,
      pendingTemplateName,
      showForm,
    });
  }, [draftRestored, lawyerName, pendingTemplatePath, pendingTemplateName, showForm]);

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

  const previewPendingTemplate = async () => {
    if (!pendingTemplatePath) return;

    setPreviewLoading(true);
    try {
      const { data, error } = await supabase.storage.from('letterhead-templates').download(pendingTemplatePath);
      if (error || !data) throw error;

      const fileName = pendingTemplateName || pendingTemplatePath.split('/').pop() || 'template.docx';
      const html = await buildPreviewHtml(fileName, await data.arrayBuffer());
      setPreviewHtml(html);
    } catch {
      setPreviewHtml('<p style="color:gray;text-align:center;">تعذر عرض معاينة هذا الملف</p>');
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

  const cleanupPendingUpload = async (path: string | null) => {
    if (!path) return;
    await supabase.storage.from('letterhead-templates').remove([path]);
  };

  const handleTemplateChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    event.preventDefault();
    event.stopPropagation();

    const nextFile = event.currentTarget.files?.[0] ?? null;
    event.currentTarget.value = '';

    if (!nextFile || !user) return;

    const ext = getFileExtension(nextFile.name);
    if (ext !== 'doc' && ext !== 'docx') {
      toast({
        title: 'صيغة غير مدعومة',
        description: 'يرجى اختيار ملف .doc أو .docx',
        variant: 'destructive',
      });
      return;
    }

    const draftBeforeUpload: DraftState = {
      lawyerName,
      pendingTemplatePath,
      pendingTemplateName,
      showForm: true,
    };

    writeStoredDraft(draftBeforeUpload);
    setUploadingTemplate(true);
    setTemplateFile(nextFile);
    setPreviewHtml(null);
    setShowForm(true);

    try {
      const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from('letterhead-templates').upload(path, nextFile, {
        upsert: false,
      });

      if (error) throw error;

      const oldPendingPath = pendingTemplatePath;
      const nextDraft: DraftState = {
        lawyerName,
        pendingTemplatePath: path,
        pendingTemplateName: nextFile.name,
        showForm: true,
      };

      writeStoredDraft(nextDraft);
      setPendingTemplatePath(path);
      setPendingTemplateName(nextFile.name);
      toast({ title: 'تم تجهيز ملف الترويسة ✅' });

      if (oldPendingPath && oldPendingPath !== path) {
        cleanupPendingUpload(oldPendingPath);
      }
    } catch (error: any) {
      writeStoredDraft(draftBeforeUpload);
      setTemplateFile(null);
      setPendingTemplatePath(draftBeforeUpload.pendingTemplatePath);
      setPendingTemplateName(draftBeforeUpload.pendingTemplateName);
      toast({ title: 'خطأ في رفع الملف', description: error.message, variant: 'destructive' });
    } finally {
      setUploadingTemplate(false);
    }
  };

  const save = async () => {
    if (!user || !lawyerName.trim()) return;

    const finalTemplatePath = pendingTemplatePath;
    if (!editingId && !finalTemplatePath) {
      toast({ title: 'يرجى رفع ملف الترويسة', variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      const payload: any = {
        user_id: user.id,
        lawyer_name: lawyerName.trim(),
        ...(finalTemplatePath && { template_path: finalTemplatePath }),
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

      writeStoredDraft(null);
      resetForm(false);
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
    setPendingTemplatePath(lh.template_path);
    setPendingTemplateName(lh.template_path?.split('/').pop() || null);
    setPreviewHtml(null);
    setShowForm(true);
    writeStoredDraft({
      lawyerName: lh.lawyer_name,
      pendingTemplatePath: lh.template_path,
      pendingTemplateName: lh.template_path?.split('/').pop() || null,
      showForm: true,
    });
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

  const resetForm = (removePending = true) => {
    const pathToCleanup = removePending ? pendingTemplatePath : null;

    setShowForm(false);
    setEditingId(null);
    setLawyerName('');
    setTemplateFile(null);
    setPendingTemplatePath(null);
    setPendingTemplateName(null);
    setPreviewHtml(null);
    setPreviewLoading(false);
    setUploadingTemplate(false);
    writeStoredDraft(null);

    if (pathToCleanup) {
      cleanupPendingUpload(pathToCleanup);
    }
  };

  const selectedTemplateLabel = useMemo(() => {
    if (pendingTemplateName) return pendingTemplateName;
    if (templateFile) return templateFile.name;
    return null;
  }, [pendingTemplateName, templateFile]);

  if (loading) {
    return <div className="flex items-center justify-center h-[60vh]"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const triggerFilePicker = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="space-y-6">
      {/* Hidden file input - always mounted to survive mobile browser re-renders */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".doc,.docx"
        onChange={handleTemplateChange}
        className="hidden"
        tabIndex={-1}
        aria-hidden="true"
      />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Stamp className="h-5 w-5 text-primary" />
            الترويسات
          </h1>
          <p className="text-muted-foreground text-xs mt-1">اختر ملف Word كقالب، وسيتم حفظه مؤقتاً فوراً حتى لا يضيع إذا أعادت الصفحة التهيئة</p>
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

              <Button
                type="button"
                variant="outline"
                onClick={triggerFilePicker}
                disabled={uploadingTemplate}
                className="w-full gap-2"
              >
                <Upload className="h-4 w-4" />
                {uploadingTemplate ? 'جاري الرفع...' : 'اختر ملف (.doc / .docx)'}
              </Button>

              {uploadingTemplate && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  <span>جاري تجهيز الملف...</span>
                </div>
              )}

              {selectedTemplateLabel ? (
                <div className="flex items-center justify-between gap-2 rounded-md bg-muted/50 px-3 py-2 text-sm text-foreground">
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText className="h-4 w-4 text-primary shrink-0" />
                    <span className="truncate">{selectedTemplateLabel}</span>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 shrink-0"
                    onClick={() => {
                      if (editingId) {
                        setTemplateFile(null);
                        setPendingTemplateName(null);
                        setPreviewHtml(null);
                        return;
                      }
                      resetForm();
                      setShowForm(true);
                    }}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">الصيغ المدعومة: .doc و .docx</p>
              )}
            </div>

            {pendingTemplatePath && (
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={templateFile ? () => generatePreview(templateFile) : previewPendingTemplate}
                  disabled={previewLoading || uploadingTemplate}
                  className="gap-1.5"
                >
                  {previewLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}
                  {previewHtml ? 'تحديث المعاينة' : 'معاينة الملف'}
                </Button>
                <span className="text-xs text-muted-foreground">الملف محفوظ مؤقتاً حتى تضغط حفظ الترويسة</span>
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
              <Button
                type="button"
                onClick={save}
                disabled={!lawyerName.trim() || saving || uploadingTemplate || (!editingId && !pendingTemplatePath)}
                className="gap-1.5"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {editingId ? 'حفظ التعديلات' : 'حفظ الترويسة'}
              </Button>
              <Button type="button" variant="ghost" onClick={() => resetForm()}><X className="h-4 w-4 ml-1" /> إلغاء</Button>
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
