
-- Table to track async mahakim scraping jobs
CREATE TABLE public.mahakim_sync_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  case_number text NOT NULL,
  request_payload jsonb DEFAULT '{}'::jsonb,
  result_data jsonb DEFAULT NULL,
  error_message text DEFAULT NULL,
  next_session_date date DEFAULT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz DEFAULT NULL
);

-- RLS
ALTER TABLE public.mahakim_sync_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own sync jobs"
  ON public.mahakim_sync_jobs FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own sync jobs"
  ON public.mahakim_sync_jobs FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Allow service role to update sync jobs"
  ON public.mahakim_sync_jobs FOR UPDATE
  USING (true);

-- Enable realtime for live status updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.mahakim_sync_jobs;

-- Index for quick lookup by case
CREATE INDEX idx_mahakim_sync_jobs_case_id ON public.mahakim_sync_jobs(case_id);
CREATE INDEX idx_mahakim_sync_jobs_status ON public.mahakim_sync_jobs(status);

-- Add last_synced_at and last_sync_result to cases table
ALTER TABLE public.cases 
  ADD COLUMN IF NOT EXISTS last_synced_at timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS last_sync_result jsonb DEFAULT NULL;
