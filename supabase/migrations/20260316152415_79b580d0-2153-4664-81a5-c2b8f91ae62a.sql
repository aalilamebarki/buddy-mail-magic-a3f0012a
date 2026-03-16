CREATE POLICY "Authenticated users can delete cases"
ON public.cases
FOR DELETE
TO authenticated
USING (true);