CREATE TABLE public.attended_calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  call_date date NOT NULL,
  call_time time,
  company text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  technician text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.attended_calls TO service_role;

ALTER TABLE public.attended_calls ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_attended_calls_date ON public.attended_calls(call_date);

CREATE TRIGGER attended_calls_touch_updated_at
BEFORE UPDATE ON public.attended_calls
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();