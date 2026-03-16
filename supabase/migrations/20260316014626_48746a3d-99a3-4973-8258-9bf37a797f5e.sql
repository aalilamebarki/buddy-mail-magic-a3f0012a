
-- Create storage bucket for letterhead templates
INSERT INTO storage.buckets (id, name, public) 
VALUES ('letterhead-templates', 'letterhead-templates', false)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload to their own folder
CREATE POLICY "Users can upload letterhead templates" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'letterhead-templates' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Allow authenticated users to read their own templates
CREATE POLICY "Users can read own letterhead templates" ON storage.objects
FOR SELECT TO authenticated
USING (bucket_id = 'letterhead-templates' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Allow authenticated users to delete their own templates
CREATE POLICY "Users can delete own letterhead templates" ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'letterhead-templates' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Allow authenticated users to update their own templates
CREATE POLICY "Users can update own letterhead templates" ON storage.objects
FOR UPDATE TO authenticated
USING (bucket_id = 'letterhead-templates' AND (storage.foldername(name))[1] = auth.uid()::text);
