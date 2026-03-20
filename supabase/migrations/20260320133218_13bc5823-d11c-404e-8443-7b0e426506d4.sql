
CREATE OR REPLACE FUNCTION public.trigger_auto_sync_mahakim()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _job_id uuid := gen_random_uuid();
  _parts text[];
BEGIN
  IF TG_OP != 'INSERT' THEN RETURN NEW; END IF;
  IF NEW.case_number IS NULL OR NEW.case_number = '' THEN RETURN NEW; END IF;
  
  _parts := string_to_array(NEW.case_number, '/');
  IF array_length(_parts, 1) < 3 THEN RETURN NEW; END IF;
  
  INSERT INTO public.mahakim_sync_jobs (id, case_id, user_id, case_number, status)
  VALUES (_job_id, NEW.id, COALESCE(NEW.assigned_to, auth.uid(), '00000000-0000-0000-0000-000000000000'), NEW.case_number, 'pending');
  
  PERFORM net.http_post(
    url := 'https://kebtjgedbwqrdqdjoqze.supabase.co/functions/v1/fetch-dossier',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtlYnRqZ2VkYndxcmRxZGpvcXplIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM0NTEwOTAsImV4cCI6MjA4OTAyNzA5MH0.ugsWCQHTjhGW1Re1QUfpCM64u5CT66wnGQ4GfmHi9PU", "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtlYnRqZ2VkYndxcmRxZGpvcXplIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM0NTEwOTAsImV4cCI6MjA4OTAyNzA5MH0.ugsWCQHTjhGW1Re1QUfpCM64u5CT66wnGQ4GfmHi9PU"}'::jsonb,
    body := jsonb_build_object(
      'action', 'submitSyncJob',
      'jobId', _job_id::text,
      'caseId', NEW.id::text,
      'userId', COALESCE(NEW.assigned_to, auth.uid())::text,
      'caseNumber', NEW.case_number
    )
  );
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_sync_mahakim ON public.cases;
CREATE TRIGGER trg_auto_sync_mahakim
  AFTER INSERT ON public.cases
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_auto_sync_mahakim();
