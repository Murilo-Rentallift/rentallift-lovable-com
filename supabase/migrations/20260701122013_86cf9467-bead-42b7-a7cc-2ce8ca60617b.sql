
ALTER TABLE public.part_requests
  ADD COLUMN IF NOT EXISTS original_group_id uuid,
  ADD COLUMN IF NOT EXISTS edited_at timestamptz,
  ADD COLUMN IF NOT EXISTS superseded boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS part_requests_original_group_id_idx
  ON public.part_requests(original_group_id);
CREATE INDEX IF NOT EXISTS part_requests_superseded_idx
  ON public.part_requests(superseded);
