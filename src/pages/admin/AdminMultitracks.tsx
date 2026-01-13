import { useState } from 'react';
import { Plus, Pencil, Trash2, Music, Loader2, Search, Image } from 'lucide-react';
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
import { useMultitracks, useCreateMultitrack, useUpdateMultitrack, useDeleteMultitrack } from '@/hooks/useMultitracks';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Multitrack } from '@/types/multitrack';

export default function AdminMultitracks() {
  const { data: multitracks, isLoading } = useMultitracks();
  const createMultitrack = useCreateMultitrack();
  const updateMultitrack = useUpdateMultitrack();
  const deleteMultitrack = useDeleteMultitrack();
  const { toast } = useToast();
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isSearchingCover, setIsSearchingCover] = useState(false);
  const [editingMultitrack, setEditingMultitrack] = useState<Multitrack | null>(null);
  const [formData, setFormData] = useState({
    artist_name: '',
    song_name: '',
    price: '',
  });
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreviewUrl, setCoverPreviewUrl] = useState<string | null>(null);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [previewFile, setPreviewFile] = useState<File | null>(null);

  const resetForm = () => {
    setFormData({ artist_name: '', song_name: '', price: '' });
    setCoverFile(null);
    setCoverPreviewUrl(null);
    setAudioFile(null);
    setPreviewFile(null);
    setEditingMultitrack(null);
  };

  const openEditDialog = (multitrack: Multitrack) => {
    setEditingMultitrack(multitrack);
    setFormData({
      artist_name: multitrack.artist_name,
      song_name: multitrack.song_name,
      price: multitrack.price.toString(),
    });
    setCoverPreviewUrl(multitrack.cover_url);
    setIsDialogOpen(true);
  };

  const searchCoverArt = async () => {
    if (!formData.artist_name || !formData.song_name) {
      toast({
        title: 'Preencha os campos',
        description: 'Informe o artista e a música para buscar a capa.',
        variant: 'destructive',
      });
      return;
    }

    setIsSearchingCover(true);
    try {
      const query = `${formData.artist_name} ${formData.song_name}`;
      const response = await fetch(
        `https://api.deezer.com/search?q=${encodeURIComponent(query)}&limit=1`
      );
      const data = await response.json();
      
      if (data.data && data.data.length > 0) {
        const coverUrl = data.data[0].album?.cover_xl || data.data[0].album?.cover_big;
        if (coverUrl) {
          setCoverPreviewUrl(coverUrl);
          toast({
            title: 'Capa encontrada!',
            description: 'A imagem será usada como capa.',
          });
        } else {
          throw new Error('Capa não encontrada');
        }
      } else {
        throw new Error('Música não encontrada');
      }
    } catch (error: any) {
      toast({
        title: 'Capa não encontrada',
        description: 'Tente buscar manualmente ou faça upload de uma imagem.',
        variant: 'destructive',
      });
    } finally {
      setIsSearchingCover(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // For new multitracks, require audio file
    if (!editingMultitrack && !audioFile) {
      toast({
        title: 'Arquivo obrigatório',
        description: 'Selecione o arquivo da multitrack.',
        variant: 'destructive',
      });
      return;
    }

    setIsUploading(true);

    // Sanitize file name - remove special characters and spaces
    const sanitizeFileName = (name: string) => {
      return name
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // Remove accents
        .replace(/[^a-zA-Z0-9.-]/g, '_') // Replace special chars with underscore
        .replace(/_+/g, '_'); // Remove multiple underscores
    };

    try {
      let fileUrl = editingMultitrack?.file_url || '';
      let coverUrl = editingMultitrack?.cover_url || null;
      let previewUrl = editingMultitrack?.preview_url || null;

      // Upload audio file if provided
      if (audioFile) {
        console.log('Starting upload for:', audioFile.name);
        const audioFileName = `${Date.now()}-${sanitizeFileName(audioFile.name)}`;
        const { error: audioError } = await supabase.storage
          .from('multitracks')
          .upload(audioFileName, audioFile);
        
        if (audioError) {
          console.error('Audio upload error:', audioError);
          throw new Error(`Erro no upload: ${audioError.message}`);
        }
        fileUrl = audioFileName;
      }

      // Upload cover file if provided
      if (coverFile) {
        console.log('Uploading cover:', coverFile.name);
        const coverFileName = `${Date.now()}-${sanitizeFileName(coverFile.name)}`;
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
      } else if (coverPreviewUrl && coverPreviewUrl !== editingMultitrack?.cover_url) {
        // Use the URL from Deezer search
        coverUrl = coverPreviewUrl;
      }

      // Upload preview file if provided
      if (previewFile) {
        console.log('Uploading preview:', previewFile.name);
        const previewFileName = `${Date.now()}-${sanitizeFileName(previewFile.name)}`;
        const { error: previewError } = await supabase.storage
          .from('previews')
          .upload(previewFileName, previewFile);
        
        if (previewError) {
          console.error('Preview upload error:', previewError);
          throw new Error(`Erro no upload do preview: ${previewError.message}`);
        }

        const { data: { publicUrl: previewPublicUrl } } = supabase.storage
          .from('previews')
          .getPublicUrl(previewFileName);
        previewUrl = previewPublicUrl;
      }

      if (editingMultitrack) {
        // Update existing multitrack
        await updateMultitrack.mutateAsync({
          id: editingMultitrack.id,
          artist_name: formData.artist_name,
          song_name: formData.song_name,
          price: parseFloat(formData.price),
          file_url: fileUrl,
          cover_url: coverUrl,
          preview_url: previewUrl,
        });

        toast({
          title: 'Multitrack atualizada!',
          description: 'As alterações foram salvas com sucesso.',
        });
      } else {
        // Create new multitrack
        await createMultitrack.mutateAsync({
          artist_name: formData.artist_name,
          song_name: formData.song_name,
          price: parseFloat(formData.price),
          file_url: fileUrl,
          cover_url: coverUrl,
          preview_url: previewUrl,
        });

        toast({
          title: 'Multitrack adicionada!',
          description: 'A multitrack foi cadastrada com sucesso.',
        });
      }

      setIsDialogOpen(false);
      resetForm();
    } catch (error: any) {
      console.error('Full error:', error);
      toast({
        title: 'Erro ao salvar',
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
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button className="gap-2" onClick={() => resetForm()}>
              <Plus className="h-4 w-4" />
              Nova Multitrack
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingMultitrack ? 'Editar Multitrack' : 'Adicionar Multitrack'}</DialogTitle>
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
              
              {/* Cover Section */}
              <div className="space-y-2">
                <Label>Capa</Label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={searchCoverArt}
                    disabled={isSearchingCover}
                    className="gap-2"
                  >
                    {isSearchingCover ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Search className="h-4 w-4" />
                    )}
                    Buscar capa
                  </Button>
                </div>
                {coverPreviewUrl && (
                  <div className="flex items-center gap-3 p-2 border rounded-lg bg-muted/50">
                    <img
                      src={coverPreviewUrl}
                      alt="Preview da capa"
                      className="h-16 w-16 rounded object-cover"
                    />
                    <div className="flex-1">
                      <p className="text-sm font-medium">Capa selecionada</p>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setCoverPreviewUrl(null)}
                        className="h-auto p-0 text-xs text-muted-foreground hover:text-destructive"
                      >
                        Remover
                      </Button>
                    </div>
                  </div>
                )}
                <Input
                  id="cover"
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0] || null;
                    setCoverFile(file);
                    if (file) {
                      setCoverPreviewUrl(URL.createObjectURL(file));
                    }
                  }}
                />
                <p className="text-xs text-muted-foreground">
                  Ou faça upload de uma imagem manualmente
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="audio">Arquivo da Multitrack (ZIP/RAR)</Label>
                <Input
                  id="audio"
                  type="file"
                  accept="audio/*,.zip,.rar"
                  onChange={(e) => setAudioFile(e.target.files?.[0] || null)}
                  required={!editingMultitrack}
                />
                <p className="text-xs text-muted-foreground">
                  {editingMultitrack ? 'Deixe vazio para manter o arquivo atual' : 'Arquivo completo com todas as faixas (stems)'}
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="preview">Preview de áudio (MP3)</Label>
                <Input
                  id="preview"
                  type="file"
                  accept="audio/mpeg,audio/mp3,.mp3"
                  onChange={(e) => setPreviewFile(e.target.files?.[0] || null)}
                />
                <p className="text-xs text-muted-foreground">
                  {editingMultitrack?.preview_url 
                    ? 'Deixe vazio para manter o preview atual' 
                    : 'Arquivo MP3 curto (30-60 seg) para os clientes ouvirem'}
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
                  ) : editingMultitrack ? (
                    'Salvar'
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
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => openEditDialog(multitrack)}
                        >
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
