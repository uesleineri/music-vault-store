import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Multitrack } from '@/types/multitrack';

export function useMultitracks(searchQuery?: string) {
  return useQuery({
    queryKey: ['multitracks', searchQuery],
    queryFn: async () => {
      let query = supabase
        .from('multitracks')
        .select('*')
        .order('created_at', { ascending: false });

      if (searchQuery) {
        query = query.or(`artist_name.ilike.%${searchQuery}%,song_name.ilike.%${searchQuery}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Multitrack[];
    },
  });
}

export function useMultitrack(id: string) {
  return useQuery({
    queryKey: ['multitrack', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('multitracks')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      
      if (error) throw error;
      return data as Multitrack | null;
    },
    enabled: !!id,
  });
}

export function useCreateMultitrack() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (multitrack: Omit<Multitrack, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase
        .from('multitracks')
        .insert(multitrack)
        .select()
        .single();
      
      if (error) throw error;
      return data as Multitrack;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['multitracks'] });
    },
  });
}

export function useUpdateMultitrack() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Multitrack> & { id: string }) => {
      const { data, error } = await supabase
        .from('multitracks')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data as Multitrack;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['multitracks'] });
    },
  });
}

export function useDeleteMultitrack() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('multitracks')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['multitracks'] });
    },
  });
}
