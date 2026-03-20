-- Fix corrupted court_room data that contains full composite text
UPDATE public.court_sessions 
SET court_room = CASE
  WHEN court_room ~ 'بالقاعة|القاعة' THEN 
    regexp_replace(court_room, '^.*(?:بالقاعة|القاعة)\s*', '')
  ELSE NULL
END
WHERE court_room IS NOT NULL AND court_room LIKE '%/%';