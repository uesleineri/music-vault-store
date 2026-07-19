-- Human-readable label for the target of each audit entry (e.g. "Fernandinho -
-- Galileu"), captured at write time so it survives even if the underlying row
-- is later deleted (target_id alone becomes meaningless then).
ALTER TABLE public.audit_logs ADD COLUMN target_label text;

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
  v_label text;
BEGIN
  v_actor := auth.uid();
  IF v_actor IS NOT NULL THEN
    SELECT email INTO v_actor_email FROM auth.users WHERE id = v_actor;
  END IF;

  BEGIN
    v_ip := current_setting('request.headers', true)::json ->> 'x-forwarded-for';
    v_ua := current_setting('request.headers', true)::json ->> 'user-agent';
  EXCEPTION WHEN OTHERS THEN
    v_ip := NULL;
    v_ua := NULL;
  END;

  IF TG_OP = 'INSERT' THEN
    v_changes := jsonb_build_object('new', to_jsonb(NEW) - 'created_at' - 'updated_at');
    v_label := NEW.artist_name || ' - ' || NEW.song_name;
  ELSIF TG_OP = 'DELETE' THEN
    v_changes := jsonb_build_object('old', to_jsonb(OLD) - 'created_at' - 'updated_at');
    v_label := OLD.artist_name || ' - ' || OLD.song_name;
  ELSIF TG_OP = 'UPDATE' THEN
    SELECT jsonb_object_agg(key, value) INTO v_old
      FROM jsonb_each(to_jsonb(OLD)) WHERE key NOT IN ('created_at', 'updated_at')
      AND to_jsonb(OLD) -> key IS DISTINCT FROM to_jsonb(NEW) -> key;
    SELECT jsonb_object_agg(key, value) INTO v_new
      FROM jsonb_each(to_jsonb(NEW)) WHERE key NOT IN ('created_at', 'updated_at')
      AND to_jsonb(OLD) -> key IS DISTINCT FROM to_jsonb(NEW) -> key;
    IF v_old IS NULL THEN
      RETURN NEW;
    END IF;
    v_changes := jsonb_build_object('old', v_old, 'new', v_new);
    v_label := NEW.artist_name || ' - ' || NEW.song_name;
  END IF;

  INSERT INTO public.audit_logs (actor_id, actor_email, action, target_type, target_id, target_label, changes, ip_address, user_agent)
  VALUES (
    v_actor, v_actor_email,
    'multitrack.' || lower(TG_OP),
    'multitrack',
    COALESCE(NEW.id, OLD.id),
    v_label,
    v_changes, v_ip, v_ua
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;
