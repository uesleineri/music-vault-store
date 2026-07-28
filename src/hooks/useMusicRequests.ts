import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { MusicRequest } from '@/types/multitrack';

// Public form on the home page - anyone can submit, no auth required.
export function useCreateMusicRequest() {
  return useMutation({
    mutationFn: async (request: {
      artist_name: string;
      song_name: string;
      key_signature: string | null;
      version: string | null;
      requester_name: string;
      requester_email: string;
    }) => {
      const { data, error } = await supabase.from('music_requests').insert(request).select().single();
      if (error) throw error;
      return data as MusicRequest;
    },
  });
}

// Admin list: every request, newest first, regardless of status.
export function useMusicRequests() {
  return useQuery({
    queryKey: ['admin-music-requests'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('music_requests')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as MusicRequest[];
    },
  });
}

// Lightweight count for the sidebar badge - doesn't need the full rows.
export function usePendingMusicRequestsCount() {
  return useQuery({
    queryKey: ['pending-music-requests-count'],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('music_requests')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pending');
      if (error) throw error;
      return count ?? 0;
    },
  });
}

export function useSetMusicRequestStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: 'pending' | 'done' }) => {
      const { error } = await supabase.from('music_requests').update({ status }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-music-requests'] });
      queryClient.invalidateQueries({ queryKey: ['pending-music-requests-count'] });
    },
  });
}

export function useDeleteMusicRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('music_requests').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-music-requests'] });
      queryClient.invalidateQueries({ queryKey: ['pending-music-requests-count'] });
    },
  });
}
