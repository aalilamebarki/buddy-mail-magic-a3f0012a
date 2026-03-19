
ALTER TABLE public.mahakim_sync_jobs
  ADD COLUMN IF NOT EXISTS retry_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_retries integer NOT NULL DEFAULT 2;

CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.trigger_mahakim_auto_sync()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _anon_key text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtlYnRqZ2VkYndxcmRxZGpvcXplIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM0NTEwOTAsImV4cCI6MjA4OTAyNzA5MH0.ugsWCQHTjhGW1Re1QUfpCM64u5CT66wnGQ4GfmHi9PU';
  _job_id uuid;
BEGIN
  IF NEW.case_number IS NOT NULL AND NEW.case_number <> '' THEN
    _job_id := gen_random_uuid();
    
    INSERT INTO public.mahakim_sync_jobs (id, case_id, user_id, case_number, status, request_payload)
    VALUES (
      _job_id,
      NEW.id,
      COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid),
      NEW.case_number,
      'pending',
      '{"auto_triggered": true}'::jsonb
    );

    PERFORM net.http_post(
      url := 'https://kebtjgedbwqrdqdjoqze.supabase.co/functions/v1/scrape-mahakim',
      body := jsonb_build_object(
        'action', 'submitSyncJob',
        'jobId', _job_id::text,
        'caseId', NEW.id::text,
        'userId', COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid)::text,
        'caseNumber', NEW.case_number
      ),
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || _anon_key,
        'apikey', _anon_key
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_sync_mahakim ON public.cases;
CREATE TRIGGER trg_auto_sync_mahakim
  AFTER INSERT ON public.cases
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_mahakim_auto_sync();
