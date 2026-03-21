-- حذف المشغل المكرر القديم (trigger_mahakim_auto_sync_on_case)
-- يُبقي فقط على trg_auto_sync_mahakim الأحدث والأكثر اكتمالاً
DROP TRIGGER IF EXISTS trigger_mahakim_auto_sync_on_case ON public.cases;
DROP FUNCTION IF EXISTS public.trigger_mahakim_auto_sync();