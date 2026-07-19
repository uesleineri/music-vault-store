import { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, Package, Loader2, Music } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
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
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { useMultitracks } from '@/hooks/useMultitracks';
import {
  useBundles,
  useAdminBundleItems,
  useCreateBundle,
  useUpdateBundle,
  useDeleteBundle,
} from '@/hooks/useBundles';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { sanitizeFileName, uploadToSupabaseStorage } from '@/lib/driveUpload';
import { Bundle } from '@/types/multitrack';

export default function AdminBundles() {
  const { data: bundles, isLoading } = useBundles({ includeInactive: true });
  const { data: allMultitracks } = useMultitracks({ includeInactive: true, pageSize: 500 });
  const createBundle = useCreateBundle();
  const updateBundle = useUpdateBundle();
  const deleteBundle = useDeleteBundle();
  const { toast } = useToast();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editingBundle, setEditingBundle] = useState<Bundle | null>(null);
  const [formData, setFormData] = useState({ name: '', description: '', price: '' });
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreviewUrl, setCoverPreviewUrl] = useState<string | null>(null);
  const [selectedMultitrackIds, setSelectedMultitrackIds] = useState<string[]>([]);

  const { data: editingItems } = useAdminBundleItems(editingBundle?.id ?? null);

  useEffect(() => {
    if (editingBundle && editingItems) {
      setSelectedMultitrackIds(editingItems.map((item) => item.multitrack_id));
    }
  }, [editingBundle, editingItems]);

  const resetForm = () => {
    setFormData({ name: '', description: '', price: '' });
    setCoverFile(null);
    setCoverPreviewUrl(null);
    setSelectedMultitrackIds([]);
    setEditingBundle(null);
  };

  const openEditDialog = (bundle: Bundle) => {
    setEditingBundle(bundle);
    setFormData({
      name: bundle.name,
      description: bundle.description ?? '',
      price: bundle.price.toString(),
    });
    setCoverPreviewUrl(bundle.cover_url);
    setSelectedMultitrackIds([]);
    setIsDialogOpen(true);
  };

  const toggleMultitrack = (id: string) => {
    setSelectedMultitrackIds((prev) =>
      prev.includes(id) ? prev.filter((mtId) => mtId !== id) : [...prev, id]
    );
  };

  const handleToggleActive = async (bundle: Bundle) => {
    try {
      await updateBundle.mutateAsync({ id: bundle.id, is_active: !bundle.is_active });
      toast({
        title: bundle.is_active ? 'Kit despublicado' : 'Kit publicado',
        description: bundle.is_active
          ? 'Ele não aparece mais na loja, mas continua cadastrado.'
          : 'Ele já está visível na loja novamente.',
      });
    } catch (error: any) {
      toast({ title: 'Erro ao atualizar status', description: error.message, variant: 'destructive' });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (selectedMultitrackIds.length < 2) {
      toast({
        title: 'Selecione ao menos 2 músicas',
        description: 'Um kit precisa agrupar mais de uma multitrack.',
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);
    try {
      // coverPreviewUrl already reflects the admin's intent (existing cover,
      // a freshly chosen file's local preview, or null after clicking
      // "Remover") - use it as the base so clearing the cover actually saves.
      let coverUrl: string | null = coverPreviewUrl;

      if (coverFile) {
        const coverFileName = `bundle-${Date.now()}-${sanitizeFileName(coverFile.name)}`;
        const { error: coverError } = await uploadToSupabaseStorage('covers', coverFileName, coverFile, () => {});
        if (coverError) throw new Error(`Erro no upload da capa: ${coverError.message}`);
        const { data: { publicUrl } } = supabase.storage.from('covers').getPublicUrl(coverFileName);
        coverUrl = publicUrl;
      }

      if (editingBundle) {
        await updateBundle.mutateAsync({
          id: editingBundle.id,
          name: formData.name,
          description: formData.description || null,
          price: parseFloat(formData.price),
          cover_url: coverUrl,
          multitrackIds: selectedMultitrackIds,
        });
        toast({ title: 'Kit atualizado!' });
      } else {
        await createBundle.mutateAsync({
          name: formData.name,
          description: formData.description || null,
          price: parseFloat(formData.price),
          cover_url: coverUrl,
          is_active: true,
          multitrackIds: selectedMultitrackIds,
        });
        toast({ title: 'Kit criado!' });
      }

      setIsDialogOpen(false);
      resetForm();
    } catch (error: any) {
      toast({ title: 'Erro ao salvar', description: error.message || 'Tente novamente.', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteBundle.mutateAsync(id);
      toast({ title: 'Kit removido' });
    } catch (error: any) {
      const isFkViolation = error?.code === '23503';
      toast({
        title: 'Erro ao remover',
        description: isFkViolation
          ? 'Este kit já tem vendas registradas e não pode ser excluído. Use o botão de despublicar em vez de excluir.'
          : error.message || 'Tente novamente.',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">Kits promocionais</h2>
          <p className="text-muted-foreground">
            {bundles?.length ?? 0} kit{bundles?.length === 1 ? '' : 's'} cadastrado{bundles?.length === 1 ? '' : 's'}
          </p>
        </div>
        <Dialog
          open={isDialogOpen}
          onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) resetForm();
          }}
        >
          <DialogTrigger asChild>
            <Button className="gap-2" onClick={() => resetForm()}>
              <Plus className="h-4 w-4" />
              Novo Kit
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingBundle ? 'Editar Kit' : 'Novo Kit'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome do kit</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Descrição (opcional)</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="price">Preço fixo (R$)</Label>
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
                <Label>Capa</Label>
                {coverPreviewUrl && (
                  <div className="flex items-center gap-3 p-2 border rounded-lg bg-muted/50">
                    <img src={coverPreviewUrl} alt="Preview da capa" className="h-16 w-16 rounded object-cover" />
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
                )}
                <Input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0] || null;
                    setCoverFile(file);
                    if (file) setCoverPreviewUrl(URL.createObjectURL(file));
                  }}
                />
              </div>

              <div className="space-y-2">
                <Label>Músicas incluídas ({selectedMultitrackIds.length} selecionadas)</Label>
                <div className="max-h-56 overflow-y-auto border rounded-lg divide-y">
                  {allMultitracks?.data.map((mt) => (
                    <label key={mt.id} className="flex items-center gap-3 p-2 cursor-pointer hover:bg-muted/50">
                      <Checkbox
                        checked={selectedMultitrackIds.includes(mt.id)}
                        onCheckedChange={() => toggleMultitrack(mt.id)}
                      />
                      <Music className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <span className="text-sm truncate">
                        {mt.artist_name} - {mt.song_name}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)} disabled={isSaving}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={isSaving}>
                  {isSaving ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Salvando...
                    </>
                  ) : editingBundle ? (
                    'Salvar'
                  ) : (
                    'Criar'
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
          ) : bundles && bundles.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16"></TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Preço</TableHead>
                  <TableHead>Publicado</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bundles.map((bundle) => (
                  <TableRow key={bundle.id} className={bundle.is_active ? undefined : 'opacity-60'}>
                    <TableCell>
                      <div className="h-10 w-10 rounded bg-muted flex items-center justify-center">
                        {bundle.cover_url ? (
                          <img src={bundle.cover_url} alt={bundle.name} className="h-full w-full object-cover rounded" />
                        ) : (
                          <Package className="h-5 w-5 text-muted-foreground" />
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">{bundle.name}</TableCell>
                    <TableCell>R$ {bundle.price.toFixed(2).replace('.', ',')}</TableCell>
                    <TableCell>
                      <Switch
                        checked={bundle.is_active}
                        onCheckedChange={() => handleToggleActive(bundle)}
                        disabled={updateBundle.isPending && updateBundle.variables?.id === bundle.id}
                        aria-label={bundle.is_active ? 'Despublicar' : 'Publicar'}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button variant="ghost" size="icon" onClick={() => openEditDialog(bundle)}>
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
                              <AlertDialogTitle>Excluir kit?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Esta ação não pode ser desfeita. Se este kit já tiver vendas registradas, a exclusão
                                será bloqueada - use "Despublicar" nesse caso.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDelete(bundle.id)}
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
              <Package className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <h3 className="font-semibold mb-1">Nenhum kit</h3>
              <p className="text-muted-foreground mb-4">Crie seu primeiro kit promocional para começar.</p>
              <Button onClick={() => setIsDialogOpen(true)} className="gap-2">
                <Plus className="h-4 w-4" />
                Novo Kit
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
