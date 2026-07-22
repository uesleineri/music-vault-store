import { useParams, Link } from 'react-router-dom';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ArrowLeft, Music, ShoppingCart, Plus, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { AudioPlayer } from '@/components/AudioPlayer';
import { MultitrackCard } from '@/components/MultitrackCard';
import { StarRating } from '@/components/StarRating';
import { useMultitrack, useRecommendations } from '@/hooks/useMultitracks';
import { useProductReviews, useReviewSummaries } from '@/hooks/useReviews';
import { useCart } from '@/contexts/CartContext';
import { useToast } from '@/hooks/use-toast';

export default function MultitrackDetails() {
  const { id } = useParams<{ id: string }>();
  const { data: multitrack, isLoading } = useMultitrack(id || '');
  const { data: recommendations } = useRecommendations(id || '', multitrack?.artist_name, multitrack?.genre);
  const { data: reviews } = useProductReviews({ multitrackId: id || '' });
  const { data: reviewSummaries } = useReviewSummaries();
  const { addItem } = useCart();
  const { toast } = useToast();

  const averageRating = reviews && reviews.length > 0
    ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
    : null;

  const handleAddToCart = () => {
    if (!multitrack) return;
    const added = addItem({
      type: 'multitrack',
      id: multitrack.id,
      name: multitrack.song_name,
      subtitle: multitrack.artist_name,
      price: multitrack.price,
      cover_url: multitrack.cover_url,
    });
    toast(
      added
        ? { title: 'Adicionado ao carrinho!' }
        : { title: 'Já está no carrinho', description: 'Essa multitrack já foi adicionada.' }
    );
  };

  if (isLoading) {
    return (
      <div className="container py-8">
        <div className="animate-pulse">
          <div className="h-8 bg-muted rounded w-32 mb-8" />
          <div className="grid md:grid-cols-2 gap-8">
            <div className="aspect-square bg-muted rounded-lg" />
            <div className="space-y-4">
              <div className="h-8 bg-muted rounded w-3/4" />
              <div className="h-6 bg-muted rounded w-1/2" />
              <div className="h-12 bg-muted rounded w-1/3" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!multitrack) {
    return (
      <div className="container py-8 text-center">
        <Music className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
        <h1 className="text-2xl font-bold mb-2">Multitrack não encontrada</h1>
        <p className="text-muted-foreground mb-6">
          A multitrack que você está procurando não existe ou foi removida.
        </p>
        <Link to="/catalog">
          <Button>Voltar ao catálogo</Button>
        </Link>
      </div>
    );
  }

  const techSpecs: { label: string; value: string | number }[] = [
    { label: 'Tom', value: multitrack.key_signature ?? '' },
    { label: 'BPM', value: multitrack.bpm ?? '' },
    { label: 'Compasso', value: multitrack.time_signature ?? '' },
    { label: 'Nº de faixas/stems', value: multitrack.stem_count ?? '' },
    { label: 'Formato', value: multitrack.file_format ?? '' },
    {
      label: 'Tamanho do arquivo',
      value: multitrack.file_size_bytes ? `~${Math.round(multitrack.file_size_bytes / (1024 * 1024))} MB` : '',
    },
    { label: 'Compatível com', value: multitrack.compatible_with ?? '' },
  ].filter((spec) => spec.value !== '');

  return (
    <div className="container py-8 animate-fade-in">
      <Link to="/catalog" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-8">
        <ArrowLeft className="h-4 w-4" />
        Voltar ao catálogo
      </Link>

      <div className="grid md:grid-cols-2 gap-8 lg:gap-12">
        {/* Cover */}
        <div className="aspect-square rounded-lg overflow-hidden bg-muted">
          {multitrack.cover_url ? (
            <img
              src={multitrack.cover_url}
              alt={`${multitrack.artist_name} - ${multitrack.song_name}`}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Music className="h-24 w-24 text-muted-foreground" />
            </div>
          )}
        </div>

        {/* Details */}
        <div className="flex flex-col">
          <h1 className="text-3xl md:text-4xl font-bold mb-2">{multitrack.song_name}</h1>
          <p className="text-xl text-muted-foreground mb-2">{multitrack.artist_name}</p>
          {averageRating !== null && (
            <div className="flex items-center gap-2 mb-6">
              <StarRating value={Math.round(averageRating)} size="sm" />
              <span className="text-sm text-muted-foreground">
                {averageRating.toFixed(1)} ({reviews!.length} avaliaç{reviews!.length === 1 ? 'ão' : 'ões'})
              </span>
            </div>
          )}
          {averageRating === null && <div className="mb-6" />}

          {/* Preview Player */}
          {multitrack.preview_url && (
            <Card className="mb-6">
              <CardContent className="p-0">
                <AudioPlayer src={multitrack.preview_url} />
              </CardContent>
            </Card>
          )}

          {techSpecs.length > 0 && (
            <Card className="mb-6 w-fit min-w-[220px] max-w-[260px]">
              <CardContent className="p-3">
                <div className="flex items-center gap-2 font-semibold mb-1.5 text-sm">
                  <FileText className="h-4 w-4" />
                  Ficha técnica
                </div>
                <dl className="text-sm divide-y divide-border/60">
                  {techSpecs.map((spec) => (
                    <div key={spec.label} className="flex items-center justify-between gap-9 py-1">
                      <dt className="text-muted-foreground">{spec.label}</dt>
                      <dd className="font-medium">{spec.value}</dd>
                    </div>
                  ))}
                </dl>
              </CardContent>
            </Card>
          )}

          <div className="mt-auto">
            <div className="text-3xl font-bold mb-4">
              R$ {multitrack.price.toFixed(2).replace('.', ',')}
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <Link to={`/checkout/${multitrack.id}`}>
                <Button size="lg" className="w-full sm:w-auto gap-2">
                  <ShoppingCart className="h-5 w-5" />
                  Comprar agora
                </Button>
              </Link>
              <Button size="lg" variant="outline" className="w-full sm:w-auto gap-2" onClick={handleAddToCart}>
                <Plus className="h-5 w-5" />
                Adicionar ao carrinho
              </Button>
            </div>
          </div>

          <p className="text-sm text-muted-foreground mt-6">
            Após a compra, você receberá o link de download por email e poderá baixar imediatamente.
          </p>
        </div>
      </div>

      {reviews && reviews.length > 0 && (
        <div className="mt-16">
          <h2 className="text-2xl font-bold mb-6">Avaliações</h2>
          <div className="space-y-4">
            {reviews.map((review) => (
              <Card key={review.id}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium">{review.reviewer_name}</span>
                    <StarRating value={review.rating} size="sm" />
                  </div>
                  <p className="text-xs text-muted-foreground mb-2">
                    {format(new Date(review.created_at), 'dd/MM/yyyy', { locale: ptBR })}
                  </p>
                  {review.comment && <p className="text-sm">{review.comment}</p>}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {recommendations && recommendations.length > 0 && (
        <div className="mt-16">
          <h2 className="text-2xl font-bold mb-6">Você também pode gostar</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {recommendations.map((rec) => (
              <MultitrackCard key={rec.id} multitrack={rec} reviewSummary={reviewSummaries?.get(rec.id)} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
