-- One-off cleanup, not a schema change: the Mercado Pago migration (Asaas ->
-- Mercado Pago) was tested end-to-end against the real production gateway
-- today (Pix and card), including one genuinely-paid R$1 Pix charge used to
-- validate the webhook flow manually. Per the store owner, every sale here
-- is test data, same reasoning as the pre-launch cleanup in
-- 20260727120000_clear_test_purchase_data.sql. audit_logs is deliberately
-- NOT touched (kept as the dev history of everything configured so far).
-- The catalog (multitracks, bundles, coupons) is untouched.

DELETE FROM public.sales;
DELETE FROM public.funnel_events;
DELETE FROM public.admin_notifications;
DELETE FROM public.reviews;

-- Test coupon redemptions (if any) counted against real sales that no
-- longer exist - reset so usage limits reflect only real future purchases.
UPDATE public.coupons SET times_used = 0;
