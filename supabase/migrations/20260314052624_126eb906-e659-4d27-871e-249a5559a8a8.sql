
ALTER TABLE public.articles 
ADD COLUMN IF NOT EXISTS category text DEFAULT 'عام',
ADD COLUMN IF NOT EXISTS tags text[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS reading_time integer DEFAULT 5,
ADD COLUMN IF NOT EXISTS schema_type text DEFAULT 'Article';
