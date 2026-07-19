import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Sale } from '@/types/multitrack';

// A cart checkout inserts one `sales` row per item, all sharing one
// checkout_group_id - "how many orders" is the count of distinct groups,
// not the row count (revenue/fee sums stay correct either way since those
// add up per-row regardless of grouping).
export function countOrders(rows: { checkout_group_id: string }[]): number {
  return new Set(rows.map((row) => row.checkout_group_id)).size;
}

export function useSales() {
  return useQuery({
    queryKey: ['sales'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sales')
        .select(`
          *,
          multitrack:multitracks(*),
          bundle:bundles(*)
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
        .select('amount, payment_status, checkout_group_id');

      if (error) throw error;

      const paid = sales.filter((s) => s.payment_status === 'paid');
      const totalRevenue = paid.reduce((sum, sale) => sum + Number(sale.amount), 0);
      const totalSales = countOrders(paid);
      const totalAttempts = countOrders(sales);

      return {
        totalRevenue,
        totalSales,
        averageTicket: totalSales > 0 ? totalRevenue / totalSales : 0,
        // Of everyone who started a checkout (any status), how many actually paid.
        conversionRate: totalAttempts > 0 ? (totalSales / totalAttempts) * 100 : 0,
      };
    },
  });
}

// Multitracks that have never had a paid sale - useful to spot dead stock.
export function useStagnantProducts() {
  return useQuery({
    queryKey: ['stagnant-products'],
    queryFn: async () => {
      const [{ data: multitracks, error: mtError }, { data: paidSales, error: salesError }] = await Promise.all([
        supabase.from('multitracks').select('id, artist_name, song_name, cover_url, price, is_active'),
        supabase.from('sales').select('multitrack_id').eq('payment_status', 'paid'),
      ]);

      if (mtError) throw mtError;
      if (salesError) throw salesError;

      const soldIds = new Set(paidSales.map((s) => s.multitrack_id));
      return multitracks.filter((mt) => !soldIds.has(mt.id));
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
