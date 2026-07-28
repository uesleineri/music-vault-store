-- Solicitação de música: um visitante pede uma faixa que ainda não está no
-- catálogo, direto pela home (artista/música obrigatórios, tom/versão
-- opcionais, nome/e-mail obrigatórios para o dono poder responder). Fica
-- visível só para o admin, numa aba própria dentro de Notificações.
CREATE TABLE public.music_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  artist_name TEXT NOT NULL,
  song_name TEXT NOT NULL,
  key_signature TEXT,
  version TEXT,
  requester_name TEXT NOT NULL,
  requester_email TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'done')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_music_requests_created_at ON public.music_requests (created_at DESC);
CREATE INDEX idx_music_requests_status ON public.music_requests (status) WHERE status = 'pending';

ALTER TABLE public.music_requests ENABLE ROW LEVEL SECURITY;

-- Qualquer visitante pode solicitar uma música - é um formulário público na
-- home, sem exigir login. Só o admin lê e atualiza (marcar como atendida).
CREATE POLICY "Anyone can request a song" ON public.music_requests FOR INSERT WITH CHECK (true);

CREATE POLICY "Admins can view music requests" ON public.music_requests FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid())
);

CREATE POLICY "Admins can update music requests" ON public.music_requests FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid())
);

CREATE POLICY "Admins can delete music requests" ON public.music_requests FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid())
);
