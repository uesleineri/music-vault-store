import { supabase } from '@/integrations/supabase/client';

// The DB itself is the real guard (a partial unique index on
// lower(btrim(artist_name)), lower(btrim(song_name)) WHERE is_active - see
// migration 20260722020000) - this is just an early, friendlier warning
// before the admin wastes a multi-minute Drive upload on a song that's
// already catalogued.
export async function findDuplicateMultitrack(
  artistName: string,
  songName: string,
  excludeId?: string
): Promise<{ id: string } | null> {
  let query = supabase
    .from('multitracks')
    .select('id')
    .eq('is_active', true)
    .ilike('artist_name', artistName.trim())
    .ilike('song_name', songName.trim());
  if (excludeId) query = query.neq('id', excludeId);

  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  return data;
}

// True when a Supabase/Postgres error is the unique-index violation from
// that same migration - lets callers swap Postgres' raw constraint-name
// message for something a non-technical admin can act on.
export function isDuplicateMultitrackError(error: unknown): boolean {
  const pgError = error as { code?: string; message?: string } | null;
  return pgError?.code === '23505' && !!pgError.message?.includes('idx_multitracks_unique_active_artist_song');
}

export const DUPLICATE_MULTITRACK_MESSAGE =
  'Já existe uma multitrack publicada com esse artista e essa música. Edite a existente em vez de cadastrar de novo.';
