
-- Create generated_documents table
CREATE TABLE public.generated_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  case_id UUID REFERENCES public.cases(id) ON DELETE SET NULL,
  doc_type TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT,
  court TEXT,
  next_court TEXT,
  case_number TEXT,
  opposing_party TEXT,
  client_name TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create document_attachments table
CREATE TABLE public.document_attachments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id UUID REFERENCES public.generated_documents(id) ON DELETE CASCADE NOT NULL,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_type TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.generated_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_attachments ENABLE ROW LEVEL SECURITY;

-- RLS policies for generated_documents
CREATE POLICY "Users can view own documents" ON public.generated_documents FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own documents" ON public.generated_documents FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own documents" ON public.generated_documents FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own documents" ON public.generated_documents FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Directors can view all documents" ON public.generated_documents FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'director'));

-- RLS policies for document_attachments
CREATE POLICY "Users can view attachments of own documents" ON public.document_attachments FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.generated_documents WHERE id = document_id AND user_id = auth.uid()));
CREATE POLICY "Users can insert attachments" ON public.document_attachments FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.generated_documents WHERE id = document_id AND user_id = auth.uid()));
CREATE POLICY "Users can delete own attachments" ON public.document_attachments FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM public.generated_documents WHERE id = document_id AND user_id = auth.uid()));

-- Create storage bucket for document attachments
INSERT INTO storage.buckets (id, name, public) VALUES ('document-attachments', 'document-attachments', false);

-- Storage RLS policies
CREATE POLICY "Authenticated users can upload document attachments" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'document-attachments' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Users can view own document attachments" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'document-attachments' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Users can delete own document attachments" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'document-attachments' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Add updated_at trigger
CREATE TRIGGER update_generated_documents_updated_at BEFORE UPDATE ON public.generated_documents FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
