-- Allow case-level notifications when a case has no linked court session yet.
ALTER TABLE public.notifications
ALTER COLUMN session_id DROP NOT NULL;