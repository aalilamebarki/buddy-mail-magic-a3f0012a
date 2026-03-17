
CREATE TABLE public.case_opponents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  case_id UUID REFERENCES public.cases(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  address TEXT,
  phone TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.case_opponents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view case opponents" ON public.case_opponents FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert case opponents" ON public.case_opponents FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update case opponents" ON public.case_opponents FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete case opponents" ON public.case_opponents FOR DELETE TO authenticated USING (true);
