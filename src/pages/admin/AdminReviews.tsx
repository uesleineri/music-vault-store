import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Check, X, Trash2, Star, Loader2 } from 'lucide-react';
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
import { Badge } from '@/components/ui/badge';
import { StarRating } from '@/components/StarRating';
import { useToast } from '@/hooks/use-toast';
import { useAdminReviews, useSetReviewApproval, useDeleteReview } from '@/hooks/useReviews';

export default function AdminReviews() {
  const { data: reviews, isLoading } = useAdminReviews();
  const setApproval = useSetReviewApproval();
  const deleteReview = useDeleteReview();
  const { toast } = useToast();

  const pendingCount = reviews?.filter((r) => !r.is_approved).length ?? 0;

  const handleApprove = async (id: string) => {
    try {
      await setApproval.mutateAsync({ id, is_approved: true });
      toast({ title: 'Avaliação aprovada' });
    } catch (error: any) {
      toast({ title: 'Erro ao aprovar', description: error.message, variant: 'destructive' });
    }
  };

  const handleReject = async (id: string) => {
    try {
      await setApproval.mutateAsync({ id, is_approved: false });
      toast({ title: 'Avaliação despublicada' });
    } catch (error: any) {
      toast({ title: 'Erro ao despublicar', description: error.message, variant: 'destructive' });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteReview.mutateAsync(id);
      toast({ title: 'Avaliação removida' });
    } catch (error: any) {
      toast({ title: 'Erro ao remover', description: error.message, variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h2 className="text-2xl font-bold">Avaliações</h2>
        <p className="text-muted-foreground">
          {pendingCount > 0
            ? `${pendingCount} aguardando aprovação`
            : 'Nenhuma avaliação pendente'}
        </p>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center">
              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">Carregando...</p>
            </div>
          ) : reviews && reviews.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produto</TableHead>
                  <TableHead>Autor</TableHead>
                  <TableHead>Nota</TableHead>
                  <TableHead>Comentário</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reviews.map((review) => {
                  const productName = review.multitrack
                    ? `${review.multitrack.artist_name} - ${review.multitrack.song_name}`
                    : review.bundle?.name ?? 'N/A';
                  return (
                    <TableRow key={review.id}>
                      <TableCell className="max-w-[200px] truncate">{productName}</TableCell>
                      <TableCell>{review.reviewer_name}</TableCell>
                      <TableCell>
                        <StarRating value={review.rating} size="sm" />
                      </TableCell>
                      <TableCell className="max-w-[240px] truncate text-sm text-muted-foreground">
                        {review.comment || '-'}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {format(new Date(review.created_at), 'dd/MM/yyyy', { locale: ptBR })}
                      </TableCell>
                      <TableCell>
                        {review.is_approved ? (
                          <Badge>Publicada</Badge>
                        ) : (
                          <Badge variant="secondary">Pendente</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          {review.is_approved ? (
                            <Button variant="ghost" size="icon" onClick={() => handleReject(review.id)} title="Despublicar">
                              <X className="h-4 w-4" />
                            </Button>
                          ) : (
                            <Button variant="ghost" size="icon" onClick={() => handleApprove(review.id)} title="Aprovar">
                              <Check className="h-4 w-4" />
                            </Button>
                          )}
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Excluir avaliação?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Esta ação não pode ser desfeita. O comprador poderá enviar uma nova avaliação
                                  para o mesmo produto depois.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDelete(review.id)}
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
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <div className="p-8 text-center">
              <Star className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <h3 className="font-semibold mb-1">Nenhuma avaliação ainda</h3>
              <p className="text-muted-foreground">
                Assim que um comprador avaliar uma compra em "Minha Conta", ela aparece aqui.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
