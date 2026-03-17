
-- Create accounting_entries table as a unified ledger
CREATE TABLE public.accounting_entries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  entry_number TEXT NOT NULL,
  fiscal_year INTEGER NOT NULL DEFAULT EXTRACT(YEAR FROM now()),
  entry_type TEXT NOT NULL, -- 'invoice' or 'fee_statement'
  reference_id UUID NOT NULL, -- FK to invoices or fee_statements
  client_id UUID REFERENCES public.clients(id),
  description TEXT,
  amount_ht NUMERIC NOT NULL DEFAULT 0, -- montant hors taxe
  tax_amount NUMERIC NOT NULL DEFAULT 0,
  amount_ttc NUMERIC NOT NULL DEFAULT 0, -- montant TTC
  payment_method TEXT,
  entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.accounting_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own accounting entries"
ON public.accounting_entries FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own accounting entries"
ON public.accounting_entries FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own accounting entries"
ON public.accounting_entries FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Sequential counter per user per fiscal year
CREATE TABLE public.accounting_counters (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  fiscal_year INTEGER NOT NULL,
  last_invoice_number INTEGER NOT NULL DEFAULT 0,
  last_fee_statement_number INTEGER NOT NULL DEFAULT 0,
  UNIQUE(user_id, fiscal_year)
);

ALTER TABLE public.accounting_counters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own counters"
ON public.accounting_counters FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Function to get next sequential number
CREATE OR REPLACE FUNCTION public.next_accounting_number(
  _user_id UUID,
  _type TEXT -- 'invoice' or 'fee_statement'
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _year INTEGER := EXTRACT(YEAR FROM now());
  _next INTEGER;
  _prefix TEXT;
BEGIN
  -- Upsert counter row
  INSERT INTO public.accounting_counters (user_id, fiscal_year)
  VALUES (_user_id, _year)
  ON CONFLICT (user_id, fiscal_year) DO NOTHING;

  IF _type = 'invoice' THEN
    UPDATE public.accounting_counters
    SET last_invoice_number = last_invoice_number + 1
    WHERE user_id = _user_id AND fiscal_year = _year
    RETURNING last_invoice_number INTO _next;
    _prefix := 'REC';
  ELSE
    UPDATE public.accounting_counters
    SET last_fee_statement_number = last_fee_statement_number + 1
    WHERE user_id = _user_id AND fiscal_year = _year
    RETURNING last_fee_statement_number INTO _next;
    _prefix := 'HON';
  END IF;

  RETURN _prefix || '-' || _year || '/' || LPAD(_next::TEXT, 4, '0');
END;
$$;

-- Index for fast lookups
CREATE INDEX idx_accounting_entries_user_year ON public.accounting_entries(user_id, fiscal_year);
CREATE INDEX idx_accounting_entries_type ON public.accounting_entries(entry_type);
