import { useState } from 'react';
import { Plus, Pencil, Trash2, Music, Loader2, Search, Image, ChevronLeft, ChevronRight } from 'lucide-react';
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
import { Switch } from '@/components/ui/switch';
import { SearchBar } from '@/components/SearchBar';
import { useMultitracks, useCreateMultitrack, useUpdateMultitrack, useDeleteMultitrack } from '@/hooks/useMultitracks';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Multitrack } from '@/types/multitrack';
import { sanitizeFileName, uploadAudioToDrive, uploadToSupabaseStorage } from '@/lib/driveUpload';
import { BulkImportDialog } from '@/components/admin/BulkImportDialog';

const PAGE_SIZE = 10;
// Asaas rejects any PIX charge under R$5 outright - create-payment enforces
// this too, but blocking it here avoids a checkout ever failing on it.
const MIN_PRICE = 5;

export default function AdminMultitracks() {
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useMultitracks({ searchQuery, page, pageSize: PAGE_SIZE, includeInactive: true });
  const multitracks = data?.data;
  const createMultitrack = useCreateMultitrack();
  const updateMultitrack = useUpdateMultitrack();
  const deleteMultitrack = useDeleteMultitrack();
  const { toast } = useToast();

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    setPage(1);
  };

  const handleToggleActive = async (multitrack: Multitrack) => {
    try {
      await updateMultitrack.mutateAsync({ id: multitrack.id, is_active: !multitrack.is_active });
      toast({
        title: multitrack.is_active ? 'Multitrack despublicada' : 'Multitrack publicada',
        description: multitrack.is_active
          ? 'Ela não aparece mais na loja, mas continua cadastrada.'
          : 'Ela já está visível na loja novamente.',
      });
    } catch (error: any) {
      toast({ title: 'Erro ao atualizar status', description: error.message, variant: 'destructive' });
    }
  };

  const [isBulkImportOpen, setIsBulkImportOpen] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [currentUploadStep, setCurrentUploadStep] = useState('');
  const [isSearchingCover, setIsSearchingCover] = useState(false);
  const [editingMultitrack, setEditingMultitrack] = useState<Multitrack | null>(null);
  const [formData, setFormData] = useState({
    artist_name: '',
    song_name: '',
    price: '',
  });
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreviewUrl, setCoverPreviewUrl] = useState<string | null>(null);
  const [coverOptions, setCoverOptions] = useState<Array<{
    cover_url: string;
    title: string;
    artist: string;
    album: string;
    source: string;
  }>>([]);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [previewFile, setPreviewFile] = useState<File | null>(null);

  const resetForm = () => {
    setFormData({ artist_name: '', song_name: '', price: '' });
    setCoverFile(null);
    setCoverPreviewUrl(null);
    setCoverOptions([]);
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
    setCoverOptions([]);
    try {
      const { data, error } = await supabase.functions.invoke('search-cover', {
        body: {
          artist: formData.artist_name,
          song: formData.song_name,
        },
      });

      if (error) throw error;

      if (data.success && data.covers && data.covers.length > 0) {
        setCoverOptions(data.covers);
        toast({
          title: `${data.covers.length} capas encontradas!`,
          description: 'Selecione a capa desejada abaixo.',
        });
      } else {
        throw new Error('Nenhuma capa encontrada');
      }
    } catch (error: any) {
      console.error('Cover search error:', error);
      toast({
        title: 'Capa não encontrada',
        description: 'Tente buscar manualmente ou faça upload de uma imagem.',
        variant: 'destructive',
      });
    } finally {
      setIsSearchingCover(false);
    }
  };

  const selectCover = (coverUrl: string) => {
    setCoverPreviewUrl(coverUrl);
    setCoverOptions([]);
    toast({
      title: 'Capa selecionada!',
    });
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

    if (parseFloat(formData.price) < MIN_PRICE) {
      toast({
        title: 'Preço muito baixo',
        description: `O preço mínimo é R$ ${MIN_PRICE.toFixed(2).replace('.', ',')} - é o valor mínimo aceito pela Asaas para pagamento via PIX.`,
        variant: 'destructive',
      });
      return;
    }

    setIsUploading(true);

    try {
      let fileUrl = editingMultitrack?.file_url || '';
      let coverUrl = editingMultitrack?.cover_url || null;
      let previewUrl = editingMultitrack?.preview_url || null;

      // Calculate total files to upload for progress tracking
      const filesToUpload = [audioFile, coverFile, previewFile].filter(Boolean);
      const totalFiles = filesToUpload.length;
      let completedFiles = 0;

      const updateOverallProgress = (fileProgress: number) => {
        const baseProgress = (completedFiles / Math.max(totalFiles, 1)) * 100;
        const currentFileContribution = (fileProgress / Math.max(totalFiles, 1));
        setUploadProgress(Math.round(baseProgress + currentFileContribution));
      };

      // Upload audio file if provided (goes to Google Drive, not Supabase Storage)
      if (audioFile) {
        setCurrentUploadStep('Enviando arquivo multitrack para o Google Drive...');
        console.log('Starting Drive upload for:', audioFile.name);

        const { driveFileId, error: audioError } = await uploadAudioToDrive(
          audioFile,
          formData.artist_name,
          formData.song_name,
          updateOverallProgress
        );

        if (audioError || !driveFileId) {
          console.error('Audio upload error:', audioError);
          throw new Error(`Erro no upload: ${audioError?.message || 'ID do arquivo não retornado'}`);
        }
        fileUrl = driveFileId;
        completedFiles++;
        updateOverallProgress(0);
      }

      // Upload cover file if provided
      if (coverFile) {
        setCurrentUploadStep('Enviando capa...');
        console.log('Uploading cover:', coverFile.name);
        const coverFileName = `${Date.now()}-${sanitizeFileName(coverFile.name)}`;
        
        const { error: coverError } = await uploadToSupabaseStorage(
          'covers',
          coverFileName,
          coverFile,
          updateOverallProgress
        );
        
        if (coverError) {
          console.error('Cover upload error:', coverError);
          throw new Error(`Erro no upload da capa: ${coverError.message}`);
        }

        const { data: { publicUrl } } = supabase.storage
          .from('covers')
          .getPublicUrl(coverFileName);
        coverUrl = publicUrl;
        completedFiles++;
        updateOverallProgress(0);
      } else if (coverPreviewUrl && coverPreviewUrl !== editingMultitrack?.cover_url) {
        // Use the URL from Deezer search
        coverUrl = coverPreviewUrl;
      }

      // Upload preview file if provided
      if (previewFile) {
        setCurrentUploadStep('Enviando preview de áudio...');
        console.log('Uploading preview:', previewFile.name);
        const previewFileName = `${Date.now()}-${sanitizeFileName(previewFile.name)}`;
        
        const { error: previewError } = await uploadToSupabaseStorage(
          'previews',
          previewFileName,
          previewFile,
          updateOverallProgress
        );
        
        if (previewError) {
          console.error('Preview upload error:', previewError);
          throw new Error(`Erro no upload do preview: ${previewError.message}`);
        }

        const { data: { publicUrl: previewPublicUrl } } = supabase.storage
          .from('previews')
          .getPublicUrl(previewFileName);
        previewUrl = previewPublicUrl;
        completedFiles++;
      }

      setCurrentUploadStep('Salvando dados...');
      setUploadProgress(100);

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
          is_active: true,
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
      setUploadProgress(0);
      setCurrentUploadStep('');
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
      // Postgres foreign key violation: this multitrack already has sales
      // history, which the DB now refuses to delete (see migration
      // 20260719123908 - it used to silently cascade-delete that history).
      const isFkViolation = error?.code === '23503';
      toast({
        title: 'Erro ao remover',
        description: isFkViolation
          ? 'Esta multitrack já tem vendas registradas e não pode ser excluída, para não perder o histórico. Use o botão de despublicar em vez de excluir.'
          : error.message || 'Tente novamente.',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">Multitracks</h2>
          <p className="text-muted-foreground">
            {data?.totalCount ?? 0} multitrack{data?.totalCount === 1 ? '' : 's'} no catálogo (incluindo despublicadas)
          </p>
        </div>
        <div className="flex items-center gap-3">
          <SearchBar onSearch={handleSearch} className="w-full md:w-72" placeholder="Buscar por artista ou música..." />
        <Button variant="outline" className="gap-2" onClick={() => setIsBulkImportOpen(true)}>
          <Plus className="h-4 w-4" />
          Importar em lote
        </Button>
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
                  min={MIN_PRICE}
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Mínimo de R$ {MIN_PRICE.toFixed(2).replace('.', ',')} - é o valor mínimo aceito pela Asaas para pagamento via PIX.
                </p>
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
                
                {/* Cover Options Grid */}
                {coverOptions.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">Selecione uma capa:</p>
                    <div className="grid grid-cols-4 gap-2 max-h-64 overflow-y-auto p-1">
                      {coverOptions.map((option, index) => (
                        <button
                          key={index}
                          type="button"
                          onClick={() => selectCover(option.cover_url)}
                          className="group relative aspect-square rounded-lg overflow-hidden border-2 border-transparent hover:border-primary transition-all focus:outline-none focus:ring-2 focus:ring-primary"
                          title={`${option.title} - ${option.album}`}
                        >
                          <img
                            src={option.cover_url}
                            alt={option.album}
                            className="h-full w-full object-cover"
                          />
                          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-1">
                            <p className="text-white text-[10px] leading-tight line-clamp-2 font-medium">{option.title}</p>
                            <p className="text-white/70 text-[9px] line-clamp-1">{option.album}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

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
                      setCoverOptions([]);
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
              {/* Upload Progress */}
              {isUploading && (
                <div className="space-y-2 p-3 bg-muted/50 rounded-lg border">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{currentUploadStep}</span>
                    <span className="font-medium">{uploadProgress}%</span>
                  </div>
                  <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-primary transition-all duration-300 ease-out"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)} disabled={isUploading}>
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
                  <TableHead>Publicada</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {multitracks.map((multitrack) => (
                  <TableRow key={multitrack.id} className={multitrack.is_active ? undefined : 'opacity-60'}>
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
                    <TableCell>
                      <Switch
                        checked={multitrack.is_active}
                        onCheckedChange={() => handleToggleActive(multitrack)}
                        disabled={updateMultitrack.isPending && updateMultitrack.variables?.id === multitrack.id}
                        aria-label={multitrack.is_active ? 'Despublicar' : 'Publicar'}
                      />
                    </TableCell>
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
                                Esta ação não pode ser desfeita. Se esta multitrack já tiver vendas registradas,
                                a exclusão será bloqueada — use "Despublicar" nesse caso.
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
              <h3 className="font-semibold mb-1">
                {searchQuery ? 'Nenhum resultado encontrado' : 'Nenhuma multitrack'}
              </h3>
              <p className="text-muted-foreground mb-4">
                {searchQuery
                  ? 'Tente buscar por outro artista ou música.'
                  : 'Adicione sua primeira multitrack para começar.'}
              </p>
              {!searchQuery && (
                <Button onClick={() => setIsDialogOpen(true)} className="gap-2">
                  <Plus className="h-4 w-4" />
                  Nova Multitrack
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {data && data.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Página {data.currentPage} de {data.totalPages} ({data.totalCount} no total)
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="gap-1"
            >
              <ChevronLeft className="h-4 w-4" />
              Anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
              disabled={page === data.totalPages}
              className="gap-1"
            >
              Próxima
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      <BulkImportDialog open={isBulkImportOpen} onOpenChange={setIsBulkImportOpen} />
    </div>
  );
}
