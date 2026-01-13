import { useState } from 'react';
import { Plus, Pencil, Trash2, Music, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useMultitracks, useCreateMultitrack, useDeleteMultitrack } from '@/hooks/useMultitracks';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

export default function AdminMultitracks() {
  const { data: multitracks, isLoading } = useMultitracks();
  const createMultitrack = useCreateMultitrack();
  const deleteMultitrack = useDeleteMultitrack();
  const { toast } = useToast();
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [formData, setFormData] = useState({
    artist_name: '',
    song_name: '',
    price: '',
  });
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [audioFile, setAudioFile] = useState<File | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!audioFile) {
      toast({
        title: 'Arquivo obrigatório',
        description: 'Selecione o arquivo da multitrack.',
        variant: 'destructive',
      });
      return;
    }

    setIsUploading(true);

    try {
      console.log('Starting upload for:', audioFile.name, 'Type:', audioFile.type, 'Size:', audioFile.size);
      
      // Upload audio file
      const audioFileName = `${Date.now()}-${audioFile.name}`;
      const { data: uploadData, error: audioError } = await supabase.storage
        .from('multitracks')
        .upload(audioFileName, audioFile);
      
      console.log('Upload result:', { uploadData, audioError });
      
      if (audioError) {
        console.error('Audio upload error:', audioError);
        throw new Error(`Erro no upload: ${audioError.message}`);
      }

      // Get file URL - for private bucket, we store the path
      const fileUrl = audioFileName;

      let coverUrl = null;
      if (coverFile) {
        console.log('Uploading cover:', coverFile.name);
        const coverFileName = `${Date.now()}-${coverFile.name}`;
        const { error: coverError } = await supabase.storage
          .from('covers')
          .upload(coverFileName, coverFile);
        
        if (coverError) {
          console.error('Cover upload error:', coverError);
          throw new Error(`Erro no upload da capa: ${coverError.message}`);
        }

        const { data: { publicUrl } } = supabase.storage
          .from('covers')
          .getPublicUrl(coverFileName);
        coverUrl = publicUrl;
      }

      console.log('Creating multitrack record...');
      
      // Create multitrack record
      const newMultitrack = await createMultitrack.mutateAsync({
        artist_name: formData.artist_name,
        song_name: formData.song_name,
        price: parseFloat(formData.price),
        file_url: fileUrl,
        cover_url: coverUrl,
        preview_url: null,
      });

      console.log('Multitrack created:', newMultitrack);

      // Generate preview automatically in background
      if (audioFile.type.startsWith('audio/')) {
        console.log('Triggering preview generation...');
        supabase.functions.invoke('generate-preview', {
          body: {
            multitrack_id: newMultitrack.id,
            file_path: audioFileName,
          },
        }).then((result) => {
          console.log('Preview generation result:', result);
          toast({
            title: 'Preview gerado!',
            description: 'O preview de áudio foi criado automaticamente.',
          });
        }).catch((err) => {
          console.error('Preview generation error:', err);
        });
      }

      toast({
        title: 'Multitrack adicionada!',
        description: 'A multitrack foi cadastrada com sucesso.',
      });

      setIsDialogOpen(false);
      setFormData({ artist_name: '', song_name: '', price: '' });
      setCoverFile(null);
      setAudioFile(null);
    } catch (error: any) {
      console.error('Full error:', error);
      toast({
        title: 'Erro ao adicionar',
        description: error.message || 'Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteMultitrack.mutateAsync(id);
      toast({
        title: 'Multitrack removida',
        description: 'A multitrack foi excluída com sucesso.',
      });
    } catch (error: any) {
      toast({
        title: 'Erro ao remover',
        description: error.message || 'Tente novamente.',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Multitracks</h2>
          <p className="text-muted-foreground">
            Gerencie seu catálogo de multitracks
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Nova Multitrack
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Adicionar Multitrack</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="artist">Artista</Label>
                  <Input
                    id="artist"
                    value={formData.artist_name}
                    onChange={(e) => setFormData({ ...formData, artist_name: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="song">Música</Label>
                  <Input
                    id="song"
                    value={formData.song_name}
                    onChange={(e) => setFormData({ ...formData, song_name: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="price">Preço (R$)</Label>
                <Input
                  id="price"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cover">Capa (imagem)</Label>
                <Input
                  id="cover"
                  type="file"
                  accept="image/*"
                  onChange={(e) => setCoverFile(e.target.files?.[0] || null)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="audio">Arquivo da Multitrack</Label>
                <Input
                  id="audio"
                  type="file"
                  accept="audio/*,.zip,.rar"
                  onChange={(e) => setAudioFile(e.target.files?.[0] || null)}
                  required
                />
                <p className="text-xs text-muted-foreground">
                  O preview será gerado automaticamente a partir deste arquivo.
                </p>
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={isUploading}>
                  {isUploading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Enviando...
                    </>
                  ) : (
                    'Adicionar'
                  )}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center">
              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">Carregando...</p>
            </div>
          ) : multitracks && multitracks.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16"></TableHead>
                  <TableHead>Música</TableHead>
                  <TableHead>Artista</TableHead>
                  <TableHead>Preço</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {multitracks.map((multitrack) => (
                  <TableRow key={multitrack.id}>
                    <TableCell>
                      <div className="h-10 w-10 rounded bg-muted flex items-center justify-center">
                        {multitrack.cover_url ? (
                          <img
                            src={multitrack.cover_url}
                            alt={multitrack.song_name}
                            className="h-full w-full object-cover rounded"
                          />
                        ) : (
                          <Music className="h-5 w-5 text-muted-foreground" />
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">{multitrack.song_name}</TableCell>
                    <TableCell>{multitrack.artist_name}</TableCell>
                    <TableCell>R$ {multitrack.price.toFixed(2).replace('.', ',')}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button variant="ghost" size="icon">
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Excluir multitrack?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Esta ação não pode ser desfeita. A multitrack será removida permanentemente.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDelete(multitrack.id)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Excluir
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="p-8 text-center">
              <Music className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <h3 className="font-semibold mb-1">Nenhuma multitrack</h3>
              <p className="text-muted-foreground mb-4">
                Adicione sua primeira multitrack para começar.
              </p>
              <Button onClick={() => setIsDialogOpen(true)} className="gap-2">
                <Plus className="h-4 w-4" />
                Nova Multitrack
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
