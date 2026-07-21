-- Per-admin "last viewed" watermark for the audit log, so the sidebar can
-- show an unread count the same way notifications do. Deliberately separate
-- from audit_logs itself (which stays write-only via trigger/service_role,
-- see 20260719053004_add_audit_logs.sql) - this table only ever records a
-- timestamp, never touches the log's own tamper-evidence.
CREATE TABLE public.admin_log_reads (
  admin_user_id UUID NOT NULL PRIMARY KEY REFERENCES public.admin_users(id) ON DELETE CASCADE,
  last_viewed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_log_reads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view own log-read state" ON public.admin_log_reads FOR SELECT USING (
  admin_user_id IN (SELECT id FROM public.admin_users WHERE user_id = auth.uid())
);
CREATE POLICY "Admins can insert own log-read state" ON public.admin_log_reads FOR INSERT WITH CHECK (
  admin_user_id IN (SELECT id FROM public.admin_users WHERE user_id = auth.uid())
);
CREATE POLICY "Admins can update own log-read state" ON public.admin_log_reads FOR UPDATE USING (
  admin_user_id IN (SELECT id FROM public.admin_users WHERE user_id = auth.uid())
);
