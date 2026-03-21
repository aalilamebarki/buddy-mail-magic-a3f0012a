/**
 * مساعد المزامنة الذكي — نظام "النسخ واللصق" المجاني
 * Smart Sync Assistant — Zero-cost "Copy & Paste" sync system
 * 
 * يسمح للمحامي بجلب بيانات الملف من بوابة محاكم عبر النسخ واللصق
 * بدون أي تكلفة أو خدمات خارجية — يعمل 100% من المتصفح
 */

import { useState, useCallback, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  ClipboardPaste, ExternalLink, CheckCircle2, AlertTriangle,
  ArrowLeft, ArrowRight, Copy, Sparkles, FileText, CalendarDays,
  HelpCircle, Loader2,
} from 'lucide-react';
import { parseMahakimClipboard, normalizeDateStr, type ParsedMahakimData } from '@/lib/mahakim-clipboard-parser';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

interface SmartSyncAssistantProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  caseId: string;
  caseNumber: string;
  /** يُستدعى بعد حفظ البيانات بنجاح */
  onSyncComplete: () => void;
}

type Step = 'guide' | 'paste' | 'preview' | 'saving' | 'done';

export const SmartSyncAssistant = ({
  open,
  onOpenChange,
  caseId,
  caseNumber,
  onSyncComplete,
}: SmartSyncAssistantProps) => {
  const { user } = useAuth();
  const [step, setStep] = useState<Step>('guide');
  const [pastedText, setPastedText] = useState('');
  const [parsedData, setParsedData] = useState<ParsedMahakimData | null>(null);
  const [saving, setSaving] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  /** إعادة تهيئة الحالة عند الإغلاق */
  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      setStep('guide');
      setPastedText('');
      setParsedData(null);
      setSaving(false);
    }
    onOpenChange(isOpen);
  };

  /** فتح بوابة محاكم في نافذة منبثقة */
  const openMahakimPortal = () => {
    const url = `https://www.mahakim.ma/#/suivi/dossier-suivi`;
    window.open(url, 'mahakim_portal', 'width=1200,height=800,scrollbars=yes,resizable=yes');
    // نسخ رقم الملف تلقائياً
    navigator.clipboard.writeText(caseNumber).then(() => {
      toast.info('تم نسخ رقم الملف — الصقه في بوابة محاكم');
    });
  };

  /** معالجة اللصق من الحافظة */
  const handlePaste = useCallback((e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const text = e.clipboardData.getData('text/plain');
    const html = e.clipboardData.getData('text/html');
    
    setPastedText(text);
    
    // تحليل فوري
    const result = parseMahakimClipboard(text, html || undefined);
    setParsedData(result);
    
    if (result.success) {
      setStep('preview');
    }
  }, []);

  /** تحليل يدوي للنص المكتوب */
  const handleManualParse = () => {
    if (!pastedText.trim()) {
      toast.error('الصق محتوى صفحة الملف أولاً');
      return;
    }
    const result = parseMahakimClipboard(pastedText);
    setParsedData(result);
    if (result.success) {
      setStep('preview');
    } else {
      toast.error(result.error || 'لم يتم التعرف على بيانات');
    }
  };

  /** حفظ البيانات المستخرجة في قاعدة البيانات */
  const handleSave = async () => {
    if (!parsedData || !user || !caseId) return;
    setSaving(true);
    setStep('saving');

    try {
      const { caseInfo, procedures, nextSessionDate } = parsedData;

      // 1. تحديث بيانات الملف
      const caseUpdate: Record<string, any> = {
        last_synced_at: new Date().toISOString(),
        last_sync_result: { source: 'clipboard', procedures_count: procedures.length },
      };
      if (caseInfo.judgeName) caseUpdate.mahakim_judge = caseInfo.judgeName;
      if (caseInfo.department) caseUpdate.mahakim_department = caseInfo.department;
      if (caseInfo.caseStatus) caseUpdate.mahakim_status = caseInfo.caseStatus;

      await supabase.from('cases').update(caseUpdate).eq('id', caseId);

      // 2. إدراج الإجراءات (تجنب التكرار)
      if (procedures.length > 0) {
        // جلب الإجراءات الموجودة لتجنب التكرار
        const { data: existingProcs } = await supabase
          .from('case_procedures')
          .select('action_date, action_type')
          .eq('case_id', caseId);

        const existingSet = new Set(
          (existingProcs || []).map(p => `${p.action_date}|${p.action_type}`)
        );

        const newProcedures = procedures
          .filter(p => !existingSet.has(`${p.actionDate}|${p.actionType}`))
          .map(p => ({
            case_id: caseId,
            action_date: p.actionDate,
            action_type: p.actionType,
            decision: p.decision || null,
            next_session_date: p.nextSessionDate || null,
            source: 'mahakim',
            is_manual: false,
          }));

        if (newProcedures.length > 0) {
          await supabase.from('case_procedures').insert(newProcedures);
        }
      }

      // 3. إنشاء جلسة مقبلة تلقائياً
      if (nextSessionDate) {
        const normalizedDate = normalizeDateStr(nextSessionDate);
        if (normalizedDate) {
          // التحقق من عدم وجود جلسة بنفس التاريخ
          const { data: existingSessions } = await supabase
            .from('court_sessions')
            .select('id')
            .eq('case_id', caseId)
            .eq('session_date', normalizedDate);

          if (!existingSessions?.length) {
            await supabase.from('court_sessions').insert({
              case_id: caseId,
              session_date: normalizedDate,
              user_id: user.id,
              notes: 'تم الجلب عبر مساعد المزامنة الذكي',
              status: 'scheduled',
            });
          }
        }
      }

      setStep('done');
      toast.success(`تم استخراج ${procedures.length} إجراء بنجاح ✅`);
      onSyncComplete();
    } catch (err) {
      console.error('Save error:', err);
      toast.error('حدث خطأ أثناء الحفظ');
      setStep('preview');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            مساعد المزامنة الذكي
          </DialogTitle>
          <DialogDescription>
            مزامنة مجانية وفورية — انسخ والصق من بوابة محاكم
          </DialogDescription>
        </DialogHeader>

        {/* ── الخطوة 1: الدليل ── */}
        {step === 'guide' && (
          <div className="space-y-4">
            <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
              <h3 className="font-semibold text-sm">كيف تعمل المزامنة؟ (3 خطوات فقط)</h3>
              
              <div className="space-y-3">
                <StepItem number={1} title="افتح بوابة محاكم" desc="اضغط الزر أدناه — سيتم نسخ رقم الملف تلقائياً" />
                <StepItem number={2} title="ابحث والصق رقم الملف" desc="الصق الرقم في البوابة واضغط بحث، ثم حدد الكل (Ctrl+A) وانسخ (Ctrl+C)" />
                <StepItem number={3} title="عد هنا والصق" desc="الصق المحتوى في المربع وسيتم استخراج البيانات تلقائياً" />
              </div>
            </div>

            <Button onClick={openMahakimPortal} className="w-full gap-2" variant="outline">
              <ExternalLink className="h-4 w-4" />
              فتح بوابة محاكم للمزامنة
            </Button>

            <p className="text-[10px] text-muted-foreground text-center">
              رقم الملف: <span dir="ltr" className="font-mono font-bold">{caseNumber}</span>
              <Button variant="ghost" size="sm" className="h-5 px-1 mr-1" onClick={() => {
                navigator.clipboard.writeText(caseNumber);
                toast.info('تم نسخ رقم الملف');
              }}>
                <Copy className="h-3 w-3" />
              </Button>
            </p>

            <Button onClick={() => setStep('paste')} className="w-full gap-2">
              <ClipboardPaste className="h-4 w-4" />
              لدي المحتوى — أريد اللصق الآن
            </Button>
          </div>
        )}

        {/* ── الخطوة 2: منطقة اللصق ── */}
        {step === 'paste' && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <HelpCircle className="h-4 w-4 shrink-0" />
              <span>افتح صفحة نتائج الملف في بوابة محاكم، اضغط <kbd className="px-1 py-0.5 bg-muted rounded text-[10px] font-mono">Ctrl+A</kbd> ثم <kbd className="px-1 py-0.5 bg-muted rounded text-[10px] font-mono">Ctrl+C</kbd> والصق هنا</span>
            </div>

            <div
              className="relative border-2 border-dashed rounded-lg p-1 transition-colors focus-within:border-primary"
            >
              <Textarea
                ref={textareaRef}
                value={pastedText}
                onChange={e => setPastedText(e.target.value)}
                onPaste={handlePaste}
                placeholder="الصق محتوى صفحة الملف هنا... (Ctrl+V)"
                className="min-h-[200px] border-0 focus-visible:ring-0 resize-none text-sm"
                dir="rtl"
                autoFocus
              />
              {!pastedText && (
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none opacity-40">
                  <ClipboardPaste className="h-12 w-12 mb-2" />
                  <span className="text-sm">الصق هنا</span>
                </div>
              )}
            </div>

            {parsedData && !parsedData.success && (
              <div className="flex items-start gap-2 p-2.5 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-700 dark:text-amber-400">{parsedData.error}</p>
              </div>
            )}

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep('guide')} className="gap-1">
                <ArrowRight className="h-4 w-4" />
                رجوع
              </Button>
              <Button onClick={handleManualParse} disabled={!pastedText.trim()} className="flex-1 gap-2">
                <Sparkles className="h-4 w-4" />
                تحليل المحتوى
              </Button>
            </div>
          </div>
        )}

        {/* ── الخطوة 3: معاينة النتائج ── */}
        {step === 'preview' && parsedData && (
          <div className="space-y-4">
            {/* ملخص */}
            <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800">
              <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
              <div>
                <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
                  تم استخراج {parsedData.totalExtracted} إجراء بنجاح
                </p>
                {parsedData.nextSessionDate && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    📅 الجلسة المقبلة: {parsedData.nextSessionDate}
                  </p>
                )}
              </div>
            </div>

            {/* بيانات الملف */}
            {Object.values(parsedData.caseInfo).some(Boolean) && (
              <div className="space-y-1.5">
                <h4 className="text-xs font-semibold text-muted-foreground">بيانات الملف</h4>
                <div className="flex flex-wrap gap-1.5">
                  {parsedData.caseInfo.courtName && <Badge variant="outline">🏛️ {parsedData.caseInfo.courtName}</Badge>}
                  {parsedData.caseInfo.judgeName && <Badge variant="outline">⚖️ {parsedData.caseInfo.judgeName}</Badge>}
                  {parsedData.caseInfo.department && <Badge variant="outline">📋 {parsedData.caseInfo.department}</Badge>}
                  {parsedData.caseInfo.caseStatus && <Badge variant="secondary">{parsedData.caseInfo.caseStatus}</Badge>}
                  {parsedData.caseInfo.subject && <Badge variant="outline">{parsedData.caseInfo.subject}</Badge>}
                </div>
              </div>
            )}

            {/* جدول الإجراءات */}
            {parsedData.procedures.length > 0 && (
              <div className="space-y-1.5">
                <h4 className="text-xs font-semibold text-muted-foreground">الإجراءات ({parsedData.procedures.length})</h4>
                <div className="max-h-[200px] overflow-y-auto rounded-md border">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/50 sticky top-0">
                      <tr>
                        <th className="text-right p-2 font-medium">التاريخ</th>
                        <th className="text-right p-2 font-medium">الإجراء</th>
                        <th className="text-right p-2 font-medium">القرار</th>
                        <th className="text-right p-2 font-medium">المقبلة</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parsedData.procedures.map((p, i) => (
                        <tr key={i} className="border-t">
                          <td className="p-2 whitespace-nowrap">{p.actionDate}</td>
                          <td className="p-2">{p.actionType}</td>
                          <td className="p-2 text-muted-foreground">{p.decision || '—'}</td>
                          <td className="p-2 whitespace-nowrap">{p.nextSessionDate || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep('paste')} className="gap-1">
                <ArrowRight className="h-4 w-4" />
                إعادة اللصق
              </Button>
              <Button onClick={handleSave} className="flex-1 gap-2">
                <FileText className="h-4 w-4" />
                حفظ وتحديث الملف
              </Button>
            </div>
          </div>
        )}

        {/* ── الخطوة 4: جاري الحفظ ── */}
        {step === 'saving' && (
          <div className="flex flex-col items-center gap-4 py-8">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">جاري حفظ البيانات وتحديث الملف...</p>
          </div>
        )}

        {/* ── الخطوة 5: تم بنجاح ── */}
        {step === 'done' && parsedData && (
          <div className="flex flex-col items-center gap-4 py-6">
            <div className="h-16 w-16 rounded-full bg-emerald-100 dark:bg-emerald-950/50 flex items-center justify-center">
              <CheckCircle2 className="h-8 w-8 text-emerald-600" />
            </div>
            <div className="text-center space-y-1">
              <p className="font-semibold">تمت المزامنة بنجاح ✅</p>
              <p className="text-sm text-muted-foreground">
                تم استخراج {parsedData.totalExtracted} إجراء
                {parsedData.nextSessionDate && ` وجدولة الجلسة المقبلة`}
              </p>
            </div>
            <Button onClick={() => handleOpenChange(false)} className="gap-2">
              <CheckCircle2 className="h-4 w-4" />
              إغلاق
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

/** مكون خطوة في الدليل */
const StepItem = ({ number, title, desc }: { number: number; title: string; desc: string }) => (
  <div className="flex items-start gap-3">
    <div className="h-6 w-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
      {number}
    </div>
    <div>
      <p className="text-sm font-medium">{title}</p>
      <p className="text-xs text-muted-foreground">{desc}</p>
    </div>
  </div>
);
