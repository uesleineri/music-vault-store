-- Sales funnel: checkout iniciado -> PIX gerado -> pago -> download feito.
-- session_id correlates the first two steps (generated client-side before any
-- sales row exists); checkout_group_id correlates the last three once a sale
-- row is actually created.
CREATE TABLE public.funnel_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_type TEXT NOT NULL CHECK (event_type IN ('checkout_started', 'pix_generated', 'payment_confirmed', 'download_completed')),
  session_id UUID,
  checkout_group_id UUID,
  product_ref TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_funnel_events_created_at ON public.funnel_events(created_at);
CREATE INDEX idx_funnel_events_session_id ON public.funnel_events(session_id);
CREATE INDEX idx_funnel_events_checkout_group_id ON public.funnel_events(checkout_group_id);

ALTER TABLE public.funnel_events ENABLE ROW LEVEL SECURITY;

-- Same pattern as sales: any visitor's browser can log its own funnel step
-- (checkout_started/pix_generated happen anonymously, before login exists),
-- but only admins can read the aggregated data back.
CREATE POLICY "Anyone can insert funnel events" ON public.funnel_events FOR INSERT WITH CHECK (true);
CREATE POLICY "Admins can view funnel events" ON public.funnel_events FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid())
);
