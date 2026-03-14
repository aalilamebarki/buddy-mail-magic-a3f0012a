
CREATE TABLE public.site_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  office_name text,
  office_address text,
  office_phone text,
  office_email text,
  sender_email text,
  sender_name text,
  email_domain text,
  domain_verified boolean DEFAULT false,
  notify_reset boolean DEFAULT true,
  notify_signup boolean DEFAULT true,
  notify_case boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

-- Only directors can manage settings
CREATE POLICY "Directors can manage settings"
ON public.site_settings
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'director'))
WITH CHECK (public.has_role(auth.uid(), 'director'));

-- All authenticated users can read settings
CREATE POLICY "Authenticated users can read settings"
ON public.site_settings
FOR SELECT
TO authenticated
USING (true);
