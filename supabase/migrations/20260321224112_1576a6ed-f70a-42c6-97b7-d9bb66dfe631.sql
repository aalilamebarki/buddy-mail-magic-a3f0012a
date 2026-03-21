
CREATE OR REPLACE FUNCTION public.trigger_auto_sync_mahakim()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _job_id uuid := gen_random_uuid();
  _parts text[];
  _recent_count integer;
BEGIN
  IF NEW.case_number IS NULL OR NEW.case_number = '' THEN RETURN NEW; END IF;
  
  IF TG_OP = 'UPDATE' THEN
    IF OLD.case_number = NEW.case_number THEN RETURN NEW; END IF;
    
    DELETE FROM public.case_procedures WHERE case_id = NEW.id AND source = 'mahakim' AND is_manual = false;
    DELETE FROM public.court_sessions WHERE case_id = NEW.id AND notes = 'تم الجلب تلقائياً من بوابة محاكم';
    
    UPDATE public.cases SET 
      mahakim_judge = NULL, 
      mahakim_department = NULL, 
      mahakim_status = NULL,
      last_synced_at = NULL,
      last_sync_result = NULL
    WHERE id = NEW.id;
  END IF;
  
  _parts := string_to_array(NEW.case_number, '/');
  IF array_length(_parts, 1) < 3 THEN RETURN NEW; END IF;
  
  SELECT count(*) INTO _recent_count
  FROM public.mahakim_sync_jobs
  WHERE case_id = NEW.id
    AND created_at > (now() - interval '60 seconds')
    AND status IN ('pending', 'scraping');
  
  IF _recent_count > 0 THEN
    RETURN NEW;
  END IF;
  
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
$function$;
