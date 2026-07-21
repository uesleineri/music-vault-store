import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Review, ReviewSummary } from '@/types/multitrack';

type ProductRef = { multitrackId: string } | { bundleId: string };

// Approved reviews for one product's detail page.
export function useProductReviews(ref: ProductRef) {
  const column = 'multitrackId' in ref ? 'multitrack_id' : 'bundle_id';
  const id = 'multitrackId' in ref ? ref.multitrackId : ref.bundleId;

  return useQuery({
    queryKey: ['reviews', column, id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('reviews')
        .select('*')
        .eq(column, id)
        .eq('is_approved', true)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as Review[];
    },
    enabled: !!id,
  });
}

// Every approved product's average rating + count in one query - avoids an
// N+1 lookup per card on the catalog/home.
export function useReviewSummaries() {
  return useQuery({
    queryKey: ['review-summaries'],
    queryFn: async () => {
      const { data, error } = await supabase.from('review_summaries').select('*');
      if (error) throw error;
      const byProductId = new Map<string, ReviewSummary>();
      for (const row of data as ReviewSummary[]) {
        const id = row.multitrack_id ?? row.bundle_id;
        if (id) byProductId.set(id, row);
      }
      return byProductId;
    },
  });
}

// A buyer's own review for one product, whatever its approval status - lets
// "Minha Conta" show "avaliação enviada" instead of the form again.
export function useMyReview(email: string | null | undefined, ref: ProductRef) {
  const column = 'multitrackId' in ref ? 'multitrack_id' : 'bundle_id';
  const id = 'multitrackId' in ref ? ref.multitrackId : ref.bundleId;

  return useQuery({
    queryKey: ['my-review', email, column, id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('reviews')
        .select('*')
        .eq('buyer_email', email)
        .eq(column, id)
        .maybeSingle();
      if (error) throw error;
      return data as Review | null;
    },
    enabled: !!email && !!id,
  });
}

export function useCreateReview() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (review: {
      buyer_email: string;
      reviewer_name: string;
      rating: number;
      comment: string | null;
      multitrack_id?: string | null;
      bundle_id?: string | null;
    }) => {
      const { data, error } = await supabase.from('reviews').insert(review).select().single();
      if (error) throw error;
      return data as Review;
    },
    onSuccess: (review) => {
      queryClient.invalidateQueries({ queryKey: ['my-review'] });
      queryClient.invalidateQueries({ queryKey: ['reviews', review.multitrack_id ? 'multitrack_id' : 'bundle_id'] });
    },
  });
}

// Lightweight count for the sidebar badge - doesn't need the full rows.
export function usePendingReviewsCount() {
  return useQuery({
    queryKey: ['pending-reviews-count'],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('reviews')
        .select('id', { count: 'exact', head: true })
        .eq('is_approved', false);
      if (error) throw error;
      return count ?? 0;
    },
  });
}

// Admin moderation queue: every review, newest first, regardless of status.
export function useAdminReviews() {
  return useQuery({
    queryKey: ['admin-reviews'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('reviews')
        .select('*, multitrack:multitracks(artist_name, song_name), bundle:bundles(name)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as Review[];
    },
  });
}

export function useSetReviewApproval() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, is_approved }: { id: string; is_approved: boolean }) => {
      const { error } = await supabase.from('reviews').update({ is_approved }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-reviews'] });
      queryClient.invalidateQueries({ queryKey: ['reviews'] });
      queryClient.invalidateQueries({ queryKey: ['review-summaries'] });
    },
  });
}

export function useDeleteReview() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('reviews').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-reviews'] });
      queryClient.invalidateQueries({ queryKey: ['reviews'] });
      queryClient.invalidateQueries({ queryKey: ['review-summaries'] });
    },
  });
}
