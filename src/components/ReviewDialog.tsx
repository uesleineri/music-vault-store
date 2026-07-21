import { useState } from 'react';
import { Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { StarRating } from '@/components/StarRating';
import { useToast } from '@/hooks/use-toast';
import { useMyReview, useCreateReview } from '@/hooks/useReviews';

interface ReviewDialogProps {
  buyerEmail: string;
  productName: string;
  multitrackId?: string | null;
  bundleId?: string | null;
}

// Lets a buyer leave a rating + comment for something they've already
// bought (RLS enforces the "actually paid for this" part) - shown next to
// each purchase in "Minha Conta".
export function ReviewDialog({ buyerEmail, productName, multitrackId, bundleId }: ReviewDialogProps) {
  const ref = multitrackId ? { multitrackId } : { bundleId: bundleId! };
  const { data: existingReview, isLoading } = useMyReview(buyerEmail, ref);
  const createReview = useCreateReview();
  const { toast } = useToast();

  const [isOpen, setIsOpen] = useState(false);
  const [reviewerName, setReviewerName] = useState('');
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (rating === 0) {
      toast({ title: 'Escolha uma nota', description: 'Selecione de 1 a 5 estrelas.', variant: 'destructive' });
      return;
    }
    try {
      await createReview.mutateAsync({
        buyer_email: buyerEmail,
        reviewer_name: reviewerName.trim(),
        rating,
        comment: comment.trim() || null,
        multitrack_id: multitrackId ?? null,
        bundle_id: bundleId ?? null,
      });
      toast({ title: 'Avaliação enviada!', description: 'Ela aparece na loja depois de aprovada.' });
      setIsOpen(false);
    } catch (error: any) {
      toast({ title: 'Erro ao enviar avaliação', description: error.message, variant: 'destructive' });
    }
  };

  if (isLoading) return null;

  if (existingReview) {
    return (
      <div className="flex items-center gap-2">
        <StarRating value={existingReview.rating} size="sm" />
        <Badge variant={existingReview.is_approved ? 'default' : 'secondary'}>
          {existingReview.is_approved ? 'Publicada' : 'Aguardando aprovação'}
        </Badge>
      </div>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost" className="gap-1">
          <Star className="h-4 w-4" />
          Avaliar
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Avaliar {productName}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Sua nota</Label>
            <StarRating value={rating} onChange={setRating} size="lg" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="reviewer_name">Seu nome (aparece na avaliação)</Label>
            <Input
              id="reviewer_name"
              value={reviewerName}
              onChange={(e) => setReviewerName(e.target.value)}
              placeholder="Nome e sobrenome"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="comment">Comentário (opcional)</Label>
            <Textarea
              id="comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="O que você achou?"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={createReview.isPending}>
              {createReview.isPending ? 'Enviando...' : 'Enviar avaliação'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
