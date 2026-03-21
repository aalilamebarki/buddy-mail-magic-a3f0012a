import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Globe, GripVertical, CheckCircle2, ExternalLink, BookMarked } from 'lucide-react';
import { generateBookmarkletCode, getBookmarkletName } from '@/lib/bookmarklet-generator';

interface BrowserFetchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  caseId: string;
  caseNumber: string;
  onSuccess: () => void;
}

export function BrowserFetchDialog({ open, onOpenChange, caseNumber, onSuccess }: BrowserFetchDialogProps) {
  const [bookmarkletUrl, setBookmarkletUrl] = useState('');
  const [dragged, setDragged] = useState(false);

  useEffect(() => {
    if (open) {
      setBookmarkletUrl(generateBookmarkletCode());
    }
  }, [open]);

  const portalUrl = `https://www.mahakim.ma/e-services/ejustice/#/dossier`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookMarked className="h-5 w-5" />
            جلب تلقائي من المتصفح
          </DialogTitle>
          <DialogDescription>
            أداة مجانية 100% — نقرة واحدة لجلب بيانات الملف
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {/* Step 1: Drag bookmarklet */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Badge variant="default" className="rounded-full h-6 w-6 p-0 flex items-center justify-center text-xs">1</Badge>
              <span className="font-semibold text-sm">اسحب هذا الزر إلى شريط المفضلة في متصفحك</span>
            </div>
            
            <div className="flex justify-center py-3">
              <a
                href={bookmarkletUrl}
                onClick={(e) => { e.preventDefault(); setDragged(true); }}
                onDragStart={() => setDragged(true)}
                draggable
                className="inline-flex items-center gap-2 px-5 py-3 rounded-lg border-2 border-dashed border-primary bg-primary/5 hover:bg-primary/10 text-primary font-bold text-base cursor-grab active:cursor-grabbing transition-colors select-none"
              >
                <GripVertical className="h-4 w-4" />
                {getBookmarkletName()}
              </a>
            </div>

            {!dragged && (
              <p className="text-xs text-muted-foreground text-center">
                💡 اسحب الزر أعلاه إلى شريط المفضلة (Bookmarks Bar) في متصفحك
              </p>
            )}

            {dragged && (
              <div className="flex items-center gap-2 justify-center text-emerald-600 text-sm">
                <CheckCircle2 className="h-4 w-4" />
                <span>ممتاز! تم إضافة الأداة</span>
              </div>
            )}
          </div>

          {/* Step 2: Open mahakim.ma */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Badge variant="default" className="rounded-full h-6 w-6 p-0 flex items-center justify-center text-xs">2</Badge>
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

          {/* Step 3: Click bookmarklet */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Badge variant="default" className="rounded-full h-6 w-6 p-0 flex items-center justify-center text-xs">3</Badge>
              <span className="font-semibold text-sm">بعد ظهور البيانات، اضغط على "{getBookmarkletName()}" في شريط المفضلة</span>
            </div>
            <p className="text-xs text-muted-foreground text-center">
              سيتم جلب البيانات تلقائياً وإرسالها للنظام — بدون نسخ ولصق ✨
            </p>
          </div>

          {/* Info box */}
          <div className="bg-muted/50 rounded-lg p-3 text-xs text-muted-foreground space-y-1">
            <p>✅ <strong>مجاني 100%</strong> — لا يحتاج أي اشتراك أو API</p>
            <p>✅ <strong>بدون نسخ ولصق</strong> — نقرة واحدة فقط</p>
            <p>✅ <strong>آمن</strong> — يعمل من متصفحك الشخصي</p>
            <p>✅ <strong>لا حظر</strong> — لأنه يستخدم جلسة المحامي الحقيقية</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
