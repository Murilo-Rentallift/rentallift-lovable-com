-- Explicit deny-by-default policies for the private 'maquinas-fotos' bucket.
-- All legitimate access happens server-side via the service role (which bypasses RLS)
-- and short-lived signed URLs, so no client role needs direct object access.

DROP POLICY IF EXISTS "maquinas_fotos_no_client_select" ON storage.objects;
DROP POLICY IF EXISTS "maquinas_fotos_no_client_insert" ON storage.objects;
DROP POLICY IF EXISTS "maquinas_fotos_no_client_update" ON storage.objects;
DROP POLICY IF EXISTS "maquinas_fotos_no_client_delete" ON storage.objects;

CREATE POLICY "maquinas_fotos_no_client_select"
ON storage.objects FOR SELECT TO anon, authenticated
USING (false);

CREATE POLICY "maquinas_fotos_no_client_insert"
ON storage.objects FOR INSERT TO anon, authenticated
WITH CHECK (false);

CREATE POLICY "maquinas_fotos_no_client_update"
ON storage.objects FOR UPDATE TO anon, authenticated
USING (false) WITH CHECK (false);

CREATE POLICY "maquinas_fotos_no_client_delete"
ON storage.objects FOR DELETE TO anon, authenticated
USING (false);