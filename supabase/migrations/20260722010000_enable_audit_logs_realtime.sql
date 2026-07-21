-- The audit log badge needs to react live to new entries (including ones the
-- admin didn't just cause themselves, e.g. another admin's action or a
-- background job failure) instead of only refreshing on next page load.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'audit_logs'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.audit_logs;
  END IF;
END $$;
