-- BUG FIX: sales.multitrack_id was created with ON DELETE CASCADE, meaning
-- deleting a multitrack from the admin panel silently wiped every sale
-- (revenue/audit history) ever made for it - with no warning beyond the
-- generic "esta ação não pode ser desfeita" about the multitrack itself.
-- Switch to the default RESTRICT behavior: a multitrack with any sales
-- history can no longer be hard-deleted at all - the admin has to use the
-- existing publish/unpublish toggle instead, which already exists exactly
-- for "stop selling this without losing the record."
DO $$
DECLARE
  v_constraint_name text;
BEGIN
  SELECT conname INTO v_constraint_name
  FROM pg_constraint
  WHERE conrelid = 'public.sales'::regclass
    AND confrelid = 'public.multitracks'::regclass
    AND contype = 'f';

  IF v_constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.sales DROP CONSTRAINT %I', v_constraint_name);
  END IF;
END $$;

ALTER TABLE public.sales
  ADD CONSTRAINT sales_multitrack_id_fkey
  FOREIGN KEY (multitrack_id) REFERENCES public.multitracks(id);
