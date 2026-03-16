
-- Add parent_id for document threading and step_number for ordering
ALTER TABLE public.generated_documents 
  ADD COLUMN parent_id UUID REFERENCES public.generated_documents(id) ON DELETE SET NULL,
  ADD COLUMN step_number INTEGER DEFAULT 1,
  ADD COLUMN thread_id UUID,
  ADD COLUMN opponent_memo TEXT;

-- thread_id groups all documents in the same litigation thread
-- step_number tracks the order (1 = initial petition, 2 = opponent response noted, 3 = counter-memo, etc.)
