ALTER TABLE public.part_requests ADD COLUMN IF NOT EXISTS group_id UUID DEFAULT gen_random_uuid();

-- Update existing rows so each gets its own unique group_id
UPDATE public.part_requests SET group_id = gen_random_uuid() WHERE group_id IS NULL;

-- Make group_id NOT NULL going forward
ALTER TABLE public.part_requests ALTER COLUMN group_id SET NOT NULL;

-- Add index for efficient grouping queries
CREATE INDEX IF NOT EXISTS idx_part_requests_group_id ON public.part_requests(group_id);
