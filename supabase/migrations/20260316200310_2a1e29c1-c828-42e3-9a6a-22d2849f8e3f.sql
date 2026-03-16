-- Add new columns for richer metadata
ALTER TABLE public.legal_documents 
ADD COLUMN IF NOT EXISTS year_issued integer,
ADD COLUMN IF NOT EXISTS official_gazette_number text,
ADD COLUMN IF NOT EXISTS official_gazette_date date,
ADD COLUMN IF NOT EXISTS signing_date date,
ADD COLUMN IF NOT EXISTS issuing_authority text,
ADD COLUMN IF NOT EXISTS subject text,
ADD COLUMN IF NOT EXISTS resource_page_id integer,
ADD COLUMN IF NOT EXISTS pdf_url text,
ADD COLUMN IF NOT EXISTS ai_summary text,
ADD COLUMN IF NOT EXISTS ai_classification jsonb DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_legal_documents_resource_page ON public.legal_documents(resource_page_id);
CREATE INDEX IF NOT EXISTS idx_legal_documents_year ON public.legal_documents(year_issued);
CREATE INDEX IF NOT EXISTS idx_legal_documents_doc_type ON public.legal_documents(doc_type);
CREATE INDEX IF NOT EXISTS idx_legal_documents_category ON public.legal_documents(category);