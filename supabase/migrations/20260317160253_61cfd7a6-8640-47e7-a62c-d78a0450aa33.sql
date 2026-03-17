
-- Create invoices table for receipt/billing system
CREATE TABLE public.invoices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  case_id UUID REFERENCES public.cases(id) ON DELETE SET NULL,
  letterhead_id UUID REFERENCES public.letterheads(id) ON DELETE SET NULL,
  invoice_number TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  description TEXT,
  payment_method TEXT DEFAULT 'cash',
  signature_uuid UUID NOT NULL DEFAULT gen_random_uuid(),
  pdf_path TEXT,
  status TEXT NOT NULL DEFAULT 'paid',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view their own invoices"
  ON public.invoices FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own invoices"
  ON public.invoices FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own invoices"
  ON public.invoices FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own invoices"
  ON public.invoices FOR DELETE
  USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_invoices_updated_at
  BEFORE UPDATE ON public.invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-increment invoice number sequence
CREATE SEQUENCE IF NOT EXISTS invoice_number_seq START 1;

-- Create storage bucket for invoice PDFs
INSERT INTO storage.buckets (id, name, public) VALUES ('invoices', 'invoices', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for invoices bucket
CREATE POLICY "Users can view their own invoice PDFs"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'invoices' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can upload their own invoice PDFs"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'invoices' AND auth.uid()::text = (storage.foldername(name))[1]);
