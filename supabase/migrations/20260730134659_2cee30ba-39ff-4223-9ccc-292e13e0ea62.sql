CREATE TABLE public.maquinas_disponibilidade (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo text NOT NULL,
  frota text NOT NULL DEFAULT '',
  modelo text NOT NULL DEFAULT '',
  marca text NOT NULL DEFAULT '',
  ano_fabricacao integer,
  status text NOT NULL DEFAULT 'disponivel',
  observacoes text,
  fotos text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.maquinas_disponibilidade TO service_role;

ALTER TABLE public.maquinas_disponibilidade ENABLE ROW LEVEL SECURITY;

CREATE POLICY "deny all to authenticated" ON public.maquinas_disponibilidade
  AS PERMISSIVE FOR ALL TO authenticated USING (false) WITH CHECK (false);

CREATE TRIGGER maquinas_disponibilidade_updated_at
  BEFORE UPDATE ON public.maquinas_disponibilidade
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_maquinas_disponibilidade_tipo ON public.maquinas_disponibilidade (tipo);