CREATE TRIGGER auto_sync_mahakim_on_case
  AFTER INSERT OR UPDATE OF case_number
  ON public.cases
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_auto_sync_mahakim();