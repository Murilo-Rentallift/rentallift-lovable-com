CREATE TABLE public.maintenance_returns (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_name text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.maintenance_returns TO authenticated;
GRANT ALL ON public.maintenance_returns TO service_role;

ALTER TABLE public.maintenance_returns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "deny all to authenticated" ON public.maintenance_returns
  FOR ALL TO authenticated USING (false) WITH CHECK (false);

CREATE TRIGGER maintenance_returns_touch_updated_at
  BEFORE UPDATE ON public.maintenance_returns
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();