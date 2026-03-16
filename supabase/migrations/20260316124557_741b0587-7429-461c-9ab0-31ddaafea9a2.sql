
ALTER TABLE public.cases 
  ADD COLUMN IF NOT EXISTS opposing_party text,
  ADD COLUMN IF NOT EXISTS opposing_party_address text,
  ADD COLUMN IF NOT EXISTS court_level text NOT NULL DEFAULT 'ابتدائية';

COMMENT ON COLUMN public.cases.court_level IS 'درجة المحكمة: ابتدائية، استئناف، نقض';
