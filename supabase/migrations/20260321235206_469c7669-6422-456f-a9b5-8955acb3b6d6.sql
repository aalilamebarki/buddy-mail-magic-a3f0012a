-- إعادة إنشاء الـ trigger معطّلاً (يمكن تفعيله لاحقاً بـ ENABLE TRIGGER)
CREATE TRIGGER auto_sync_mahakim_on_insert
  AFTER INSERT ON public.cases
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_auto_sync_mahakim();

CREATE TRIGGER auto_sync_mahakim_on_update
  AFTER UPDATE OF case_number ON public.cases
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_auto_sync_mahakim();

-- تعطيلها فوراً
ALTER TABLE public.cases DISABLE TRIGGER auto_sync_mahakim_on_insert;
ALTER TABLE public.cases DISABLE TRIGGER auto_sync_mahakim_on_update;