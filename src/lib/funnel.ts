import { supabase } from '@/integrations/supabase/client';

const SESSION_KEY = 'gospel-vs-checkout-session';

// Correlates "checkout_started" and "pix_generated" for the same visit,
// before any sales row (and its checkout_group_id) exists yet. One id per
// browser tab session - a fresh visit gets a fresh funnel session.
export function getCheckoutSessionId(): string {
  let id = sessionStorage.getItem(SESSION_KEY);
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

export type FunnelEventType = 'checkout_started' | 'pix_generated';

// Fire-and-forget by design - a funnel metric should never block or break
// the checkout flow it's measuring.
export function logFunnelEvent(
  eventType: FunnelEventType,
  fields: { checkoutGroupId?: string; productRef?: string } = {}
) {
  supabase
    .from('funnel_events')
    .insert({
      event_type: eventType,
      session_id: getCheckoutSessionId(),
      checkout_group_id: fields.checkoutGroupId ?? null,
      product_ref: fields.productRef ?? null,
    })
    .then(({ error }) => {
      if (error) console.error('Failed to log funnel event:', error);
    });
}
