-- Lets the admin unpublish a multitrack from the storefront without deleting it.
ALTER TABLE public.multitracks ADD COLUMN is_active boolean NOT NULL DEFAULT true;
