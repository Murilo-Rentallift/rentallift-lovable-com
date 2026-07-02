DROP POLICY IF EXISTS "Public can read meetings" ON public.meetings;
DROP POLICY IF EXISTS "Public can insert meetings" ON public.meetings;
DROP POLICY IF EXISTS "Public can update meetings" ON public.meetings;
DROP POLICY IF EXISTS "Public can delete meetings" ON public.meetings;
REVOKE ALL ON public.meetings FROM anon, authenticated;
ALTER TABLE public.meetings ENABLE ROW LEVEL SECURITY;