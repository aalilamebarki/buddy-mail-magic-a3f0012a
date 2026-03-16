
-- Create letterheads table
CREATE TABLE public.letterheads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  lawyer_name TEXT NOT NULL,
  header_image_path TEXT,
  footer_image_path TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.letterheads ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Authenticated users can view letterheads" ON public.letterheads FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert letterheads" ON public.letterheads FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own letterheads" ON public.letterheads FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own letterheads" ON public.letterheads FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Create storage bucket for letterhead images
INSERT INTO storage.buckets (id, name, public) VALUES ('letterheads', 'letterheads', true);

-- Storage policies
CREATE POLICY "Anyone can view letterhead images" ON storage.objects FOR SELECT TO public USING (bucket_id = 'letterheads');
CREATE POLICY "Authenticated users can upload letterhead images" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'letterheads');
CREATE POLICY "Users can delete own letterhead images" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'letterheads');
