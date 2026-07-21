-- Lets a logged-in customer read their own sales (for "Minha Conta") without
-- widening admin-only access - this is an additional permissive SELECT
-- policy, OR'd with "Admins can view all sales", so admin access is
-- unaffected. Keyed off the JWT's email claim, not a subquery on auth.users.
CREATE POLICY "Customers can view own sales" ON public.sales FOR SELECT
USING (buyer_email = (auth.jwt() ->> 'email'));
