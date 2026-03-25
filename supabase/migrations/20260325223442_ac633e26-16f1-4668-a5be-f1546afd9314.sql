
-- تنظيف المهام العالقة بحالة scraping لأكثر من ساعة
UPDATE mahakim_sync_jobs 
SET status = 'failed', 
    error_message = 'مهمة عالقة - تم تنظيفها تلقائياً', 
    completed_at = now(),
    updated_at = now()
WHERE status = 'scraping' 
  AND created_at < now() - interval '1 hour';

-- إيقاف إعادة المحاولات للمهام الفاشلة المتكررة (أكثر من 3 محاولات)
UPDATE mahakim_sync_jobs 
SET max_retries = 0,
    error_message = 'تم إيقاف المحاولات — يرجى استخدام العامل الخارجي (Replit)',
    updated_at = now()
WHERE status = 'failed' 
  AND retry_count >= 2;
