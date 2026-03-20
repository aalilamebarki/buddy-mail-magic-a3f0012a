
SELECT cron.schedule(
  'google-calendar-reverse-sync',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://kebtjgedbwqrdqdjoqze.supabase.co/functions/v1/google-calendar-reverse-sync',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtlYnRqZ2VkYndxcmRxZGpvcXplIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM0NTEwOTAsImV4cCI6MjA4OTAyNzA5MH0.ugsWCQHTjhGW1Re1QUfpCM64u5CT66wnGQ4GfmHi9PU"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);
