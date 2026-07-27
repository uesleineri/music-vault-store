-- One-off cleanup, not a schema change: the store is about to go live on a
-- real domain, and every sale/review/funnel-event/notification up to this
-- point was generated while testing this session's features (fake PIX
-- charges, duplicate-upload retries, etc.) - none of it is real customer
-- data. audit_logs is deliberately NOT touched here (kept as the dev
-- history of everything configured so far, per the store owner's choice).
-- The catalog (multitracks, bundles, coupons) is untouched.

DELETE FROM public.sales;
DELETE FROM public.funnel_events;
DELETE FROM public.admin_notifications;
DELETE FROM public.reviews;

-- Test coupon redemptions counted against real sales that no longer exist -
-- reset so usage limits reflect only real future purchases.
UPDATE public.coupons SET times_used = 0;
