ALTER TABLE public.letterheads 
  ADD COLUMN IF NOT EXISTS name_fr text,
  ADD COLUMN IF NOT EXISTS title_ar text DEFAULT 'محام',
  ADD COLUMN IF NOT EXISTS title_fr text DEFAULT 'AVOCAT',
  ADD COLUMN IF NOT EXISTS bar_name_ar text,
  ADD COLUMN IF NOT EXISTS bar_name_fr text,
  ADD COLUMN IF NOT EXISTS city text DEFAULT 'الرباط',
  ADD COLUMN IF NOT EXISTS address text,
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS phone text;