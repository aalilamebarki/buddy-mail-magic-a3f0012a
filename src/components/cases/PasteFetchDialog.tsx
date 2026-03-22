import { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Globe, ClipboardPaste, ExternalLink, CheckCircle2, Loader2, AlertCircle } from 'lucide-react';
import { parseMahakimPaste } from '@/lib/parse-mahakim-paste';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface PasteFetchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  caseId: string;
  caseNumber: string;
  onSuccess: () => void;
}

export function PasteFetchDialog({ open, onOpenChange, caseNumber, caseId, onSuccess }: PasteFetchDialogProps) {
  const [pastedText, setPastedText] = useState('');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const portalUrl = `https://www.mahakim.ma/e-services/ejustice/#/dossier`;

  const parsed = pastedText.length > 50 ? parseMahakimPaste(pastedText) : null;
  const hasData = parsed && (parsed.procedures.length > 0 || Object.keys(parsed.caseInfo).length > 0);

  const handlePasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text && text.length > 20) {
        setPastedText(text);
        setResult(null);
      } else {
        toast.error('المحتوى المنسوخ فارغ أو قصير جداً');
      }
    } catch {
      toast.error('لم يتم السماح بالوصول للحافظة — الصق يدوياً بـ Ctrl+V');
      textareaRef.current?.focus();
    }
  };

  const handleSend = async () => {
    if (!parsed || !hasData) return;
    setSending(true);
    setResult(null);

    try {
      const { data, error } = await supabase.functions.invoke('bookmarklet-receiver', {
        body: {
          caseNumber,
          caseInfo: parsed.caseInfo,
          procedures: parsed.procedures,
          allLabels: parsed.allLabels,
          rawText: parsed.rawText,
        },
      });

      if (error) throw error;

      setResult({ success: true, message: data?.message || 'تم بنجاح ✅' });
      onSuccess();
    } catch (err: any) {
      setResult({ success: false, message: err.message || 'حدث خطأ' });
    } finally {
      setSending(false);
    }
  };

  const handleClose = () => {
    setPastedText('');
    setResult(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardPaste className="h-5 w-5" />
            جلب بيانات الملف (نسخ ولصق)
          </DialogTitle>
          <DialogDescription>
            انسخ محتوى صفحة الملف من بوابة محاكم والصقه هنا
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Step 1 */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Badge variant="default" className="rounded-full h-6 w-6 p-0 flex items-center justify-center text-xs">1</Badge>
              <span className="font-semibold text-sm">افتح بوابة محاكم وابحث عن ملفك</span>
            </div>
            <div className="flex justify-center">
              <Button variant="outline" size="sm" asChild>
                <a href={portalUrl} target="_blank" rel="noopener noreferrer">
                  <Globe className="h-4 w-4 ml-1" />
                  فتح بوابة محاكم
                  <ExternalLink className="h-3 w-3 mr-1" />
                </a>
              </Button>
            </div>
            <p className="text-xs text-muted-foreground text-center">
              ابحث برقم الملف: <span className="font-mono text-primary" dir="ltr">{caseNumber}</span>
            </p>
          </div>

          {/* Step 2 */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Badge variant="default" className="rounded-full h-6 w-6 p-0 flex items-center justify-center text-xs">2</Badge>
              <span className="font-semibold text-sm">حدد كل المحتوى وانسخه</span>
            </div>
            <p className="text-xs text-muted-foreground text-center">
              بعد ظهور بيانات الملف، اضغط <kbd className="px-1.5 py-0.5 rounded border bg-muted text-xs font-mono">Ctrl+A</kbd> ثم <kbd className="px-1.5 py-0.5 rounded border bg-muted text-xs font-mono">Ctrl+C</kbd>
            </p>
          </div>

          {/* Step 3 */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Badge variant="default" className="rounded-full h-6 w-6 p-0 flex items-center justify-center text-xs">3</Badge>
              <span className="font-semibold text-sm">الصق هنا</span>
            </div>

            <Button variant="outline" className="w-full gap-2" onClick={handlePasteFromClipboard}>
              <ClipboardPaste className="h-4 w-4" />
              لصق من الحافظة
            </Button>

            <Textarea
              ref={textareaRef}
              placeholder="أو الصق هنا يدوياً (Ctrl+V)..."
              value={pastedText}
              onChange={e => { setPastedText(e.target.value); setResult(null); }}
              rows={4}
              className="text-xs font-mono"
              dir="auto"
            />

            {/* Parse preview */}
            {parsed && (
              <div className="bg-muted/50 rounded-lg p-3 text-xs space-y-1">
                {hasData ? (
                  <>
                    <div className="flex items-center gap-1 text-emerald-600 font-semibold">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      تم تحليل البيانات بنجاح
                    </div>
                    <p className="text-muted-foreground">
                      {parsed.procedures.length > 0 && `${parsed.procedures.length} إجراء`}
                      {parsed.caseInfo.judge && ` • القاضي: ${parsed.caseInfo.judge}`}
                      {parsed.caseInfo.status && ` • الحالة: ${parsed.caseInfo.status}`}
                    </p>
                  </>
                ) : (
                  <div className="flex items-center gap-1 text-amber-600">
                    <AlertCircle className="h-3.5 w-3.5" />
                    <span>لم يتم التعرف على بيانات — تأكد من نسخ صفحة الملف كاملة</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Result */}
          {result && (
            <div className={`rounded-lg p-3 text-sm text-center ${result.success ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400' : 'bg-destructive/10 text-destructive'}`}>
              {result.success ? '✅' : '❌'} {result.message}
            </div>
          )}

          {/* Info */}
          <div className="bg-muted/50 rounded-lg p-3 text-xs text-muted-foreground space-y-1">
            <p>✅ <strong>مجاني 100%</strong> — لا يحتاج أي اشتراك</p>
            <p>✅ <strong>3 خطوات فقط</strong> — افتح، انسخ، الصق</p>
            <p>✅ <strong>آمن</strong> — البيانات من متصفحك الشخصي</p>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={handleClose}>إغلاق</Button>
          <Button onClick={handleSend} disabled={sending || !hasData} className="gap-2">
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            إرسال البيانات
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
