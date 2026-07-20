import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface FunnelEvent {
  id: string;
  event_type: 'checkout_started' | 'pix_generated' | 'payment_confirmed' | 'download_completed';
  session_id: string | null;
  checkout_group_id: string | null;
  product_ref: string | null;
  created_at: string;
}

export function useFunnelEvents() {
  return useQuery({
    queryKey: ['funnel-events'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('funnel_events')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as FunnelEvent[];
    },
  });
}
