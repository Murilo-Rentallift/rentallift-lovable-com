CREATE TABLE public.liberacoes_equipamento (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa TEXT NOT NULL,
  tipo TEXT NOT NULL,
  cliente TEXT,
  empilhadeira TEXT,
  acessorios TEXT,
  desmontagem TEXT,
  valor_locacao TEXT,
  endereco TEXT,
  modalidade_data TEXT NOT NULL,
  data_entrega DATE,
  data_entrega_texto TEXT,
  frete TEXT,
  transportadora TEXT,
  valor_frete TEXT,
  data_cobranca DATE,
  data_cobranca_texto TEXT,
  data_cobranca_branco BOOLEAN NOT NULL DEFAULT false,
  observacao TEXT,
  mensagem TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT ALL ON public.liberacoes_equipamento TO service_role;

ALTER TABLE public.liberacoes_equipamento ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_liberacoes_equipamento_updated_at
BEFORE UPDATE ON public.liberacoes_equipamento
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();