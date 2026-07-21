-- Avaliações e prova social: um comprador verificado deixa uma nota (1-5) e
-- opcionalmente um comentário para um multitrack ou kit que ele realmente
-- pagou. Fica pendente até um admin aprovar - só então aparece publicamente.
CREATE TABLE public.reviews (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  multitrack_id UUID REFERENCES public.multitracks(id) ON DELETE CASCADE,
  bundle_id UUID REFERENCES public.bundles(id) ON DELETE CASCADE,
  buyer_email TEXT NOT NULL,
  reviewer_name TEXT NOT NULL,
  rating SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  is_approved BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT reviews_exactly_one_product CHECK (
    (multitrack_id IS NOT NULL AND bundle_id IS NULL) OR
    (multitrack_id IS NULL AND bundle_id IS NOT NULL)
  )
);

-- One review per buyer per product - re-submitting isn't supported (MVP);
-- an admin can always delete a review to let the buyer start over.
CREATE UNIQUE INDEX idx_reviews_unique_multitrack ON public.reviews (buyer_email, multitrack_id) WHERE multitrack_id IS NOT NULL;
CREATE UNIQUE INDEX idx_reviews_unique_bundle ON public.reviews (buyer_email, bundle_id) WHERE bundle_id IS NOT NULL;

CREATE INDEX idx_reviews_multitrack_approved ON public.reviews (multitrack_id) WHERE is_approved = true;
CREATE INDEX idx_reviews_bundle_approved ON public.reviews (bundle_id) WHERE is_approved = true;

ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

-- Public storefront only ever sees approved reviews.
CREATE POLICY "Anyone can view approved reviews" ON public.reviews FOR SELECT USING (is_approved = true);

-- A buyer can see their own review even while it's still pending, so "Minha
-- Conta" can show "aguardando aprovação" instead of nothing.
CREATE POLICY "Customers can view own reviews" ON public.reviews FOR SELECT USING (
  buyer_email = (auth.jwt() ->> 'email')
);

CREATE POLICY "Admins can view all reviews" ON public.reviews FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid())
);

-- Only a logged-in customer, under their own verified email, reviewing a
-- product they actually paid for, and never self-approving.
CREATE POLICY "Customers can review purchased products" ON public.reviews FOR INSERT WITH CHECK (
  buyer_email = (auth.jwt() ->> 'email')
  AND is_approved = false
  AND EXISTS (
    SELECT 1 FROM public.sales s
    WHERE s.buyer_email = (auth.jwt() ->> 'email')
      AND s.payment_status = 'paid'
      AND (
        (multitrack_id IS NOT NULL AND s.multitrack_id = multitrack_id) OR
        (bundle_id IS NOT NULL AND s.bundle_id = bundle_id)
      )
  )
);

-- Approve/reject (via is_approved) is admin-only.
CREATE POLICY "Admins can update reviews" ON public.reviews FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid())
);

CREATE POLICY "Admins can delete reviews" ON public.reviews FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid())
);

-- Same audit pattern as multitracks/coupons/bundles - every submit/approve/
-- reject/delete gets attributed to whoever actually did it (customer or admin).
CREATE OR REPLACE FUNCTION public.log_review_audit()
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
    v_changes := jsonb_build_object('new', to_jsonb(NEW) - 'created_at');
  ELSIF TG_OP = 'DELETE' THEN
    v_changes := jsonb_build_object('old', to_jsonb(OLD) - 'created_at');
  ELSIF TG_OP = 'UPDATE' THEN
    v_changes := jsonb_build_object(
      'old', jsonb_build_object('is_approved', OLD.is_approved),
      'new', jsonb_build_object('is_approved', NEW.is_approved)
    );
  END IF;

  INSERT INTO public.audit_logs (actor_id, actor_email, action, target_type, target_id, target_label, changes, ip_address, user_agent)
  VALUES (
    v_actor, v_actor_email,
    'review.' || lower(TG_OP),
    'review',
    COALESCE(NEW.id, OLD.id),
    COALESCE(NEW.reviewer_name, OLD.reviewer_name),
    v_changes, v_ip, v_ua
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER reviews_audit
AFTER INSERT OR UPDATE OR DELETE ON public.reviews
FOR EACH ROW EXECUTE FUNCTION public.log_review_audit();

-- Pre-aggregated average rating + count per product, approved-only, so the
-- storefront can show "★ 4.8 (12)" without an N+1 query per product/card.
CREATE VIEW public.review_summaries AS
SELECT
  multitrack_id,
  bundle_id,
  COUNT(*) AS review_count,
  ROUND(AVG(rating)::numeric, 1) AS average_rating
FROM public.reviews
WHERE is_approved = true
GROUP BY multitrack_id, bundle_id;

GRANT SELECT ON public.review_summaries TO anon, authenticated;
