
CREATE TABLE public.reference_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  doc_type text NOT NULL DEFAULT 'عام',
  content text NOT NULL,
  file_name text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.reference_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own reference docs"
  ON public.reference_documents
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
