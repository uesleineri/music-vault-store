-- Persists what used to be session-only client state in useAdminNotifications
-- (lost on tab close, and never recorded at all while no admin tab was open).
-- Rows are written server-side by the Edge Functions that create/confirm a
-- checkout group (create-payment, asaas-webhook, verify-payment), one row per
-- group action - never client-side - so a notification exists even if no
-- admin was online to receive it live via Realtime.
CREATE TABLE public.admin_notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('new_sale', 'payment_confirmed')),
  message TEXT NOT NULL,
  checkout_group_id UUID,
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_admin_notifications_created_at ON public.admin_notifications(created_at DESC);

ALTER TABLE public.admin_notifications ENABLE ROW LEVEL SECURITY;

-- No INSERT policy: only Edge Functions (service_role, bypasses RLS) write
-- these - never a client directly.
CREATE POLICY "Admins can view notifications" ON public.admin_notifications FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid())
);
CREATE POLICY "Admins can mark notifications read" ON public.admin_notifications FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid())
);
