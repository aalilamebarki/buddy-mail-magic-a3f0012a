-- Clean up garbage court values that are placeholder text from the portal
UPDATE public.cases
SET court = NULL
WHERE court IN ('الرقم الكامل للملف', 'اختيار محكمة الاستئناف', 'اختيار المحكمة الإبتدائية', 'اختيار المحكمة الابتدائية');

-- Also clean garbage mahakim fields
UPDATE public.cases
SET mahakim_status = NULL
WHERE mahakim_status = 'لا يزال غير موجود';

-- Reset last_sync_result for cases with garbage data so they get fresh sync
UPDATE public.cases
SET last_sync_result = NULL, last_synced_at = NULL
WHERE last_sync_result::text LIKE '%الرقم الكامل للملف%';