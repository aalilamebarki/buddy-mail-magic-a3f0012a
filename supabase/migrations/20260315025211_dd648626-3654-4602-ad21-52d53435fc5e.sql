-- Create storage bucket for scraping data
INSERT INTO storage.buckets (id, name, public) VALUES ('scraping-data', 'scraping-data', false)
ON CONFLICT (id) DO NOTHING;

-- Allow service role to read from the bucket
CREATE POLICY "Service role can read scraping data"
ON storage.objects FOR SELECT
TO service_role
USING (bucket_id = 'scraping-data');

CREATE POLICY "Service role can insert scraping data"
ON storage.objects FOR INSERT
TO service_role
WITH CHECK (bucket_id = 'scraping-data');