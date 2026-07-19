import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Loader2, Trash2, Upload, XCircle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { uploadAudioToDrive, guessArtistAndSong } from '@/lib/driveUpload';

type RowStatus = 'pending' | 'uploading' | 'done' | 'error';

interface BulkRow {
  key: string;
  file: File;
  artist_name: string;
  song_name: string;
  price: string;
  status: RowStatus;
  progress: number;
  errorMessage?: string;
}

interface BulkImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function BulkImportDialog({ open, onOpenChange }: BulkImportDialogProps) {
  const [rows, setRows] = useState<BulkRow[]>([]);
  const [defaultPrice, setDefaultPrice] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handleFilesSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const newRows: BulkRow[] = files.map((file) => {
      const guessed = guessArtistAndSong(file.name);
      return {
        key: `${file.name}-${file.size}-${Math.random().toString(36).slice(2)}`,
        file,
        artist_name: guessed.artist_name,
        song_name: guessed.song_name,
        price: defaultPrice,
        status: 'pending',
        progress: 0,
      };
    });
    setRows((prev) => [...prev, ...newRows]);
    e.target.value = '';
  };

  const applyDefaultPriceToAll = () => {
    setRows((prev) => prev.map((row) => (row.status === 'pending' ? { ...row, price: defaultPrice } : row)));
  };

  const updateRow = (key: string, changes: Partial<BulkRow>) => {
    setRows((prev) => prev.map((row) => (row.key === key ? { ...row, ...changes } : row)));
  };

  const removeRow = (key: string) => {
    setRows((prev) => prev.filter((row) => row.key !== key));
  };

  const canStart =
    rows.length > 0 &&
    !isImporting &&
    rows.every((row) => row.artist_name.trim() && row.song_name.trim() && parseFloat(row.price) > 0);

  const handleStartImport = async () => {
    setIsImporting(true);

    // Sequential on purpose: keeps Drive API usage predictable and gives clear
    // per-item progress instead of racing many huge uploads at once.
    for (const row of rows) {
      if (row.status === 'done') continue;

      updateRow(row.key, { status: 'uploading', progress: 0, errorMessage: undefined });

      const { driveFileId, error: uploadError } = await uploadAudioToDrive(
        row.file,
        row.artist_name,
        row.song_name,
        (percent) => updateRow(row.key, { progress: percent })
      );

      if (uploadError || !driveFileId) {
        updateRow(row.key, { status: 'error', errorMessage: uploadError?.message || 'Falha no upload' });
        continue;
      }

      const { error: insertError } = await supabase.from('multitracks').insert({
        artist_name: row.artist_name,
        song_name: row.song_name,
        price: parseFloat(row.price),
        file_url: driveFileId,
        cover_url: null,
        preview_url: null,
        is_active: true,
      });

      if (insertError) {
        updateRow(row.key, { status: 'error', errorMessage: insertError.message });
        continue;
      }

      updateRow(row.key, { status: 'done', progress: 100 });
    }

    setIsImporting(false);
    queryClient.invalidateQueries({ queryKey: ['multitracks'] });

    const successCount = rows.filter((r) => r.status === 'done').length;
    toast({
      title: 'Importação em lote concluída',
      description: `${successCount} de ${rows.length} multitracks cadastradas. Edite depois para adicionar capa/preview.`,
    });
  };

  const handleClose = (nextOpen: boolean) => {
    if (isImporting) return; // don't let the dialog close mid-import
    if (!nextOpen) {
      setRows([]);
      setDefaultPrice('');
    }
    onOpenChange(nextOpen);
  };

  const statusIcon = (row: BulkRow) => {
    switch (row.status) {
      case 'uploading':
        return <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />;
      case 'done':
        return <CheckCircle2 className="h-4 w-4 text-success" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-destructive" />;
      default:
        return null;
    }
  };

  const doneCount = rows.filter((r) => r.status === 'done').length;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Importação em lote</DialogTitle>
          <DialogDescription>
            Selecione vários arquivos de uma vez. O artista e a música são sugeridos pelo nome do
            arquivo — revise antes de importar. Capa e preview podem ser adicionados depois, editando
            cada música individualmente.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 space-y-2">
              <Label htmlFor="bulk-files">Arquivos das multitracks</Label>
              <Input
                id="bulk-files"
                type="file"
                multiple
                accept="audio/*,.zip,.rar"
                onChange={handleFilesSelected}
                disabled={isImporting}
              />
            </div>
            <div className="space-y-2 sm:w-48">
              <Label htmlFor="default-price">Preço padrão (R$)</Label>
              <div className="flex gap-2">
                <Input
                  id="default-price"
                  type="number"
                  step="0.01"
                  min="0"
                  value={defaultPrice}
                  onChange={(e) => setDefaultPrice(e.target.value)}
                  disabled={isImporting}
                />
                <Button type="button" variant="outline" onClick={applyDefaultPriceToAll} disabled={isImporting}>
                  Aplicar a todos
                </Button>
              </div>
            </div>
          </div>

          {rows.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8"></TableHead>
                  <TableHead>Artista</TableHead>
                  <TableHead>Música</TableHead>
                  <TableHead className="w-32">Preço (R$)</TableHead>
                  <TableHead className="w-40">Status</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.key}>
                    <TableCell>{statusIcon(row)}</TableCell>
                    <TableCell>
                      <Input
                        value={row.artist_name}
                        onChange={(e) => updateRow(row.key, { artist_name: e.target.value })}
                        disabled={row.status !== 'pending'}
                        className="h-8"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        value={row.song_name}
                        onChange={(e) => updateRow(row.key, { song_name: e.target.value })}
                        disabled={row.status !== 'pending'}
                        className="h-8"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={row.price}
                        onChange={(e) => updateRow(row.key, { price: e.target.value })}
                        disabled={row.status !== 'pending'}
                        className="h-8"
                      />
                    </TableCell>
                    <TableCell>
                      {row.status === 'uploading' && <Progress value={row.progress} className="h-2" />}
                      {row.status === 'error' && (
                        <span className="text-xs text-destructive">{row.errorMessage}</span>
                      )}
                      {row.status === 'done' && <span className="text-xs text-success">Concluído</span>}
                    </TableCell>
                    <TableCell>
                      {row.status === 'pending' && (
                        <Button variant="ghost" size="icon" onClick={() => removeRow(row.key)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {isImporting && (
            <p className="text-sm text-muted-foreground">
              Importando... {doneCount} de {rows.length} concluídas. Não feche esta janela.
            </p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => handleClose(false)} disabled={isImporting}>
              {doneCount === rows.length && rows.length > 0 ? 'Fechar' : 'Cancelar'}
            </Button>
            <Button onClick={handleStartImport} disabled={!canStart} className="gap-2">
              {isImporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              Iniciar importação ({rows.length})
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
