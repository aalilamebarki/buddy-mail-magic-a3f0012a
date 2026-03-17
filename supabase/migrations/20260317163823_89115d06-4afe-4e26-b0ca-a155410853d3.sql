
-- Create junction table for fee statement cases (multiple cases per statement)
CREATE TABLE public.fee_statement_cases (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  fee_statement_id UUID NOT NULL REFERENCES public.fee_statements(id) ON DELETE CASCADE,
  case_id UUID NOT NULL REFERENCES public.cases(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(fee_statement_id, case_id)
);

ALTER TABLE public.fee_statement_cases ENABLE ROW LEVEL SECURITY;

-- RLS: users can manage their own statement cases
CREATE POLICY "Users can manage own statement cases"
ON public.fee_statement_cases FOR ALL
TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.fee_statements fs
  WHERE fs.id = fee_statement_cases.fee_statement_id AND fs.user_id = auth.uid()
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.fee_statements fs
  WHERE fs.id = fee_statement_cases.fee_statement_id AND fs.user_id = auth.uid()
));

-- Public read for verification
CREATE POLICY "Anyone can view fee statement cases"
ON public.fee_statement_cases FOR SELECT
TO public
USING (true);
