-- cassation_rulings: add UPDATE and DELETE policies
CREATE POLICY "Authenticated can update cassation rulings" ON public.cassation_rulings
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated can delete cassation rulings" ON public.cassation_rulings
  FOR DELETE TO authenticated USING (true);

-- cassation_chunks: add UPDATE and DELETE policies
CREATE POLICY "Authenticated can update cassation chunks" ON public.cassation_chunks
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated can delete cassation chunks" ON public.cassation_chunks
  FOR DELETE TO authenticated USING (true);