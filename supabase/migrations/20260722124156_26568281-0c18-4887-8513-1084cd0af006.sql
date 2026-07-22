
CREATE TABLE public.maquinas_paradas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo_frota text NOT NULL,
  cliente text,
  local text,
  motivo text NOT NULL,
  data_inicio_parada timestamptz NOT NULL DEFAULT now(),
  responsavel text,
  status text NOT NULL DEFAULT 'parada' CHECK (status IN ('parada','concluida')),
  alerta_enviado boolean NOT NULL DEFAULT false,
  data_conclusao timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.maquinas_paradas TO service_role;

ALTER TABLE public.maquinas_paradas ENABLE ROW LEVEL SECURITY;
