ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS oficina_pin text NOT NULL DEFAULT '4321';

CREATE TABLE IF NOT EXISTS public.part_requests (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  requester_name text NOT NULL,
  part_name text NOT NULL,
  quantity integer NOT NULL DEFAULT 1,
  code text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'pendente',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.part_requests TO authenticated;
GRANT ALL ON public.part_requests TO service_role;

ALTER TABLE public.part_requests ENABLE ROW LEVEL SECURITY;