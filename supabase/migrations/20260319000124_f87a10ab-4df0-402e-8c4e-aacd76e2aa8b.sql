
-- Drop existing foreign keys and re-add with ON DELETE SET NULL
ALTER TABLE public.invoices DROP CONSTRAINT IF EXISTS invoices_letterhead_id_fkey;
ALTER TABLE public.invoices ADD CONSTRAINT invoices_letterhead_id_fkey 
  FOREIGN KEY (letterhead_id) REFERENCES public.letterheads(id) ON DELETE SET NULL;

ALTER TABLE public.fee_statements DROP CONSTRAINT IF EXISTS fee_statements_letterhead_id_fkey;
ALTER TABLE public.fee_statements ADD CONSTRAINT fee_statements_letterhead_id_fkey 
  FOREIGN KEY (letterhead_id) REFERENCES public.letterheads(id) ON DELETE SET NULL;
