CREATE POLICY "Authenticated users can delete clients"
ON public.clients FOR DELETE
TO authenticated
USING (true);