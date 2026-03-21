-- Schedule automatic reconciliation for cases without sessions
-- Runs every 30 minutes to compare registered cases against court sessions
-- and trigger background sync / notifications when a session is missing.

SELECT cron.unschedule(jobid)
FROM cron.job
WHERE jobname = 'mahakim-case-session-reconciliation';

SELECT cron.schedule(
  'mahakim-case-session-reconciliation',
  '*/30 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://kebtjgedbwqrdqdjoqze.supabase.co/functions/v1/check-pending-sessions',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtlYnRqZ2VkYndxcmRxZGpvcXplIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM0NTEwOTAsImV4cCI6MjA4OTAyNzA5MH0.ugsWCQHTjhGW1Re1QUfpCM64u5CT66wnGQ4GfmHi9PU", "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtlYnRqZ2VkYndxcmRxZGpvcXplIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM0NTEwOTAsImV4cCI6MjA4OTAyNzA5MH0.ugsWCQHTjhGW1Re1QUfpCM64u5CT66wnGQ4GfmHi9PU"}'::jsonb,
    body := jsonb_build_object('source', 'cron', 'reconcile_missing_sessions', true)
  );
  $$
);