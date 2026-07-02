
CREATE TABLE public.meetings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL DEFAULT 'Reunião',
  transcript text NOT NULL DEFAULT '',
  summary text,
  critical_points jsonb NOT NULL DEFAULT '[]'::jsonb,
  decisions jsonb NOT NULL DEFAULT '[]'::jsonb,
  todos jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.meetings TO anon, authenticated;
GRANT ALL ON public.meetings TO service_role;

ALTER TABLE public.meetings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read meetings" ON public.meetings FOR SELECT USING (true);
CREATE POLICY "Public can insert meetings" ON public.meetings FOR INSERT WITH CHECK (true);
CREATE POLICY "Public can update meetings" ON public.meetings FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Public can delete meetings" ON public.meetings FOR DELETE USING (true);

CREATE TRIGGER meetings_touch_updated_at
  BEFORE UPDATE ON public.meetings
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
