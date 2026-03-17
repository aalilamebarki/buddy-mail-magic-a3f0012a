
-- Add fee_statement_id to invoices to link receipts to fee statements
ALTER TABLE public.invoices 
ADD COLUMN fee_statement_id uuid REFERENCES public.fee_statements(id) ON DELETE SET NULL;

-- Create index for faster lookups
CREATE INDEX idx_invoices_fee_statement_id ON public.invoices(fee_statement_id);
