-- Add a unique index on (title, source) to prevent future duplicates
CREATE UNIQUE INDEX IF NOT EXISTS idx_legal_documents_unique_title_source 
ON legal_documents (title, COALESCE(source, ''));