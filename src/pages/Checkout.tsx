import { useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Music } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckoutForm } from '@/components/checkout/CheckoutForm';
import { useMultitrack } from '@/hooks/useMultitracks';
import { logFunnelEvent } from '@/lib/funnel';

export default function Checkout() {
  const { id } = useParams<{ id: string }>();
  const { data: multitrack, isLoading } = useMultitrack(id || '');

  useEffect(() => {
    if (multitrack) logFunnelEvent('checkout_started', { productRef: multitrack.id });
  }, [multitrack?.id]);

  if (isLoading) {
    return (
      <div className="container py-8 max-w-2xl">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-32" />
          <div className="h-64 bg-muted rounded" />
        </div>
      </div>
    );
  }

  if (!multitrack) {
    return (
      <div className="container py-8 text-center">
        <Music className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
        <h1 className="text-2xl font-bold mb-2">Produto não encontrado</h1>
        <Link to="/catalog">
          <Button>Voltar ao catálogo</Button>
        </Link>
      </div>
    );
  }

  return (
    <CheckoutForm
      items={[{ multitrack_id: multitrack.id }]}
      funnelProductRef={multitrack.id}
      basePrice={multitrack.price}
      downloadEmailNote="O link de download será enviado para este email após a confirmação do pagamento."
      dadosBackLink={`/multitrack/${multitrack.id}`}
      dadosBackLabel="Voltar"
      catalogBackLink="/catalog"
      catalogBackLabel="Voltar ao catálogo"
      orderSummaryCard={
        <Card>
          <CardHeader>
            <CardTitle>Resumo do pedido</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <div className="h-20 w-20 rounded bg-muted flex items-center justify-center flex-shrink-0">
                {multitrack.cover_url ? (
                  <img src={multitrack.cover_url} alt={multitrack.song_name} className="h-full w-full object-cover rounded" />
                ) : (
                  <Music className="h-10 w-10 text-muted-foreground" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold">{multitrack.song_name}</h3>
                <p className="text-sm text-muted-foreground">{multitrack.artist_name}</p>
              </div>
              <div className="text-xl font-bold">
                R$ {multitrack.price.toFixed(2).replace('.', ',')}
              </div>
            </div>
          </CardContent>
        </Card>
      }
      compactSummary={(amount) => (
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="h-16 w-16 rounded bg-muted flex items-center justify-center flex-shrink-0">
              {multitrack.cover_url ? (
                <img src={multitrack.cover_url} alt={multitrack.song_name} className="h-full w-full object-cover rounded" />
              ) : (
                <Music className="h-8 w-8 text-muted-foreground" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold truncate">{multitrack.song_name}</h3>
              <p className="text-sm text-muted-foreground truncate">{multitrack.artist_name}</p>
            </div>
            <div className="text-lg font-bold text-primary">
              R$ {amount.toFixed(2).replace('.', ',')}
            </div>
          </CardContent>
        </Card>
      )}
    />
  );
}
