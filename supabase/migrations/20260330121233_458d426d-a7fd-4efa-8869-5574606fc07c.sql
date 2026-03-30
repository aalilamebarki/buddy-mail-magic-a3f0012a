-- 1) إضافة أعمدة للإشعارات
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS push_status text DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS push_sent timestamptz;

-- 2) إنشاء جدول قرارات محكمة النقض
CREATE TABLE IF NOT EXISTS public.cassation_rulings (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  ruling_number text,
  chamber text,
  year int,
  date date,
  subject text,
  parties text,
  source text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.cassation_rulings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read cassation rulings" ON public.cassation_rulings
  FOR SELECT TO public USING (true);

CREATE POLICY "Authenticated can insert cassation rulings" ON public.cassation_rulings
  FOR INSERT TO authenticated WITH CHECK (true);

-- 3) إنشاء جدول أجزاء القرارات مع embeddings
CREATE TABLE IF NOT EXISTS public.cassation_chunks (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  ruling_id uuid REFERENCES public.cassation_rulings(id) ON DELETE CASCADE NOT NULL,
  chunk_index int NOT NULL DEFAULT 0,
  content text NOT NULL,
  embedding vector(768),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cassation_chunks_ruling ON public.cassation_chunks(ruling_id);
CREATE INDEX IF NOT EXISTS idx_cassation_chunks_embedding ON public.cassation_chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

ALTER TABLE public.cassation_chunks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read cassation chunks" ON public.cassation_chunks
  FOR SELECT TO public USING (true);

CREATE POLICY "Authenticated can insert cassation chunks" ON public.cassation_chunks
  FOR INSERT TO authenticated WITH CHECK (true);

-- 4) دوال البحث الدلالي
CREATE OR REPLACE FUNCTION public.match_cassation_chunks(
  query_embedding text,
  match_threshold float DEFAULT 0.3,
  match_count int DEFAULT 45,
  filter_chamber text DEFAULT NULL,
  filter_year int DEFAULT NULL,
  filter_ruling_id uuid DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  ruling_id uuid,
  chunk_index int,
  content text,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    cc.id,
    cc.ruling_id,
    cc.chunk_index,
    cc.content,
    1 - (cc.embedding <=> query_embedding::vector) AS similarity
  FROM cassation_chunks cc
  JOIN cassation_rulings cr ON cr.id = cc.ruling_id
  WHERE 1=1
    AND (filter_chamber IS NULL OR cr.chamber = filter_chamber)
    AND (filter_year IS NULL OR cr.year = filter_year)
    AND (filter_ruling_id IS NULL OR cc.ruling_id = filter_ruling_id)
    AND 1 - (cc.embedding <=> query_embedding::vector) > match_threshold
  ORDER BY similarity DESC
  LIMIT match_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.count_embedded_rulings()
RETURNS int
LANGUAGE sql
AS $$
  SELECT COUNT(DISTINCT ruling_id)::int FROM cassation_chunks;
$$;