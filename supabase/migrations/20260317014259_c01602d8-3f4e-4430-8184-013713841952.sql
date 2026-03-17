
CREATE TABLE public.court_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  case_id UUID REFERENCES public.cases(id) ON DELETE CASCADE NOT NULL,
  session_date DATE NOT NULL,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'scheduled',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  user_id UUID NOT NULL
);

ALTER TABLE public.court_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view court sessions" ON public.court_sessions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert court sessions" ON public.court_sessions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Authenticated users can update court sessions" ON public.court_sessions FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Authenticated users can delete court sessions" ON public.court_sessions FOR DELETE TO authenticated USING (auth.uid() = user_id);
