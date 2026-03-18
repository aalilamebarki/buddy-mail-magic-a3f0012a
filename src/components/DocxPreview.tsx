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

const EMPTY_PREVIEW_HTML = '<p class="docx-preview-state">الملف فارغ</p>';
const ERROR_PREVIEW_HTML = '<p class="docx-preview-state">تعذر عرض معاينة هذا الملف</p>';

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

    if (containerRef.current) {
      containerRef.current.innerHTML = '';
    }
  }, []);

  const renderBlob = useCallback(async (blob: Blob) => {
    setLoading(true);
    setPreviewHtml(null);
    setPreviewReady(false);

    try {
      await new Promise((resolve) => setTimeout(resolve, 50));
      const container = containerRef.current;

      if (!container) {
        throw new Error('Preview container not found');
      }

      container.innerHTML = '';

      await renderAsync(blob, container, undefined, {
        className: 'docx-preview',
        inWrapper: true,
        ignoreWidth: isMobile,
        ignoreHeight: isMobile,
        renderHeaders: true,
        renderFooters: true,
        renderFootnotes: true,
      });

      setPreviewReady(true);
    } catch (err) {
      console.error('docx-preview error:', err);

      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }

      try {
        const result = await mammoth.convertToHtml({ arrayBuffer: await blob.arrayBuffer() });
        setPreviewHtml(result.value || EMPTY_PREVIEW_HTML);
      } catch {
        setPreviewHtml(ERROR_PREVIEW_HTML);
      }
    } finally {
      setLoading(false);
    }
  }, [isMobile]);

  const previewFromStorage = useCallback(async (bucket: string, path: string) => {
    setLoading(true);

    try {
      const { data, error } = await supabase.storage.from(bucket).download(path);
      if (error || !data) throw error;

      await renderBlob(data);
    } catch {
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }

      setPreviewReady(false);
      setPreviewHtml(ERROR_PREVIEW_HTML);
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
    <div className="flex min-h-0 flex-1 flex-col p-3 sm:p-4">
      {loading && (
        <div className="flex items-center justify-center gap-2 border-b border-dashed border-border/70 pb-3 text-sm text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          <span>جاري تحميل المعاينة...</span>
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-hidden rounded-xl border border-border bg-card">
        <div
          ref={containerRef}
          className={previewReady ? 'docx-preview-shell h-full w-full overflow-auto' : 'hidden'}
        />

        {previewHtml && !previewReady && !loading && (
          <ScrollArea className="h-full w-full">
            <div
              className="docx-preview-fallback prose prose-sm max-w-none p-4 text-foreground dark:prose-invert sm:p-5"
              dir="auto"
              dangerouslySetInnerHTML={{ __html: previewHtml }}
            />
          </ScrollArea>
        )}
      </div>
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

DocxPreview.displayName = 'DocxPreview';

export default DocxPreview;
