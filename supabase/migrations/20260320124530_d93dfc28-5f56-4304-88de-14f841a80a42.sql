CREATE TRIGGER trigger_mahakim_auto_sync_on_case
  AFTER INSERT OR UPDATE OF case_number ON public.cases
  FOR EACH ROW
  WHEN (NEW.case_number IS NOT NULL AND NEW.case_number <> '')
  EXECUTE FUNCTION public.trigger_mahakim_auto_sync();