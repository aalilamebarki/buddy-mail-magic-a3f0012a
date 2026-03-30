import { useState, useCallback, useImperativeHandle, forwardRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { Eye, Loader2, Download } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';

export interface PdfPreviewHandle {
  previewBlob: (blob: Blob, filename?: string) => void;
  clear: () => void;
}

interface PdfPreviewProps {
  title?: string;
}

const PdfPreview = forwardRef<PdfPreviewHandle, PdfPreviewProps>(({ title = 'معاينة الملف' }, ref) => {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [filename, setFilename] = useState<string>('document.pdf');
  const [loading, setLoading] = useState(false);
  const isMobile = useIsMobile();

  const clear = useCallback(() => {
    if (blobUrl) URL.revokeObjectURL(blobUrl);
    setBlobUrl(null);
    setLoading(false);
  }, [blobUrl]);

  const previewBlob = useCallback((blob: Blob, name?: string) => {
    setLoading(true);
    if (blobUrl) URL.revokeObjectURL(blobUrl);
    const url = URL.createObjectURL(blob);
    setBlobUrl(url);
    if (name) setFilename(name);
    setLoading(false);
  }, [blobUrl]);

  useImperativeHandle(ref, () => ({ previewBlob, clear }), [previewBlob, clear]);

  const isOpen = !!blobUrl || loading;

  const handleDownload = () => {
    if (!blobUrl) return;
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = filename;
    a.click();
  };

  const headerContent = (
    <div className="flex items-center justify-between w-full">
      <div className="flex items-center gap-2 text-sm font-bold text-foreground">
        <Eye className="h-4 w-4 text-primary" />
        {title}
      </div>
      <Button size="sm" variant="outline" onClick={handleDownload} className="gap-1.5 text-xs">
        <Download className="h-3.5 w-3.5" />
        تحميل
      </Button>
    </div>
  );

  const bodyContent = (
    <div className="flex min-h-0 flex-1 flex-col p-2">
      {loading && (
        <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          <span>جاري التحميل...</span>
        </div>
      )}
      {blobUrl && (
        <iframe
          src={blobUrl}
          className="flex-1 w-full rounded-lg border border-border bg-card"
          style={{ minHeight: '70vh' }}
          title={title}
        />
      )}
    </div>
  );

  if (isMobile) {
    return (
      <Drawer open={isOpen} onOpenChange={(open) => { if (!open) clear(); }}>
        <DrawerContent className="flex h-[92dvh] max-h-[92dvh] flex-col" dir="rtl">
          <DrawerHeader className="shrink-0 border-b px-4 py-3">
            <DrawerTitle>{headerContent}</DrawerTitle>
          </DrawerHeader>
          {bodyContent}
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) clear(); }}>
      <DialogContent className="flex h-[88dvh] w-[96vw] max-w-3xl flex-col gap-0 overflow-hidden p-0 md:max-w-5xl xl:max-w-6xl" dir="rtl">
        <DialogHeader className="shrink-0 border-b px-4 py-3">
          <DialogTitle>{headerContent}</DialogTitle>
        </DialogHeader>
        {bodyContent}
      </DialogContent>
    </Dialog>
  );
});

PdfPreview.displayName = 'PdfPreview';

export default PdfPreview;
