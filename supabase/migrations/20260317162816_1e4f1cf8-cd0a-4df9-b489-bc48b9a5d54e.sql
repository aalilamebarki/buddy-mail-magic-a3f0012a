
-- Create fee_statements table
CREATE TABLE public.fee_statements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  client_id UUID REFERENCES public.clients(id),
  case_id UUID REFERENCES public.cases(id),
  letterhead_id UUID REFERENCES public.letterheads(id),
  statement_number TEXT NOT NULL,
  power_of_attorney_date DATE,
  lawyer_fees NUMERIC NOT NULL DEFAULT 0,
  tax_rate NUMERIC NOT NULL DEFAULT 10,
  tax_amount NUMERIC NOT NULL DEFAULT 0,
  subtotal NUMERIC NOT NULL DEFAULT 0,
  total_amount NUMERIC NOT NULL DEFAULT 0,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  signature_uuid UUID NOT NULL DEFAULT gen_random_uuid(),
  pdf_path TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create fee_statement_items table for itemized expenses
CREATE TABLE public.fee_statement_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  fee_statement_id UUID NOT NULL REFERENCES public.fee_statements(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  amount NUMERIC NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.fee_statements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fee_statement_items ENABLE ROW LEVEL SECURITY;

-- RLS policies for fee_statements
CREATE POLICY "Users can view their own fee statements"
ON public.fee_statements FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own fee statements"
ON public.fee_statements FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own fee statements"
ON public.fee_statements FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own fee statements"
ON public.fee_statements FOR DELETE
USING (auth.uid() = user_id);

-- Public read for verification
CREATE POLICY "Anyone can verify fee statements"
ON public.fee_statements FOR SELECT
TO public
USING (true);

-- RLS policies for fee_statement_items
CREATE POLICY "Users can manage items of own statements"
ON public.fee_statement_items FOR ALL
TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.fee_statements fs
  WHERE fs.id = fee_statement_items.fee_statement_id AND fs.user_id = auth.uid()
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.fee_statements fs
  WHERE fs.id = fee_statement_items.fee_statement_id AND fs.user_id = auth.uid()
));

-- Anyone can read items for verification
CREATE POLICY "Anyone can view fee statement items"
ON public.fee_statement_items FOR SELECT
TO public
USING (true);

-- Update trigger
CREATE TRIGGER update_fee_statements_updated_at
BEFORE UPDATE ON public.fee_statements
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
