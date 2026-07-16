ALTER TABLE public.parts
  ADD COLUMN IF NOT EXISTS original_name text,
  ADD COLUMN IF NOT EXISTS original_quantity integer,
  ADD COLUMN IF NOT EXISTS edited_at timestamptz;