-- Mark stuck scraping jobs as failed (older than 5 minutes)
UPDATE public.mahakim_sync_jobs 
SET status = 'failed', 
    error_message = 'انتهت مهلة المزامنة — لم يتم استلام النتائج خلال 5 دقائق',
    completed_at = now()
WHERE status IN ('scraping', 'pending') 
  AND created_at < now() - interval '5 minutes';