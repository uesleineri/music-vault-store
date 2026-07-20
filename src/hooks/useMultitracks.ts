import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Multitrack } from '@/types/multitrack';

interface MultitracksParams {
  searchQuery?: string;
  page?: number;
  pageSize?: number;
  sortBy?: 'created_at' | 'artist_name' | 'song_name' | 'price';
  sortOrder?: 'asc' | 'desc';
  // Admin views pass this to see unpublished multitracks too.
  includeInactive?: boolean;
  // Advanced search filters - all optional, undefined means "don't filter on this".
  genre?: string;
  language?: string;
  keySignature?: string;
  bpmMin?: number;
  bpmMax?: number;
}

export function useMultitracks(params: MultitracksParams = {}) {
  const {
    searchQuery,
    page = 1,
    pageSize = 12,
    sortBy = 'created_at',
    sortOrder = 'desc',
    includeInactive = false,
    genre,
    language,
    keySignature,
    bpmMin,
    bpmMax,
  } = params;

  return useQuery({
    queryKey: ['multitracks', searchQuery, page, pageSize, sortBy, sortOrder, includeInactive, genre, language, keySignature, bpmMin, bpmMax],
    queryFn: async () => {
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      let query = supabase
        .from('multitracks')
        .select('*', { count: 'exact' })
        .order(sortBy, { ascending: sortOrder === 'asc' })
        .range(from, to);

      if (!includeInactive) {
        query = query.eq('is_active', true);
      }

      if (searchQuery) {
        // PostgREST's .or() filter string treats ",", "(", ")" as syntax, and
        // "%"/"_" as ILIKE wildcards - strip them so a search term can't inject
        // extra filter clauses or unintended wildcard matches.
        const safeQuery = searchQuery.replace(/[,()%_]/g, ' ').trim();
        if (safeQuery) {
          query = query.or(`artist_name.ilike.%${safeQuery}%,song_name.ilike.%${safeQuery}%`);
        }
      }

      if (genre) query = query.eq('genre', genre);
      if (language) query = query.eq('language', language);
      if (keySignature) query = query.eq('key_signature', keySignature);
      if (bpmMin != null) query = query.gte('bpm', bpmMin);
      if (bpmMax != null) query = query.lte('bpm', bpmMax);

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

// Populates the advanced-search dropdowns with whatever values are actually
// in use in the published catalog, instead of a hardcoded list that drifts
// from reality as admins add new genres/languages/keys over time.
export function useMultitrackFilterOptions() {
  return useQuery({
    queryKey: ['multitrack-filter-options'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('multitracks')
        .select('genre, language, key_signature')
        .eq('is_active', true);
      if (error) throw error;

      const dedupe = (values: (string | null)[]) =>
        Array.from(new Set(values.filter((v): v is string => !!v))).sort();

      return {
        genres: dedupe(data.map((m) => m.genre)),
        languages: dedupe(data.map((m) => m.language)),
        keySignatures: dedupe(data.map((m) => m.key_signature)),
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
        .eq('is_active', true)
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

// "Você também pode gostar": blends frequently-bought-together (via a
// SECURITY DEFINER RPC, since `sales` itself is admin-only to read), same
// artist, and same genre, falling back to recently-added songs to always
// fill the slot. Priority order matches how strong each signal is.
export function useRecommendations(multitrackId: string, artistName?: string, genre?: string | null) {
  return useQuery({
    queryKey: ['recommendations', multitrackId, artistName, genre],
    queryFn: async () => {
      const results = new Map<string, Multitrack>();
      const LIMIT = 4;

      const { data: boughtWith } = await supabase.rpc('get_frequently_bought_with', {
        p_multitrack_id: multitrackId,
        p_limit: LIMIT,
      });
      const boughtWithIds = (boughtWith ?? []).map((row) => row.multitrack_id);
      if (boughtWithIds.length > 0) {
        const { data: rows } = await supabase
          .from('multitracks')
          .select('*')
          .in('id', boughtWithIds)
          .eq('is_active', true);
        (rows ?? []).forEach((m) => results.set(m.id, m as Multitrack));
      }

      if (results.size < LIMIT && artistName) {
        const { data: rows } = await supabase
          .from('multitracks')
          .select('*')
          .eq('artist_name', artistName)
          .eq('is_active', true)
          .neq('id', multitrackId)
          .limit(LIMIT);
        (rows ?? []).forEach((m) => { if (!results.has(m.id)) results.set(m.id, m as Multitrack); });
      }

      if (results.size < LIMIT && genre) {
        const { data: rows } = await supabase
          .from('multitracks')
          .select('*')
          .eq('genre', genre)
          .eq('is_active', true)
          .neq('id', multitrackId)
          .limit(LIMIT);
        (rows ?? []).forEach((m) => { if (!results.has(m.id)) results.set(m.id, m as Multitrack); });
      }

      if (results.size < LIMIT) {
        const { data: rows } = await supabase
          .from('multitracks')
          .select('*')
          .eq('is_active', true)
          .neq('id', multitrackId)
          .order('created_at', { ascending: false })
          .limit(LIMIT);
        (rows ?? []).forEach((m) => { if (!results.has(m.id)) results.set(m.id, m as Multitrack); });
      }

      return Array.from(results.values()).slice(0, LIMIT);
    },
    enabled: !!multitrackId,
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
