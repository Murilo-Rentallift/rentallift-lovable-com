-- ============ frota_veiculos ============
CREATE TABLE public.frota_veiculos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  veiculo text NOT NULL DEFAULT '',
  numero_frota text NOT NULL DEFAULT '',
  placa text NOT NULL DEFAULT '',
  condutor_atual text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'disponivel',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.frota_veiculos TO service_role;
ALTER TABLE public.frota_veiculos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "deny all to authenticated" ON public.frota_veiculos FOR ALL TO authenticated USING (false) WITH CHECK (false);
CREATE TRIGGER frota_veiculos_touch BEFORE UPDATE ON public.frota_veiculos FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ checklists_veiculos ============
CREATE TABLE public.checklists_veiculos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  veiculo_id uuid NOT NULL REFERENCES public.frota_veiculos(id) ON DELETE CASCADE,
  frota text NOT NULL DEFAULT '',
  placa text NOT NULL DEFAULT '',
  condutor text NOT NULL DEFAULT '',
  data date NOT NULL DEFAULT CURRENT_DATE,
  vistoriador text NOT NULL DEFAULT '',
  lider text NOT NULL DEFAULT '',
  itens jsonb NOT NULL DEFAULT '[]'::jsonb,
  obs_manutencao text NOT NULL DEFAULT '',
  status_final text NOT NULL DEFAULT 'disponivel',
  assinaturas jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.checklists_veiculos TO service_role;
ALTER TABLE public.checklists_veiculos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "deny all to authenticated" ON public.checklists_veiculos FOR ALL TO authenticated USING (false) WITH CHECK (false);
CREATE TRIGGER checklists_veiculos_touch BEFORE UPDATE ON public.checklists_veiculos FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE INDEX checklists_veiculos_veiculo_idx ON public.checklists_veiculos(veiculo_id, created_at DESC);

-- ============ pendencias_veiculos ============
CREATE TABLE public.pendencias_veiculos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  veiculo_id uuid NOT NULL REFERENCES public.frota_veiculos(id) ON DELETE CASCADE,
  checklist_id uuid REFERENCES public.checklists_veiculos(id) ON DELETE SET NULL,
  item text NOT NULL DEFAULT '',
  descricao text NOT NULL DEFAULT '',
  fotos text[] NOT NULL DEFAULT '{}'::text[],
  status text NOT NULL DEFAULT 'aberta',
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.pendencias_veiculos TO service_role;
ALTER TABLE public.pendencias_veiculos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "deny all to authenticated" ON public.pendencias_veiculos FOR ALL TO authenticated USING (false) WITH CHECK (false);
CREATE INDEX pendencias_veiculos_veiculo_idx ON public.pendencias_veiculos(veiculo_id, status);

-- ============ retiradas_veiculos ============
CREATE TABLE public.retiradas_veiculos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  veiculo_id uuid NOT NULL REFERENCES public.frota_veiculos(id) ON DELETE CASCADE,
  retirado_por text NOT NULL DEFAULT '',
  destino_motivo text NOT NULL DEFAULT '',
  km_saida numeric,
  data_saida timestamptz NOT NULL DEFAULT now(),
  km_retorno numeric,
  data_retorno timestamptz,
  observacao_devolucao text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.retiradas_veiculos TO service_role;
ALTER TABLE public.retiradas_veiculos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "deny all to authenticated" ON public.retiradas_veiculos FOR ALL TO authenticated USING (false) WITH CHECK (false);
CREATE INDEX retiradas_veiculos_veiculo_idx ON public.retiradas_veiculos(veiculo_id, data_saida DESC);

-- ============ solicitacoes_manutencao ============
CREATE TABLE public.solicitacoes_manutencao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  veiculo_id uuid NOT NULL REFERENCES public.frota_veiculos(id) ON DELETE CASCADE,
  origem text NOT NULL DEFAULT 'checklist',
  descricao text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'aberta',
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);
GRANT ALL ON public.solicitacoes_manutencao TO service_role;
ALTER TABLE public.solicitacoes_manutencao ENABLE ROW LEVEL SECURITY;
CREATE POLICY "deny all to authenticated" ON public.solicitacoes_manutencao FOR ALL TO authenticated USING (false) WITH CHECK (false);
CREATE INDEX solicitacoes_manutencao_veiculo_idx ON public.solicitacoes_manutencao(veiculo_id, status);

-- ============ historico_condutores ============
CREATE TABLE public.historico_condutores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  veiculo_id uuid NOT NULL REFERENCES public.frota_veiculos(id) ON DELETE CASCADE,
  condutor_anterior text NOT NULL DEFAULT '',
  condutor_novo text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.historico_condutores TO service_role;
ALTER TABLE public.historico_condutores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "deny all to authenticated" ON public.historico_condutores FOR ALL TO authenticated USING (false) WITH CHECK (false);
CREATE INDEX historico_condutores_veiculo_idx ON public.historico_condutores(veiculo_id, created_at DESC);

-- ============ seed da frota ============
INSERT INTO public.frota_veiculos (veiculo, numero_frota, placa, condutor_atual, status) VALUES
  ('KA', '67', 'FBV2335', 'RILDO', 'disponivel'),
  ('STRADA', '61', 'GCZ3299', 'RESERVA', 'disponivel'),
  ('STRADA', '77', 'EUS5152', 'RESERVA', 'disponivel'),
  ('STRADA', '81', 'FWC4D58', 'RESERVA', 'disponivel'),
  ('STRADA', '83', 'FXM6J35', 'RESERVA', 'disponivel'),
  ('STRADA', '85', 'FRZ4G94', 'GUSTAVO', 'disponivel'),
  ('STRADA', '87', 'FUV5F26', 'WILLIAM', 'disponivel'),
  ('STRADA', '89', 'EQR3A64', 'MARCOS', 'disponivel'),
  ('STRADA', '91', 'GBH8D77', 'TIAGO', 'disponivel'),
  ('STRADA', '93', 'EZC2B72', 'VINICIUS', 'disponivel'),
  ('STRADA', '95', 'FRJ5C53', 'RESERVA', 'disponivel'),
  ('FIORINO', '97', 'DMK5J01', 'BERGSON', 'disponivel'),
  ('FIORINO', '99', 'TJX9J97', 'JEFFERSON', 'disponivel'),
  ('FIORINO', '101', 'TLA7D56', 'ANTONIO', 'disponivel'),
  ('FIORINO', '103', 'TMI0E62', 'FLAVIO', 'disponivel'),
  ('FIORINO', '105', 'UEA6B49', 'RAFAEL', 'disponivel');