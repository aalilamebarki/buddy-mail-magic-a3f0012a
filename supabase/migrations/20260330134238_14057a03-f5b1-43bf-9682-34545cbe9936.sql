
-- mahakim_sync_jobs: drop old and create anon+authenticated
DROP POLICY IF EXISTS "Allow authenticated all on mahakim_sync_jobs" ON public.mahakim_sync_jobs;
CREATE POLICY "Allow all on mahakim_sync_jobs"
ON public.mahakim_sync_jobs FOR ALL
TO anon, authenticated
USING (true)
WITH CHECK (true);

-- notifications: drop old specific policies, add combined
DROP POLICY IF EXISTS "Service can insert notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can delete own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can view own notifications" ON public.notifications;
CREATE POLICY "Allow all on notifications"
ON public.notifications FOR ALL
TO anon, authenticated
USING (true)
WITH CHECK (true);

-- cassation_rulings: drop old specific policies, add combined
DROP POLICY IF EXISTS "Anyone can read cassation rulings" ON public.cassation_rulings;
DROP POLICY IF EXISTS "Authenticated can insert cassation rulings" ON public.cassation_rulings;
DROP POLICY IF EXISTS "Authenticated can update cassation rulings" ON public.cassation_rulings;
DROP POLICY IF EXISTS "Authenticated can delete cassation rulings" ON public.cassation_rulings;
CREATE POLICY "Allow all on cassation_rulings"
ON public.cassation_rulings FOR ALL
TO anon, authenticated
USING (true)
WITH CHECK (true);

-- cassation_chunks: drop old specific policies, add combined
DROP POLICY IF EXISTS "Anyone can read cassation chunks" ON public.cassation_chunks;
DROP POLICY IF EXISTS "Authenticated can insert cassation chunks" ON public.cassation_chunks;
DROP POLICY IF EXISTS "Authenticated can update cassation chunks" ON public.cassation_chunks;
DROP POLICY IF EXISTS "Authenticated can delete cassation chunks" ON public.cassation_chunks;
CREATE POLICY "Allow all on cassation_chunks"
ON public.cassation_chunks FOR ALL
TO anon, authenticated
USING (true)
WITH CHECK (true);

-- push_subscriptions: drop old, add combined
DROP POLICY IF EXISTS "Allow authenticated select on push_subscriptions" ON public.push_subscriptions;
DROP POLICY IF EXISTS "Allow authenticated insert on push_subscriptions" ON public.push_subscriptions;
DROP POLICY IF EXISTS "Allow authenticated delete on push_subscriptions" ON public.push_subscriptions;
CREATE POLICY "Allow all on push_subscriptions"
ON public.push_subscriptions FOR ALL
TO anon, authenticated
USING (true)
WITH CHECK (true);
