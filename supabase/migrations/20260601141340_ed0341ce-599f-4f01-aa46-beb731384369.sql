
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS almox_pin text NOT NULL DEFAULT '5678';
ALTER TABLE public.parts ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pendente';
ALTER TABLE public.parts ADD CONSTRAINT parts_status_check CHECK (status IN ('pendente','separado','em_falta','entregue'));
