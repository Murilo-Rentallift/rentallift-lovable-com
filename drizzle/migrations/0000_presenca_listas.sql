CREATE TABLE public.presenca_listas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  data date NOT NULL DEFAULT CURRENT_DATE,
  assunto text NOT NULL DEFAULT 'Planejamento semanal',
  participantes jsonb NOT NULL DEFAULT '[]'::jsonb,
  pdf_path text,
  email_enviado_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.presenca_listas TO service_role;
ALTER TABLE public.presenca_listas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "deny all to authenticated" ON public.presenca_listas FOR ALL TO authenticated USING (false) WITH CHECK (false);