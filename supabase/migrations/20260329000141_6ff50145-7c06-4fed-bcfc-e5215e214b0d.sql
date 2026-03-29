
-- جدول أرشيف الوصولات القانوني (append-only)
CREATE TABLE public.invoice_receipts_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  invoice_id uuid REFERENCES public.invoices(id) ON DELETE SET NULL,
  invoice_number text NOT NULL,
  signature_uuid uuid NOT NULL,
  security_hash text NOT NULL,
  client_name text,
  client_cin text,
  amount numeric NOT NULL DEFAULT 0,
  payment_method text,
  case_number text,
  lawyer_name text,
  pdf_path text,
  browser_info text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- فهارس للبحث السريع
CREATE INDEX idx_audit_user ON public.invoice_receipts_audit(user_id);
CREATE INDEX idx_audit_invoice ON public.invoice_receipts_audit(invoice_number);
CREATE INDEX idx_audit_hash ON public.invoice_receipts_audit(security_hash);
CREATE INDEX idx_audit_created ON public.invoice_receipts_audit(created_at DESC);

-- تفعيل RLS
ALTER TABLE public.invoice_receipts_audit ENABLE ROW LEVEL SECURITY;

-- سياسة القراءة: كل مستخدم يرى أرشيفه فقط
CREATE POLICY "Users can view own audit records"
  ON public.invoice_receipts_audit FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- سياسة الإدراج: كل مستخدم يضيف لأرشيفه فقط
CREATE POLICY "Users can insert own audit records"
  ON public.invoice_receipts_audit FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- لا توجد سياسة UPDATE أو DELETE = لا يمكن التعديل أو الحذف أبداً
