
-- Add per-case financial columns to fee_statement_cases junction table
ALTER TABLE public.fee_statement_cases
  ADD COLUMN lawyer_fees numeric NOT NULL DEFAULT 0,
  ADD COLUMN tax_rate numeric NOT NULL DEFAULT 10,
  ADD COLUMN tax_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN subtotal numeric NOT NULL DEFAULT 0,
  ADD COLUMN total_amount numeric NOT NULL DEFAULT 0;

-- Link expense items to specific cases
ALTER TABLE public.fee_statement_items
  ADD COLUMN case_id uuid REFERENCES public.cases(id) ON DELETE SET NULL;
