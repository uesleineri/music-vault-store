-- "Anyone can insert sales" (WITH CHECK (true), from the original schema) let
-- any anon-key holder INSERT a sales row directly via the REST API -
-- including payment_status: 'paid' - and then hit get-download for a free
-- file, completely bypassing create-payment and Asaas. The frontend never
-- inserts into `sales` directly: the only real writer is create-payment,
-- which uses the service_role key and therefore bypasses RLS entirely, so
-- this policy served no legitimate purpose. Same pattern already used for
-- `coupons`: no public INSERT policy at all.
DROP POLICY IF EXISTS "Anyone can insert sales" ON public.sales;
