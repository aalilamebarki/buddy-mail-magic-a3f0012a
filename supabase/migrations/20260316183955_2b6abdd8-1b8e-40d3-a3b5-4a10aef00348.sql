-- Create public storage bucket for legal PDFs
INSERT INTO storage.buckets (id, name, public)
VALUES ('legal-pdfs', 'legal-pdfs', true)
ON CONFLICT (id) DO NOTHING;

-- Allow public read access
CREATE POLICY "Public read legal pdfs"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'legal-pdfs');

-- Allow authenticated users to upload
CREATE POLICY "Authenticated upload legal pdfs"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'legal-pdfs');

-- Allow service role to manage (for edge functions)
CREATE POLICY "Service role manage legal pdfs"
ON storage.objects FOR ALL
TO service_role
USING (bucket_id = 'legal-pdfs')
WITH CHECK (bucket_id = 'legal-pdfs');

-- Add local_pdf_path column to legal_documents
ALTER TABLE public.legal_documents
ADD COLUMN IF NOT EXISTS local_pdf_path text;

-- Allow authenticated users to update legal_documents (for storing pdf path)
CREATE POLICY "Authenticated users can update legal documents"
ON public.legal_documents FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);