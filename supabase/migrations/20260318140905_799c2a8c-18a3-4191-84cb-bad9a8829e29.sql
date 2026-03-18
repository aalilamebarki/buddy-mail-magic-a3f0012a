
CREATE TABLE public.required_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label TEXT NOT NULL UNIQUE,
  user_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.required_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view required actions"
  ON public.required_actions FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert required actions"
  ON public.required_actions FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
