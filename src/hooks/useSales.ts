import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Sale } from '@/types/multitrack';

export function useSales() {
  return useQuery({
    queryKey: ['sales'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sales')
        .select(`
          *,
          multitrack:multitracks(*)
        `)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as Sale[];
    },
  });
}

export function useSalesStats() {
  return useQuery({
    queryKey: ['sales-stats'],
    queryFn: async () => {
      const { data: sales, error } = await supabase
        .from('sales')
        .select('amount, payment_status')
        .eq('payment_status', 'paid');
      
      if (error) throw error;

      const totalRevenue = sales.reduce((sum, sale) => sum + Number(sale.amount), 0);
      const totalSales = sales.length;

      return { totalRevenue, totalSales };
    },
  });
}

export function useTopSelling() {
  return useQuery({
    queryKey: ['top-selling'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sales')
        .select(`
          multitrack_id,
          multitrack:multitracks(id, artist_name, song_name, cover_url, price)
        `)
        .eq('payment_status', 'paid');
      
      if (error) throw error;

      // Count sales per multitrack
      const salesCount: Record<string, { count: number; multitrack: any }> = {};
      data.forEach((sale: any) => {
        if (sale.multitrack) {
          if (!salesCount[sale.multitrack_id]) {
            salesCount[sale.multitrack_id] = { count: 0, multitrack: sale.multitrack };
          }
          salesCount[sale.multitrack_id].count++;
        }
      });

      // Sort by count and return top 5
      return Object.values(salesCount)
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);
    },
  });
}
