-- Advanced search metadata: tom (key), BPM, gênero/estilo, idioma - all
-- optional, so existing catalog rows are unaffected until an admin fills them in.
ALTER TABLE public.multitracks ADD COLUMN genre TEXT;
ALTER TABLE public.multitracks ADD COLUMN key_signature TEXT;
ALTER TABLE public.multitracks ADD COLUMN bpm INTEGER;
ALTER TABLE public.multitracks ADD COLUMN language TEXT;

CREATE INDEX idx_multitracks_genre ON public.multitracks(genre);
CREATE INDEX idx_multitracks_language ON public.multitracks(language);
CREATE INDEX idx_multitracks_key_signature ON public.multitracks(key_signature);
