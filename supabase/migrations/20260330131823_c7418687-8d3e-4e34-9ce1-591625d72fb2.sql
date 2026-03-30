CREATE TABLE public.push_subscriptions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  endpoint text NOT NULL,
  keys jsonb NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated select on push_subscriptions"
ON public.push_subscriptions FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Allow authenticated insert on push_subscriptions"
ON public.push_subscriptions FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Allow authenticated delete on push_subscriptions"
ON public.push_subscriptions FOR DELETE
TO authenticated
USING (true);