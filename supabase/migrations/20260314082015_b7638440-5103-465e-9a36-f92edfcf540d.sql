-- Remove duplicate legal_documents, keeping only the first chunk per unique (title, source) combo
-- Step 1: Create a temp table with IDs to keep (one per unique title+source)
DELETE FROM legal_documents
WHERE id NOT IN (
  SELECT DISTINCT ON (title, source) id
  FROM legal_documents
  ORDER BY title, source, created_at ASC
);