CREATE TABLE public.pending_calls (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  call_date DATE NOT NULL,
  company TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  priority TEXT NOT NULL DEFAULT 'normal',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pending_calls TO authenticated;
GRANT ALL ON public.pending_calls TO service_role;

ALTER TABLE public.pending_calls ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_pending_calls_date ON public.pending_calls(call_date);

CREATE TRIGGER pending_calls_touch_updated_at
BEFORE UPDATE ON public.pending_calls
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();