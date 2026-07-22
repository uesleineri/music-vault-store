-- "Ficha técnica" shown on the product page: some fields the admin already
-- has to know at cataloguing time (time signature, format, compatible
-- software, stem count), and one derived automatically from the real
-- uploaded file instead of typed by hand (file_size_bytes), so it can never
-- go stale relative to what's actually in Drive.
ALTER TABLE public.multitracks
  ADD COLUMN time_signature TEXT,
  ADD COLUMN file_format TEXT,
  ADD COLUMN compatible_with TEXT,
  ADD COLUMN stem_count SMALLINT,
  ADD COLUMN file_size_bytes BIGINT;
