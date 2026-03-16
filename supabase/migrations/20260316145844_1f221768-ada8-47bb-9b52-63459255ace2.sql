-- Add CASCADE delete: when a client is deleted, all their cases are deleted
ALTER TABLE public.cases
DROP CONSTRAINT IF EXISTS cases_client_id_fkey,
ADD CONSTRAINT cases_client_id_fkey
  FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE;

-- Add CASCADE delete: when a client is deleted, all their generated_documents are deleted
ALTER TABLE public.generated_documents
DROP CONSTRAINT IF EXISTS generated_documents_client_id_fkey,
ADD CONSTRAINT generated_documents_client_id_fkey
  FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE;

-- Add CASCADE delete: when a case is deleted, all its generated_documents are deleted
ALTER TABLE public.generated_documents
DROP CONSTRAINT IF EXISTS generated_documents_case_id_fkey,
ADD CONSTRAINT generated_documents_case_id_fkey
  FOREIGN KEY (case_id) REFERENCES public.cases(id) ON DELETE CASCADE;

-- Add CASCADE delete: when a document is deleted, all its attachments are deleted
ALTER TABLE public.document_attachments
DROP CONSTRAINT IF EXISTS document_attachments_document_id_fkey,
ADD CONSTRAINT document_attachments_document_id_fkey
  FOREIGN KEY (document_id) REFERENCES public.generated_documents(id) ON DELETE CASCADE;