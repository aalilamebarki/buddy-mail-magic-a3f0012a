
DROP POLICY IF EXISTS "Allow all on mahakim_sync_jobs" ON public.mahakim_sync_jobs;
CREATE POLICY "Allow authenticated all on mahakim_sync_jobs"
ON public.mahakim_sync_jobs FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all on notifications" ON public.notifications;
CREATE POLICY "Allow authenticated all on notifications"
ON public.notifications FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all on cassation_rulings" ON public.cassation_rulings;
CREATE POLICY "Allow authenticated all on cassation_rulings"
ON public.cassation_rulings FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all on cassation_chunks" ON public.cassation_chunks;
CREATE POLICY "Allow authenticated all on cassation_chunks"
ON public.cassation_chunks FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all on push_subscriptions" ON public.push_subscriptions;
CREATE POLICY "Allow authenticated all on push_subscriptions"
ON public.push_subscriptions FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);
