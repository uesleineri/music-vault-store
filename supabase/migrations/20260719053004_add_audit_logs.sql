-- Audit trail: who did what, when, to what, and (for data changes) old vs new values.
-- Two sources feed this table:
--   1. A trigger on `multitracks` (below) for direct client writes done under the
--      acting admin's own RLS-checked session (create/update/delete/publish toggle).
--   2. Manual inserts from Edge Functions that act via service_role - those already
--      know the acting admin (or "system" for the Asaas webhook) in code, so a
--      generic trigger there would either lose attribution or double-log.
CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_email text,
  action text NOT NULL,
  target_type text NOT NULL,
  target_id uuid,
  changes jsonb,
  ip_address text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX audit_logs_created_at_idx ON public.audit_logs (created_at DESC);
CREATE INDEX audit_logs_target_idx ON public.audit_logs (target_type, target_id);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view audit logs"
ON public.audit_logs
FOR SELECT
USING (
  EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid())
);

-- Deliberately no INSERT/UPDATE/DELETE policy for anon/authenticated: the table is
-- only ever written by the SECURITY DEFINER trigger function below or by Edge
-- Functions using the service_role key, so a compromised admin session can't
-- tamper with or erase its own trail via a direct REST call.

CREATE OR REPLACE FUNCTION public.log_multitrack_audit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid;
  v_actor_email text;
  v_changes jsonb;
  v_ip text;
  v_ua text;
  v_old jsonb;
  v_new jsonb;
BEGIN
  v_actor := auth.uid();
  IF v_actor IS NOT NULL THEN
    SELECT email INTO v_actor_email FROM auth.users WHERE id = v_actor;
  END IF;

  -- Supabase's PostgREST layer exposes the original HTTP request headers as a
  -- session GUC; best-effort only, must never break the actual write.
  BEGIN
    v_ip := current_setting('request.headers', true)::json ->> 'x-forwarded-for';
    v_ua := current_setting('request.headers', true)::json ->> 'user-agent';
  EXCEPTION WHEN OTHERS THEN
    v_ip := NULL;
    v_ua := NULL;
  END;

  IF TG_OP = 'INSERT' THEN
    v_changes := jsonb_build_object('new', to_jsonb(NEW) - 'created_at' - 'updated_at');
  ELSIF TG_OP = 'DELETE' THEN
    v_changes := jsonb_build_object('old', to_jsonb(OLD) - 'created_at' - 'updated_at');
  ELSIF TG_OP = 'UPDATE' THEN
    SELECT jsonb_object_agg(key, value) INTO v_old
      FROM jsonb_each(to_jsonb(OLD)) WHERE key NOT IN ('created_at', 'updated_at')
      AND to_jsonb(OLD) -> key IS DISTINCT FROM to_jsonb(NEW) -> key;
    SELECT jsonb_object_agg(key, value) INTO v_new
      FROM jsonb_each(to_jsonb(NEW)) WHERE key NOT IN ('created_at', 'updated_at')
      AND to_jsonb(OLD) -> key IS DISTINCT FROM to_jsonb(NEW) -> key;
    IF v_old IS NULL THEN
      RETURN NEW; -- nothing meaningful changed (e.g. only updated_at bumped)
    END IF;
    v_changes := jsonb_build_object('old', v_old, 'new', v_new);
  END IF;

  INSERT INTO public.audit_logs (actor_id, actor_email, action, target_type, target_id, changes, ip_address, user_agent)
  VALUES (
    v_actor, v_actor_email,
    'multitrack.' || lower(TG_OP),
    'multitrack',
    COALESCE(NEW.id, OLD.id),
    v_changes, v_ip, v_ua
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER multitracks_audit
AFTER INSERT OR UPDATE OR DELETE ON public.multitracks
FOR EACH ROW EXECUTE FUNCTION public.log_multitrack_audit();

GRANT SELECT ON public.audit_logs TO authenticated;
