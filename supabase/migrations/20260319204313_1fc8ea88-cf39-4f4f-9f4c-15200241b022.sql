
-- Table to store extracted court procedures for each case
CREATE TABLE public.case_procedures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  action_date text,
  action_type text NOT NULL,
  decision text,
  next_session_date text,
  source text NOT NULL DEFAULT 'mahakim',
  is_manual boolean NOT NULL DEFAULT false,
  conflict_log jsonb DEFAULT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.case_procedures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view case procedures"
  ON public.case_procedures FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert case procedures"
  ON public.case_procedures FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update case procedures"
  ON public.case_procedures FOR UPDATE TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can delete case procedures"
  ON public.case_procedures FOR DELETE TO authenticated
  USING (true);

CREATE INDEX idx_case_procedures_case_id ON public.case_procedures(case_id);

-- Enable realtime on case_procedures
ALTER PUBLICATION supabase_realtime ADD TABLE public.case_procedures;

-- Add mahakim_status field to cases for portal status tracking
ALTER TABLE public.cases
  ADD COLUMN IF NOT EXISTS mahakim_status text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS mahakim_judge text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS mahakim_department text DEFAULT NULL;
