CREATE TABLE public.coupons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  discount_type text NOT NULL CHECK (discount_type IN ('percentage', 'fixed')),
  discount_value numeric NOT NULL CHECK (discount_value > 0),
  max_uses integer CHECK (max_uses IS NULL OR max_uses > 0),
  times_used integer NOT NULL DEFAULT 0,
  min_purchase_value numeric,
  expires_at timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;

-- Deliberately no public SELECT policy: coupon codes are only checked through
-- the validate-coupon Edge Function, never readable directly via the anon key
-- (otherwise anyone could list every active code straight from the table).
CREATE POLICY "Admins can view coupons"
ON public.coupons FOR SELECT
USING (EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid()));

CREATE POLICY "Admins can insert coupons"
ON public.coupons FOR INSERT
WITH CHECK (EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid()));

CREATE POLICY "Admins can update coupons"
ON public.coupons FOR UPDATE
USING (EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid()));

CREATE POLICY "Admins can delete coupons"
ON public.coupons FOR DELETE
USING (EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid()));

CREATE TRIGGER update_coupons_updated_at
BEFORE UPDATE ON public.coupons
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Same audit pattern as multitracks: every create/edit/delete from the admin
-- panel gets attributed to the acting admin automatically.
CREATE OR REPLACE FUNCTION public.log_coupon_audit()
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
      FROM jsonb_each(to_jsonb(OLD)) WHERE key NOT IN ('created_at', 'updated_at', 'times_used')
      AND to_jsonb(OLD) -> key IS DISTINCT FROM to_jsonb(NEW) -> key;
    SELECT jsonb_object_agg(key, value) INTO v_new
      FROM jsonb_each(to_jsonb(NEW)) WHERE key NOT IN ('created_at', 'updated_at', 'times_used')
      AND to_jsonb(OLD) -> key IS DISTINCT FROM to_jsonb(NEW) -> key;
    IF v_old IS NULL THEN
      RETURN NEW; -- only times_used changed (a redemption), not an admin edit
    END IF;
    v_changes := jsonb_build_object('old', v_old, 'new', v_new);
  END IF;

  INSERT INTO public.audit_logs (actor_id, actor_email, action, target_type, target_id, target_label, changes, ip_address, user_agent)
  VALUES (
    v_actor, v_actor_email,
    'coupon.' || lower(TG_OP),
    'coupon',
    COALESCE(NEW.id, OLD.id),
    COALESCE(NEW.code, OLD.code),
    v_changes, v_ip, v_ua
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER coupons_audit
AFTER INSERT OR UPDATE OR DELETE ON public.coupons
FOR EACH ROW EXECUTE FUNCTION public.log_coupon_audit();

-- Atomic, race-safe redemption: only succeeds while the coupon is still
-- usable, so two simultaneous checkouts can't both grab the last use.
CREATE OR REPLACE FUNCTION public.consume_coupon(p_coupon_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated integer;
BEGIN
  UPDATE public.coupons
  SET times_used = times_used + 1
  WHERE id = p_coupon_id
    AND is_active = true
    AND (max_uses IS NULL OR times_used < max_uses)
    AND (expires_at IS NULL OR expires_at > now());
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated > 0;
END;
$$;

-- Track which coupon (if any) a sale used, and how much it discounted, for
-- reporting - the actual charged amount still lives in sales.amount.
ALTER TABLE public.sales ADD COLUMN coupon_id uuid REFERENCES public.coupons(id) ON DELETE SET NULL;
ALTER TABLE public.sales ADD COLUMN discount_amount numeric NOT NULL DEFAULT 0;
