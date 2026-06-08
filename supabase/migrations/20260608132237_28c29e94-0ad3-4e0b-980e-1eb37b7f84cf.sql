
CREATE TABLE public.workshop_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL DEFAULT '',
  supplier text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'aguardando_orcamento',
  deadline_days integer NOT NULL DEFAULT 0,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.workshop_items TO service_role;
ALTER TABLE public.workshop_items ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER workshop_items_touch_updated_at
BEFORE UPDATE ON public.workshop_items
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.tool_loans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tool_name text NOT NULL DEFAULT '',
  technician_name text NOT NULL DEFAULT '',
  checkout_date date NOT NULL DEFAULT CURRENT_DATE,
  returned_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.tool_loans TO service_role;
ALTER TABLE public.tool_loans ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER tool_loans_touch_updated_at
BEFORE UPDATE ON public.tool_loans
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
