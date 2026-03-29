
-- حذف الجدول القديم وإعادة إنشائه بالهيكل الجديد
DROP TABLE IF EXISTS public.invoice_receipts_audit;

CREATE TABLE public.invoice_receipts_audit (
  id                uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_id        uuid        REFERENCES public.invoices(id) ON DELETE SET NULL,
  invoice_number    text        NOT NULL,
  signature_uuid    text,
  security_seal     text,
  amount            numeric     NOT NULL,
  client_name_ar    text,
  client_name_fr    text,
  client_cin        text,
  lawyer_name       text,
  payment_method    text,
  case_number       text,
  pdf_path          text,
  issued_by_user_id uuid        NOT NULL,
  issued_at         timestamptz NOT NULL DEFAULT now(),
  user_agent        text,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_invoice_id        ON public.invoice_receipts_audit(invoice_id);
CREATE INDEX idx_audit_issued_by_user_id ON public.invoice_receipts_audit(issued_by_user_id);
CREATE INDEX idx_audit_issued_at         ON public.invoice_receipts_audit(issued_at DESC);
CREATE INDEX idx_audit_signature_uuid    ON public.invoice_receipts_audit(signature_uuid);

ALTER TABLE public.invoice_receipts_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit_select_own" ON public.invoice_receipts_audit
  FOR SELECT TO authenticated
  USING (issued_by_user_id = auth.uid());

CREATE POLICY "audit_insert_own" ON public.invoice_receipts_audit
  FOR INSERT TO authenticated
  WITH CHECK (issued_by_user_id = auth.uid());
