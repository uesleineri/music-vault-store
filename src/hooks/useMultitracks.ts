import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Multitrack } from '@/types/multitrack';

interface MultitracksParams {
  searchQuery?: string;
  page?: number;
  pageSize?: number;
  sortBy?: 'created_at' | 'artist_name' | 'song_name' | 'price';
  sortOrder?: 'asc' | 'desc';
}

export function useMultitracks(params: MultitracksParams = {}) {
  const { 
    searchQuery, 
    page = 1, 
    pageSize = 12, 
    sortBy = 'created_at', 
    sortOrder = 'desc' 
  } = params;

  return useQuery({
    queryKey: ['multitracks', searchQuery, page, pageSize, sortBy, sortOrder],
    queryFn: async () => {
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      let query = supabase
        .from('multitracks')
        .select('*', { count: 'exact' })
        .order(sortBy, { ascending: sortOrder === 'asc' })
        .range(from, to);

      if (searchQuery) {
        query = query.or(`artist_name.ilike.%${searchQuery}%,song_name.ilike.%${searchQuery}%`);
      }

      const { data, error, count } = await query;
      if (error) throw error;
      
      return {
        data: data as Multitrack[],
        totalCount: count || 0,
        totalPages: Math.ceil((count || 0) / pageSize),
        currentPage: page,
      };
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
