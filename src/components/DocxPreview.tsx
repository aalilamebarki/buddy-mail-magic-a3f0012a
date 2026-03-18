import { useRef, useState, useCallback, useImperativeHandle, forwardRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Eye, X, Loader2 } from 'lucide-react';
import { renderAsync } from 'docx-preview';
import mammoth from 'mammoth';
import { supabase } from '@/integrations/supabase/client';

export interface DocxPreviewHandle {
  previewBlob: (blob: Blob) => Promise<void>;
  previewFromStorage: (bucket: string, path: string) => Promise<void>;
  clear: () => void;
  isLoading: boolean;
}

interface DocxPreviewProps {
  /** Optional title shown in the preview card */
  title?: string;
}

const DocxPreview = forwardRef<DocxPreviewHandle, DocxPreviewProps>(({ title = 'معاينة القالب' }, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [previewReady, setPreviewReady] = useState(false);
  const [loading, setLoading] = useState(false);

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
      await new Promise(r => setTimeout(r, 50));
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

  const isVisible = previewReady || previewHtml || loading;

  if (!isVisible) {
    // Keep containerRef mounted but hidden so renderAsync can paint into it
    return <div ref={containerRef} className="hidden" />;
  }

  return (
    <Card>
      <CardContent className="pt-4 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Eye className="h-4 w-4 text-primary" />
            <span className="text-sm font-bold text-foreground">{title}</span>
          </div>
          <Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={clear}>
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
        {loading && (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <span className="text-sm text-muted-foreground mr-2">جاري تحميل المعاينة...</span>
          </div>
        )}
        {/* docx-preview renders here */}
        <div
          ref={containerRef}
          className={`border border-border rounded-lg overflow-auto bg-white ${previewReady ? 'h-[450px]' : 'hidden'}`}
          style={{ direction: 'ltr' }}
        />
        {previewHtml && !previewReady && !loading && (
          <ScrollArea className="h-[300px] border border-border rounded-lg">
            <div
              className="p-4 prose prose-sm max-w-none dark:prose-invert text-foreground"
              dir="auto"
              dangerouslySetInnerHTML={{ __html: previewHtml }}
            />
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
});

DocxPreview.displayName = 'DocxPreview';

export default DocxPreview;
