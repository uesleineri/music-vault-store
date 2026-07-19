-- Admin notification center needs to react live to new/updated sales.
-- REPLICA IDENTITY FULL so UPDATE events include the old row (needed to
-- detect a payment_status transition into 'paid', not just the new value).
ALTER TABLE public.sales REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'sales'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.sales;
  END IF;
END $$;
