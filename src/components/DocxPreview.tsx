import { useRef, useState, useCallback, useImperativeHandle, forwardRef } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { Eye, Loader2 } from 'lucide-react';
import { renderAsync } from 'docx-preview';
import mammoth from 'mammoth';
import { supabase } from '@/integrations/supabase/client';
import { useIsMobile } from '@/hooks/use-mobile';

export interface DocxPreviewHandle {
  previewBlob: (blob: Blob) => Promise<void>;
  previewFromStorage: (bucket: string, path: string) => Promise<void>;
  clear: () => void;
  isLoading: boolean;
}

interface DocxPreviewProps {
  title?: string;
}

const DocxPreview = forwardRef<DocxPreviewHandle, DocxPreviewProps>(({ title = 'معاينة القالب' }, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [previewReady, setPreviewReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const isMobile = useIsMobile();

  const clear = useCallback(() => {
    setPreviewHtml(null);
    setPreviewReady(false);
    setLoading(false);
    if (containerRef.current) containerRef.current.innerHTML = '';
  }, []);

  const renderBlob = useCallback(async (blob: Blob) => {
    setLoading(true);
    setPreviewHtml(null);
    setPreviewReady(false);

    try {
      await new Promise(resolve => setTimeout(resolve, 50));
      const container = containerRef.current;
      if (!container) throw new Error('Preview container not found');

      container.innerHTML = '';
      await renderAsync(blob, container, undefined, {
        className: 'docx-preview',
        inWrapper: true,
        ignoreWidth: false,
        ignoreHeight: false,
        renderHeaders: true,
        renderFooters: true,
        renderFootnotes: true,
      });

      setPreviewReady(true);
    } catch (err) {
      console.error('docx-preview error:', err);
      try {
        const result = await mammoth.convertToHtml({ arrayBuffer: await blob.arrayBuffer() });
        setPreviewHtml(result.value || '<p style="color:gray;text-align:center;">الملف فارغ</p>');
      } catch {
        setPreviewHtml('<p style="color:gray;text-align:center;">تعذر عرض معاينة هذا الملف</p>');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const previewFromStorage = useCallback(async (bucket: string, path: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.storage.from(bucket).download(path);
      if (error || !data) throw error;
      await renderBlob(data);
    } catch {
      setPreviewHtml('<p style="color:gray;text-align:center;">تعذر عرض معاينة هذا الملف</p>');
      setLoading(false);
    }
  }, [renderBlob]);

  useImperativeHandle(ref, () => ({
    previewBlob: renderBlob,
    previewFromStorage,
    clear,
    isLoading: loading,
  }), [renderBlob, previewFromStorage, clear, loading]);

  const isOpen = previewReady || !!previewHtml || loading;

  const headerContent = (
    <div className="flex items-center gap-2 text-sm font-bold text-foreground">
      <Eye className="h-4 w-4 text-primary" />
      {title}
    </div>
  );

  const bodyContent = (
    <div className="p-3 sm:p-4">
      {loading && (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          <span className="text-sm text-muted-foreground mr-2">جاري تحميل المعاينة...</span>
        </div>
      )}

      <div
        ref={containerRef}
        className={previewReady ? 'h-[50vh] sm:h-[65vh] md:h-[70vh] overflow-auto rounded-lg border border-border bg-white' : 'hidden'}
        style={{ direction: 'ltr' }}
      />

      {previewHtml && !previewReady && !loading && (
        <ScrollArea className="h-[50vh] sm:h-[65vh] md:h-[70vh] rounded-lg border border-border">
          <div
            className="prose prose-sm max-w-none p-3 sm:p-4 text-foreground dark:prose-invert"
            dir="auto"
            dangerouslySetInnerHTML={{ __html: previewHtml }}
          />
        </ScrollArea>
      )}
    </div>
  );

  if (isMobile) {
    return (
      <Drawer open={isOpen} onOpenChange={(open) => { if (!open) clear(); }}>
        <DrawerContent className="max-h-[85vh]" dir="rtl">
          <DrawerHeader className="border-b px-4 py-3">
            <DrawerTitle>{headerContent}</DrawerTitle>
          </DrawerHeader>
          {bodyContent}
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) clear(); }}>
      <DialogContent className="w-[96vw] max-w-6xl max-h-[92vh] overflow-hidden p-0 gap-0" dir="rtl">
        <DialogHeader className="border-b px-4 py-3">
          <DialogTitle>{headerContent}</DialogTitle>
        </DialogHeader>
        {bodyContent}
      </DialogContent>
    </Dialog>
  );
});

DocxPreview.displayName = 'DocxPreview';

export default DocxPreview;
