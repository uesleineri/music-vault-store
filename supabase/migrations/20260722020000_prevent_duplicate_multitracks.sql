-- Nothing stopped the same song from being cadastrada twice (same artist +
-- song name, sometimes even the same file/cover/price) - two fully separate
-- rows, both purchasable, splitting sales/reviews history between them.
--
-- Resolve whatever duplicates already exist first: for each
-- (artist, song) group of currently-active rows, keep the oldest one active
-- and deactivate the rest. Deactivating rather than deleting because a
-- duplicate may already have real sales attached (multitracks can't be
-- deleted once sold - see 20260719123908).
WITH ranked AS (
  SELECT id, row_number() OVER (
    PARTITION BY lower(btrim(artist_name)), lower(btrim(song_name))
    ORDER BY created_at ASC
  ) AS rn
  FROM public.multitracks
  WHERE is_active = true
)
UPDATE public.multitracks
SET is_active = false
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

-- Case/whitespace-insensitive: "Israel Salazar" / "israel salazar " count as
-- the same artist. Partial (WHERE is_active) so a deactivated old version of
-- a song doesn't block cataloguing it again later under a fresh row.
CREATE UNIQUE INDEX idx_multitracks_unique_active_artist_song
ON public.multitracks (lower(btrim(artist_name)), lower(btrim(song_name)))
WHERE is_active = true;
