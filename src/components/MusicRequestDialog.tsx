import { useState } from 'react';
import { Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useCreateMusicRequest } from '@/hooks/useMusicRequests';

// Public "peça sua música" form on the home page - no login required. Falls
// into the admin's "Solicitações" tab (inside Notificações) for follow-up.
export function MusicRequestDialog() {
  const createRequest = useCreateMusicRequest();
  const { toast } = useToast();

  const [isOpen, setIsOpen] = useState(false);
  const [artistName, setArtistName] = useState('');
  const [songName, setSongName] = useState('');
  const [keySignature, setKeySignature] = useState('');
  const [version, setVersion] = useState('');
  const [requesterName, setRequesterName] = useState('');
  const [requesterEmail, setRequesterEmail] = useState('');

  const resetForm = () => {
    setArtistName('');
    setSongName('');
    setKeySignature('');
    setVersion('');
    setRequesterName('');
    setRequesterEmail('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createRequest.mutateAsync({
        artist_name: artistName.trim(),
        song_name: songName.trim(),
        key_signature: keySignature.trim() || null,
        version: version.trim() || null,
        requester_name: requesterName.trim(),
        requester_email: requesterEmail.trim(),
      });
      toast({ title: 'Solicitação enviada!', description: 'Assim que possível vamos avaliar o pedido.' });
      resetForm();
      setIsOpen(false);
    } catch (error: any) {
      toast({ title: 'Erro ao enviar solicitação', description: error.message, variant: 'destructive' });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="lg"
          className="gap-2 bg-transparent border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground"
        >
          <Search className="h-4 w-4" />
          Solicitar música
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Solicitar música</DialogTitle>
          <DialogDescription>
            Não encontrou a multitrack que precisa? Nos conte qual é e avaliamos incluir no catálogo.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="artist_name">Artista *</Label>
              <Input
                id="artist_name"
                value={artistName}
                onChange={(e) => setArtistName(e.target.value)}
                placeholder="Nome do artista"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="song_name">Música *</Label>
              <Input
                id="song_name"
                value={songName}
                onChange={(e) => setSongName(e.target.value)}
                placeholder="Nome da música"
                required
              />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="key_signature">Tom (opcional)</Label>
              <Input
                id="key_signature"
                value={keySignature}
                onChange={(e) => setKeySignature(e.target.value)}
                placeholder="Ex: G, A, D#m"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="version">Versão (opcional)</Label>
              <Input
                id="version"
                value={version}
                onChange={(e) => setVersion(e.target.value)}
                placeholder="Ex: ao vivo, playback"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="requester_name">Seu nome *</Label>
              <Input
                id="requester_name"
                value={requesterName}
                onChange={(e) => setRequesterName(e.target.value)}
                placeholder="Nome e sobrenome"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="requester_email">Seu e-mail *</Label>
              <Input
                id="requester_email"
                type="email"
                value={requesterEmail}
                onChange={(e) => setRequesterEmail(e.target.value)}
                placeholder="seu@email.com"
                required
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={createRequest.isPending}>
              {createRequest.isPending ? 'Enviando...' : 'Enviar solicitação'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
