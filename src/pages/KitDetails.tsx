import { useParams, Link } from 'react-router-dom';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ArrowLeft, Package, ShoppingCart, Music, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { StarRating } from '@/components/StarRating';
import { useBundle } from '@/hooks/useBundles';
import { useProductReviews } from '@/hooks/useReviews';
import { useCart } from '@/contexts/CartContext';
import { useToast } from '@/hooks/use-toast';

export default function KitDetails() {
  const { id } = useParams<{ id: string }>();
  const { data: bundle, isLoading } = useBundle(id || '');
  const { data: reviews } = useProductReviews({ bundleId: id || '' });
  const { addItem } = useCart();
  const { toast } = useToast();

  const averageRating = reviews && reviews.length > 0
    ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
    : null;

  const handleAddToCart = () => {
    if (!bundle) return;
    const added = addItem({
      type: 'bundle',
      id: bundle.id,
      name: bundle.name,
      subtitle: `${bundle.items.length} músicas`,
      price: bundle.price,
      cover_url: bundle.cover_url,
    });
    toast(
      added
        ? { title: 'Adicionado ao carrinho!' }
        : { title: 'Já está no carrinho', description: 'Esse kit já foi adicionado.' }
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

  if (!bundle) {
    return (
      <div className="container py-8 text-center">
        <Package className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
        <h1 className="text-2xl font-bold mb-2">Kit não encontrado</h1>
        <p className="text-muted-foreground mb-6">
          O kit que você está procurando não existe ou foi removido.
        </p>
        <Link to="/kits">
          <Button>Voltar aos kits</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="container py-8 animate-fade-in">
      <Link to="/kits" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-8">
        <ArrowLeft className="h-4 w-4" />
        Voltar aos kits
      </Link>

      <div className="grid md:grid-cols-2 gap-8 lg:gap-12">
        <div className="aspect-square rounded-lg overflow-hidden bg-muted">
          {bundle.cover_url ? (
            <img src={bundle.cover_url} alt={bundle.name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Package className="h-24 w-24 text-muted-foreground" />
            </div>
          )}
        </div>

        <div className="flex flex-col">
          <h1 className="text-3xl md:text-4xl font-bold mb-2">{bundle.name}</h1>
          {bundle.description && (
            <p className="text-muted-foreground mb-2">{bundle.description}</p>
          )}
          {averageRating !== null && (
            <div className="flex items-center gap-2 mb-6">
              <StarRating value={Math.round(averageRating)} size="sm" />
              <span className="text-sm text-muted-foreground">
                {averageRating.toFixed(1)} ({reviews!.length} avaliaç{reviews!.length === 1 ? 'ão' : 'ões'})
              </span>
            </div>
          )}
          {averageRating === null && <div className="mb-6" />}

          <Card className="mb-6">
            <CardContent className="p-4">
              <h3 className="font-semibold mb-3">{bundle.items.length} músicas incluídas</h3>
              <ul className="space-y-2">
                {bundle.items.map((item) => (
                  <li key={item.id} className="flex items-center gap-2 text-sm">
                    <Music className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <span className="truncate">
                      {item.multitrack?.artist_name} - {item.multitrack?.song_name}
                    </span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <div className="mt-auto">
            <div className="text-3xl font-bold mb-4">
              R$ {bundle.price.toFixed(2).replace('.', ',')}
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <Link to={`/checkout/kit/${bundle.id}`}>
                <Button size="lg" className="w-full sm:w-auto gap-2">
                  <ShoppingCart className="h-5 w-5" />
                  Comprar kit
                </Button>
              </Link>
              <Button size="lg" variant="outline" className="w-full sm:w-auto gap-2" onClick={handleAddToCart}>
                <Plus className="h-5 w-5" />
                Adicionar ao carrinho
              </Button>
            </div>
          </div>

          <p className="text-sm text-muted-foreground mt-6">
            Após a compra, você receberá o link de download de todas as músicas do kit por email.
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
    </div>
  );
}
