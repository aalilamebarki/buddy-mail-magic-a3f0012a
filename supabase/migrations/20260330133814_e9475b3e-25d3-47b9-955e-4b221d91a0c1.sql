
ALTER TABLE public.cases ADD COLUMN IF NOT EXISTS mahakim_appellate_court text;

CREATE POLICY "Allow authenticated all on mahakim_sync_jobs"
ON public.mahakim_sync_jobs FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);
