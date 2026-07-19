import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Bundle, BundleItem } from '@/types/multitrack';

interface BundlesParams {
  includeInactive?: boolean;
}

export function useBundles(params: BundlesParams = {}) {
  const { includeInactive = false } = params;

  return useQuery({
    queryKey: ['bundles', includeInactive],
    queryFn: async () => {
      let query = supabase.from('bundles').select('*').order('created_at', { ascending: false });
      if (!includeInactive) {
        query = query.eq('is_active', true);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data as Bundle[];
    },
  });
}

export function useBundle(id: string) {
  return useQuery({
    queryKey: ['bundle', id],
    queryFn: async () => {
      const { data: bundle, error } = await supabase
        .from('bundles')
        .select('*')
        .eq('id', id)
        .eq('is_active', true)
        .maybeSingle();
      if (error) throw error;
      if (!bundle) return null;

      const { data: items, error: itemsError } = await supabase
        .from('bundle_items')
        .select('*, multitrack:multitracks(*)')
        .eq('bundle_id', id);
      if (itemsError) throw itemsError;

      return { ...(bundle as Bundle), items: items as BundleItem[] };
    },
    enabled: !!id,
  });
}

// Admin: bundle + its items in one call, including inactive songs, so the
// edit dialog can show everything that's already in the kit.
export function useAdminBundleItems(bundleId: string | null) {
  return useQuery({
    queryKey: ['bundle-items', bundleId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bundle_items')
        .select('*, multitrack:multitracks(*)')
        .eq('bundle_id', bundleId);
      if (error) throw error;
      return data as BundleItem[];
    },
    enabled: !!bundleId,
  });
}

export function useCreateBundle() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      multitrackIds,
      ...bundle
    }: Omit<Bundle, 'id' | 'created_at' | 'updated_at'> & { multitrackIds: string[] }) => {
      const { data: created, error } = await supabase.from('bundles').insert(bundle).select().single();
      if (error) throw error;

      if (multitrackIds.length > 0) {
        const { error: itemsError } = await supabase
          .from('bundle_items')
          .insert(multitrackIds.map((multitrack_id) => ({ bundle_id: created.id, multitrack_id })));
        if (itemsError) throw itemsError;
      }

      return created as Bundle;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bundles'] });
    },
  });
}

export function useUpdateBundle() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      multitrackIds,
      ...updates
    }: Partial<Bundle> & { id: string; multitrackIds?: string[] }) => {
      const { data, error } = await supabase.from('bundles').update(updates).eq('id', id).select().single();
      if (error) throw error;

      // Simplest correct way to sync the item set: replace it wholesale.
      if (multitrackIds) {
        const { error: deleteError } = await supabase.from('bundle_items').delete().eq('bundle_id', id);
        if (deleteError) throw deleteError;

        if (multitrackIds.length > 0) {
          const { error: insertError } = await supabase
            .from('bundle_items')
            .insert(multitrackIds.map((multitrack_id) => ({ bundle_id: id, multitrack_id })));
          if (insertError) throw insertError;
        }
      }

      return data as Bundle;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['bundles'] });
      queryClient.invalidateQueries({ queryKey: ['bundle-items', variables.id] });
    },
  });
}

export function useDeleteBundle() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('bundles').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bundles'] });
    },
  });
}
