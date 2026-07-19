-- Kits promocionais: group several multitracks into one product sold at a
-- single fixed price, delivered as one PIX checkout that unlocks every song
-- inside the bundle.
CREATE TABLE public.bundles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC(10,2) NOT NULL,
  cover_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE public.bundle_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  bundle_id UUID NOT NULL REFERENCES public.bundles(id) ON DELETE CASCADE,
  -- RESTRICT, not CASCADE: a multitrack that's part of a bundle can't be
  -- hard-deleted out from under it (same reasoning as sales_multitrack_id_fkey).
  multitrack_id UUID NOT NULL REFERENCES public.multitracks(id) ON DELETE RESTRICT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (bundle_id, multitrack_id)
);

ALTER TABLE public.bundles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bundle_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view bundles" ON public.bundles FOR SELECT USING (true);
CREATE POLICY "Admins can insert bundles" ON public.bundles FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid())
);
CREATE POLICY "Admins can update bundles" ON public.bundles FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid())
);
CREATE POLICY "Admins can delete bundles" ON public.bundles FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid())
);

-- Public SELECT so the storefront can show which songs are included.
CREATE POLICY "Anyone can view bundle items" ON public.bundle_items FOR SELECT USING (true);
CREATE POLICY "Admins can insert bundle items" ON public.bundle_items FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid())
);
CREATE POLICY "Admins can delete bundle items" ON public.bundle_items FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid())
);

CREATE TRIGGER update_bundles_updated_at
BEFORE UPDATE ON public.bundles
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- A sale is for exactly one multitrack OR one bundle, never both/neither.
ALTER TABLE public.sales ALTER COLUMN multitrack_id DROP NOT NULL;
ALTER TABLE public.sales ADD COLUMN bundle_id UUID REFERENCES public.bundles(id) ON DELETE RESTRICT;
ALTER TABLE public.sales ADD CONSTRAINT sales_exactly_one_product CHECK (
  (multitrack_id IS NOT NULL AND bundle_id IS NULL) OR
  (multitrack_id IS NULL AND bundle_id IS NOT NULL)
);
