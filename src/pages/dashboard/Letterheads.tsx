import { useEffect, useMemo, useRef, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Plus, Trash2, FileText, Loader2, Stamp, Edit2, Save, X, Upload, Eye, Phone, Mail, MapPin, Building2, User, RefreshCw, Scan, Type, Image as ImageIcon, Ruler, Palette } from 'lucide-react';
import { extractLetterheadInfo } from '@/lib/extract-letterhead-info';
import { parseLetterheadStructure, type LetterheadStructure } from '@/lib/parse-letterhead-structure';
import DocxPreview, { type DocxPreviewHandle } from '@/components/DocxPreview';

interface Letterhead {
  id: string;
  lawyer_name: string;
  name_fr: string | null;
  title_ar: string | null;
  title_fr: string | null;
  bar_name_ar: string | null;
  bar_name_fr: string | null;
  address: string | null;
  city: string | null;
  phone: string | null;
  email: string | null;
  template_path: string | null;
  header_data: any;
  created_at: string;
}

interface LetterheadFormFields {
  lawyerName: string;
  nameFr: string;
  titleAr: string;
  titleFr: string;
  barNameAr: string;
  barNameFr: string;
  address: string;
  city: string;
  phone: string;
  email: string;
}

const emptyFields: LetterheadFormFields = {
  lawyerName: '',
  nameFr: '',
  titleAr: '',
  titleFr: '',
  barNameAr: '',
  barNameFr: '',
  address: '',
  city: '',
  phone: '',
  email: '',
};

interface DraftState extends LetterheadFormFields {
  pendingTemplatePath: string | null;
  pendingTemplateName: string | null;
  showForm: boolean;
}

const DRAFT_STORAGE_KEY = 'letterhead-draft-v2';

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
  const [fields, setFields] = useState<LetterheadFormFields>(emptyFields);
  const [templateFile, setTemplateFile] = useState<File | null>(null);
  const [pendingTemplatePath, setPendingTemplatePath] = useState<string | null>(null);
  const [pendingTemplateName, setPendingTemplateName] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [parsedStructure, setParsedStructure] = useState<any>(null);
  const [draftRestored, setDraftRestored] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewRef = useRef<DocxPreviewHandle>(null);

  const setField = (key: keyof LetterheadFormFields, value: string) =>
    setFields(prev => ({ ...prev, [key]: value }));

  useEffect(() => {
    if (!user) return;
    loadLetterheads();
  }, [user]);

  useEffect(() => {
    if (draftRestored) return;
    try {
      const draft = readStoredDraft();
      if (!draft) { setDraftRestored(true); return; }
      setFields({
        lawyerName: draft.lawyerName || '',
        nameFr: draft.nameFr || '',
        titleAr: draft.titleAr || '',
        titleFr: draft.titleFr || '',
        barNameAr: draft.barNameAr || '',
        barNameFr: draft.barNameFr || '',
        address: draft.address || '',
        city: draft.city || '',
        phone: draft.phone || '',
        email: draft.email || '',
      });
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
      ...fields,
      pendingTemplatePath,
      pendingTemplateName,
      showForm,
    });
  }, [draftRestored, fields, pendingTemplatePath, pendingTemplateName, showForm]);

  const loadLetterheads = async () => {
    const { data } = await supabase
      .from('letterheads')
      .select('id, lawyer_name, name_fr, title_ar, title_fr, bar_name_ar, bar_name_fr, address, city, phone, email, template_path, created_at')
      .order('created_at', { ascending: false });

    if (data) setLetterheads(data);
    setLoading(false);
  };

  const generatePreview = async (file: File) => {
    previewRef.current?.previewBlob(file);
  };

  const previewPendingTemplate = async () => {
    if (!pendingTemplatePath) return;
    previewRef.current?.previewFromStorage('letterhead-templates', pendingTemplatePath);
  };

  const previewExisting = async (lh: Letterhead) => {
    if (!lh.template_path) return;
    previewRef.current?.previewFromStorage('letterhead-templates', lh.template_path);
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
    if (ext !== 'docx') {
      toast({ title: 'صيغة غير مدعومة', description: 'يرجى اختيار ملف بصيغة .docx فقط', variant: 'destructive' });
      return;
    }

    const draftBeforeUpload: DraftState = { ...fields, pendingTemplatePath, pendingTemplateName, showForm: true };
    writeStoredDraft(draftBeforeUpload);
    setUploadingTemplate(true);
    setTemplateFile(nextFile);
    previewRef.current?.clear();
    setShowForm(true);

    try {
      const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from('letterhead-templates').upload(path, nextFile, { upsert: false });
      if (error) throw error;

      const oldPendingPath = pendingTemplatePath;
      writeStoredDraft({ ...fields, pendingTemplatePath: path, pendingTemplateName: nextFile.name, showForm: true });
      setPendingTemplatePath(path);
      setPendingTemplateName(nextFile.name);

      // Auto-extract letterhead info AND parse structure
      try {
        const [extracted, structure] = await Promise.all([
          extractLetterheadInfo(nextFile),
          parseLetterheadStructure(nextFile),
        ]);
        setParsedStructure(structure);

        const newFields = { ...fields };
        let filled = 0;
        if (extracted.lawyerName && !fields.lawyerName) { newFields.lawyerName = extracted.lawyerName; filled++; }
        if (extracted.nameFr && !fields.nameFr) { newFields.nameFr = extracted.nameFr; filled++; }
        if (extracted.titleAr && !fields.titleAr) { newFields.titleAr = extracted.titleAr; filled++; }
        if (extracted.titleFr && !fields.titleFr) { newFields.titleFr = extracted.titleFr; filled++; }
        if (extracted.barNameAr && !fields.barNameAr) { newFields.barNameAr = extracted.barNameAr; filled++; }
        if (extracted.barNameFr && !fields.barNameFr) { newFields.barNameFr = extracted.barNameFr; filled++; }
        if (extracted.address && !fields.address) { newFields.address = extracted.address; filled++; }
        if (extracted.city && !fields.city) { newFields.city = extracted.city; filled++; }
        if (extracted.phone && !fields.phone) { newFields.phone = extracted.phone; filled++; }
        if (extracted.email && !fields.email) { newFields.email = extracted.email; filled++; }
        setFields(newFields);

        const structInfo = structure.headerParagraphs.length > 0
          ? ` + ${structure.headerParagraphs.length} فقرات ترويسة`
          : '';
        if (filled > 0) {
          toast({ title: `تم استخراج ${filled} حقول${structInfo} ✅`, description: 'راجع البيانات وأكمل ما يلزم' });
        } else {
          toast({ title: `تم تجهيز ملف الترويسة${structInfo} ✅` });
        }
      } catch {
        toast({ title: 'تم تجهيز ملف الترويسة ✅' });
      }

      if (oldPendingPath && oldPendingPath !== path) cleanupPendingUpload(oldPendingPath);
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
    if (!user || !fields.lawyerName.trim()) return;

    const finalTemplatePath = pendingTemplatePath;
    if (!editingId && !finalTemplatePath) {
      toast({ title: 'يرجى رفع ملف الترويسة', variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      const payload = {
        user_id: user.id,
        lawyer_name: fields.lawyerName.trim(),
        name_fr: fields.nameFr.trim() || null,
        title_ar: fields.titleAr.trim() || null,
        title_fr: fields.titleFr.trim() || null,
        bar_name_ar: fields.barNameAr.trim() || null,
        bar_name_fr: fields.barNameFr.trim() || null,
        address: fields.address.trim() || null,
        city: fields.city.trim() || null,
        phone: fields.phone.trim() || null,
        email: fields.email.trim() || null,
        ...(finalTemplatePath && { template_path: finalTemplatePath }),
        ...(parsedStructure && { header_data: parsedStructure }),
      };

      if (editingId) {
        const { error } = await supabase.from('letterheads').update(payload).eq('id', editingId);
        if (error) throw error;
        toast({ title: 'تم تعديل الترويسة ✅' });
      } else {
        const { error } = await supabase.from('letterheads').insert(payload as any);
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
    setFields({
      lawyerName: lh.lawyer_name,
      nameFr: lh.name_fr || '',
      titleAr: lh.title_ar || '',
      titleFr: lh.title_fr || '',
      barNameAr: lh.bar_name_ar || '',
      barNameFr: lh.bar_name_fr || '',
      address: lh.address || '',
      city: lh.city || '',
      phone: lh.phone || '',
      email: lh.email || '',
    });
    setTemplateFile(null);
    setPendingTemplatePath(lh.template_path);
    setPendingTemplateName(lh.template_path?.split('/').pop() || null);
    previewRef.current?.clear();
    setShowForm(true);
  };

  const [extracting, setExtracting] = useState(false);

  const reExtractFromTemplate = async () => {
    const path = pendingTemplatePath;
    if (!path) {
      toast({ title: 'لا يوجد ملف قالب مرفق', variant: 'destructive' });
      return;
    }
    setExtracting(true);
    try {
      const { data, error } = await supabase.storage.from('letterhead-templates').download(path);
      if (error || !data) throw error || new Error('تعذر تحميل القالب');

      const [extracted, structure] = await Promise.all([
        extractLetterheadInfo(data),
        parseLetterheadStructure(data),
      ]);
      setParsedStructure(structure);

      const newFields = { ...fields };
      let filled = 0;

      if (extracted.lawyerName && !fields.lawyerName) { newFields.lawyerName = extracted.lawyerName; filled++; }
      if (extracted.nameFr) { newFields.nameFr = extracted.nameFr; filled++; }
      if (extracted.titleAr) { newFields.titleAr = extracted.titleAr; filled++; }
      if (extracted.titleFr) { newFields.titleFr = extracted.titleFr; filled++; }
      if (extracted.barNameAr) { newFields.barNameAr = extracted.barNameAr; filled++; }
      if (extracted.barNameFr) { newFields.barNameFr = extracted.barNameFr; filled++; }
      if (extracted.address) { newFields.address = extracted.address; filled++; }
      if (extracted.city) { newFields.city = extracted.city; filled++; }
      if (extracted.phone) { newFields.phone = extracted.phone; filled++; }
      if (extracted.email) { newFields.email = extracted.email; filled++; }

      setFields(newFields);
      const structInfo = structure.headerParagraphs.length > 0
        ? ` + بنية الترويسة (${structure.headerParagraphs.length} فقرات)`
        : '';
      if (filled > 0) {
        toast({ title: `تم استخراج ${filled} حقول${structInfo} ✅`, description: 'راجع البيانات ثم اضغط حفظ' });
      } else {
        toast({ title: `لم يتم العثور على بيانات إضافية${structInfo}`, variant: filled === 0 && !structInfo ? 'destructive' : 'default' });
      }
    } catch (e: any) {
      toast({ title: 'خطأ في استخراج البيانات', description: e.message, variant: 'destructive' });
    } finally {
      setExtracting(false);
    }
  };

  const deleteLetterhead = async (lh: Letterhead) => {
    try {
      if (lh.template_path) {
        await supabase.storage.from('letterhead-templates').remove([lh.template_path]);
      }
      const { error } = await supabase.from('letterheads').delete().eq('id', lh.id);
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
    setFields(emptyFields);
    setTemplateFile(null);
    setPendingTemplatePath(null);
    setPendingTemplateName(null);
    setParsedStructure(null);
    previewRef.current?.clear();
    setUploadingTemplate(false);
    writeStoredDraft(null);
    if (pathToCleanup) cleanupPendingUpload(pathToCleanup);
  };

  const selectedTemplateLabel = useMemo(() => {
    if (pendingTemplateName) return pendingTemplateName;
    if (templateFile) return templateFile.name;
    return null;
  }, [pendingTemplateName, templateFile]);

  if (loading) {
    return <div className="flex items-center justify-center h-[60vh]"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  const triggerFilePicker = () => fileInputRef.current?.click();

  return (
    <div className="space-y-6">
      <input
        ref={fileInputRef}
        type="file"
        accept=".docx"
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
          <p className="text-muted-foreground text-xs mt-1">أدخل بيانات المحامي وارفع ملف Word كقالب</p>
        </div>
        <Button type="button" onClick={() => { resetForm(); setShowForm(true); }} className="gap-1.5">
          <Plus className="h-4 w-4" /> ترويسة جديدة
        </Button>
      </div>

      {showForm && (
        <Card className="border-primary/20">
          <CardContent className="pt-5 space-y-4">
            <h3 className="text-sm font-bold text-foreground">{editingId ? 'تعديل الترويسة' : 'ترويسة جديدة'}</h3>

            {/* ── الاسم ── */}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                <User className="h-3.5 w-3.5" /> الاسم
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <Input
                  placeholder="اسم المحامي بالعربية *"
                  value={fields.lawyerName}
                  onChange={(e) => setField('lawyerName', e.target.value)}
                  className="text-sm"
                  dir="rtl"
                />
                <Input
                  placeholder="Nom en français (optionnel)"
                  value={fields.nameFr}
                  onChange={(e) => setField('nameFr', e.target.value)}
                  className="text-sm"
                  dir="ltr"
                />
              </div>
            </div>

            {/* ── اللقب المهني ── */}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                <Building2 className="h-3.5 w-3.5" /> اللقب المهني والهيئة
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <Input
                  placeholder="اللقب بالعربية (مثال: محام)"
                  value={fields.titleAr}
                  onChange={(e) => setField('titleAr', e.target.value)}
                  className="text-sm"
                  dir="rtl"
                />
                <Input
                  placeholder="Titre en français (ex: Avocat)"
                  value={fields.titleFr}
                  onChange={(e) => setField('titleFr', e.target.value)}
                  className="text-sm"
                  dir="ltr"
                />
                <Input
                  placeholder="اسم الهيئة بالعربية (مثال: هيئة المحامين بالرباط)"
                  value={fields.barNameAr}
                  onChange={(e) => setField('barNameAr', e.target.value)}
                  className="text-sm"
                  dir="rtl"
                />
                <Input
                  placeholder="Barreau (ex: Barreau de Rabat)"
                  value={fields.barNameFr}
                  onChange={(e) => setField('barNameFr', e.target.value)}
                  className="text-sm"
                  dir="ltr"
                />
              </div>
            </div>

            {/* ── العنوان ── */}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5" /> العنوان
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <Input
                  placeholder="العنوان (شارع، رقم ...)"
                  value={fields.address}
                  onChange={(e) => setField('address', e.target.value)}
                  className="text-sm"
                  dir="rtl"
                />
                <Input
                  placeholder="المدينة"
                  value={fields.city}
                  onChange={(e) => setField('city', e.target.value)}
                  className="text-sm"
                  dir="rtl"
                />
              </div>
            </div>

            {/* ── التواصل ── */}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                <Phone className="h-3.5 w-3.5" /> التواصل
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <Input
                  placeholder="رقم الهاتف"
                  value={fields.phone}
                  onChange={(e) => setField('phone', e.target.value)}
                  className="text-sm"
                  dir="ltr"
                  type="tel"
                />
                <Input
                  placeholder="البريد الإلكتروني"
                  value={fields.email}
                  onChange={(e) => setField('email', e.target.value)}
                  className="text-sm"
                  dir="ltr"
                  type="email"
                />
              </div>
            </div>

            {/* ── ملف القالب ── */}
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
                {uploadingTemplate ? 'جاري الرفع...' : 'اختر ملف (.docx)'}
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
                        previewRef.current?.clear();
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
                <p className="text-xs text-muted-foreground">الصيغة المدعومة: .docx فقط</p>
              )}
            </div>

            {pendingTemplatePath && (
              <div className="flex items-center gap-2 flex-wrap">
                <Button
                  type="button"
                  variant="outline"
                  onClick={templateFile ? () => generatePreview(templateFile) : previewPendingTemplate}
                  disabled={uploadingTemplate}
                  className="gap-1.5"
                >
                  <Eye className="h-4 w-4" />
                  معاينة الملف
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={reExtractFromTemplate}
                  disabled={extracting || uploadingTemplate}
                  className="gap-1.5"
                >
                  {extracting ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                  استخراج البيانات من القالب
                </Button>
                <span className="text-xs text-muted-foreground">الملف محفوظ مؤقتاً حتى تضغط حفظ الترويسة</span>
              </div>
            )}
            {/* Preview is rendered in the always-mounted container below the form */}

            <div className="flex gap-2 pt-2">
              <Button
                type="button"
                onClick={save}
                disabled={!fields.lawyerName.trim() || saving || uploadingTemplate || (!editingId && !pendingTemplatePath)}
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

      <DocxPreview ref={previewRef} title="معاينة القالب" />

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
                        {[lh.name_fr, lh.city, lh.phone].filter(Boolean).join(' · ') || (lh.template_path ? '📎 ملف مرفق' : 'بدون تفاصيل')}
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
