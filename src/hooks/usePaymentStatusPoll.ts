import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type PaymentPollStatus = 'pending' | 'paid' | 'failed';

// Polls check-payment-status every few seconds while the customer is
// sitting on the PIX screen, so the page can react the moment the webhook
// (or a manual "Verificar status" by the admin) marks the group paid -
// nothing here previously moved the checkout past "Pagamento" even when the
// payment had already gone through.
export function usePaymentStatusPoll(checkoutGroupId: string | null, enabled: boolean) {
  const [status, setStatus] = useState<PaymentPollStatus>('pending');
  const [downloadToken, setDownloadToken] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || !checkoutGroupId) return;
    let cancelled = false;

    const check = async () => {
      const { data, error } = await supabase.functions.invoke('check-payment-status', {
        body: { checkout_group_id: checkoutGroupId },
      });
      if (cancelled || error || !data) return;
      setStatus(data.status);
      if (data.download_token) setDownloadToken(data.download_token);
    };

    check();
    const interval = setInterval(check, 5000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [checkoutGroupId, enabled]);

  return { status, downloadToken };
}
