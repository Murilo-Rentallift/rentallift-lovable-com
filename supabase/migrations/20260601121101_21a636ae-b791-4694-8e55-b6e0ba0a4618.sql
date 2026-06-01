
-- Operators
CREATE TABLE public.operators (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  pin text NOT NULL DEFAULT '1234',
  position int NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.operators TO service_role;
ALTER TABLE public.operators ENABLE ROW LEVEL SECURITY;

-- Schedules (one task per operator per date)
CREATE TABLE public.schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operator_id uuid NOT NULL REFERENCES public.operators(id) ON DELETE CASCADE,
  work_date date NOT NULL,
  task text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(operator_id, work_date)
);
GRANT ALL ON public.schedules TO service_role;
ALTER TABLE public.schedules ENABLE ROW LEVEL SECURITY;

-- Parts list per schedule
CREATE TABLE public.parts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id uuid NOT NULL REFERENCES public.schedules(id) ON DELETE CASCADE,
  name text NOT NULL,
  quantity int NOT NULL DEFAULT 1,
  checked boolean NOT NULL DEFAULT false,
  position int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.parts TO service_role;
ALTER TABLE public.parts ENABLE ROW LEVEL SECURITY;

-- App settings (single row)
CREATE TABLE public.app_settings (
  id int PRIMARY KEY DEFAULT 1,
  admin_pin text NOT NULL DEFAULT '9999',
  CONSTRAINT single_row CHECK (id = 1)
);
GRANT ALL ON public.app_settings TO service_role;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

INSERT INTO public.app_settings (id, admin_pin) VALUES (1, '9999');

-- Seed 9 operators
INSERT INTO public.operators (name, pin, position) VALUES
  ('Operador 1', '1234', 1),
  ('Operador 2', '1234', 2),
  ('Operador 3', '1234', 3),
  ('Operador 4', '1234', 4),
  ('Operador 5', '1234', 5),
  ('Operador 6', '1234', 6),
  ('Operador 7', '1234', 7),
  ('Operador 8', '1234', 8),
  ('Operador 9', '1234', 9);

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;
CREATE TRIGGER schedules_touch BEFORE UPDATE ON public.schedules
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
