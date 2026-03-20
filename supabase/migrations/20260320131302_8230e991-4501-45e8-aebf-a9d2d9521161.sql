
-- fee_statements: change NO ACTION to SET NULL so case can be deleted
ALTER TABLE public.fee_statements DROP CONSTRAINT fee_statements_case_id_fkey;
ALTER TABLE public.fee_statements ADD CONSTRAINT fee_statements_case_id_fkey
  FOREIGN KEY (case_id) REFERENCES public.cases(id) ON DELETE SET NULL;

-- fee_statement_cases: change NO ACTION to CASCADE
ALTER TABLE public.fee_statement_cases DROP CONSTRAINT fee_statement_cases_case_id_fkey;
ALTER TABLE public.fee_statement_cases ADD CONSTRAINT fee_statement_cases_case_id_fkey
  FOREIGN KEY (case_id) REFERENCES public.cases(id) ON DELETE CASCADE;
