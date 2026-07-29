import { useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckoutForm } from '@/components/checkout/CheckoutForm';
import { useBundle } from '@/hooks/useBundles';
import { logFunnelEvent } from '@/lib/funnel';

export default function KitCheckout() {
  const { id } = useParams<{ id: string }>();
  const { data: bundle, isLoading } = useBundle(id || '');

  useEffect(() => {
    if (bundle) logFunnelEvent('checkout_started', { productRef: bundle.id });
  }, [bundle?.id]);

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

  if (!bundle) {
    return (
      <div className="container py-8 text-center">
        <Package className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
        <h1 className="text-2xl font-bold mb-2">Kit não encontrado</h1>
        <Link to="/kits">
          <Button>Voltar aos kits</Button>
        </Link>
      </div>
    );
  }

  return (
    <CheckoutForm
      items={[{ bundle_id: bundle.id }]}
      funnelProductRef={bundle.id}
      basePrice={bundle.price}
      downloadEmailNote="O link de download de todas as músicas do kit será enviado para este email após a confirmação do pagamento."
      dadosBackLink={`/kit/${bundle.id}`}
      dadosBackLabel="Voltar"
      catalogBackLink="/kits"
      catalogBackLabel="Voltar aos kits"
      orderSummaryCard={
        <Card>
          <CardHeader>
            <CardTitle>Resumo do pedido</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <div className="h-20 w-20 rounded bg-muted flex items-center justify-center flex-shrink-0">
                {bundle.cover_url ? (
                  <img src={bundle.cover_url} alt={bundle.name} className="h-full w-full object-cover rounded" />
                ) : (
                  <Package className="h-10 w-10 text-muted-foreground" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold">{bundle.name}</h3>
                <p className="text-sm text-muted-foreground">{bundle.items.length} músicas</p>
              </div>
              <div className="text-xl font-bold">
                R$ {bundle.price.toFixed(2).replace('.', ',')}
              </div>
            </div>
          </CardContent>
        </Card>
      }
      compactSummary={(amount) => (
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="h-16 w-16 rounded bg-muted flex items-center justify-center flex-shrink-0">
              {bundle.cover_url ? (
                <img src={bundle.cover_url} alt={bundle.name} className="h-full w-full object-cover rounded" />
              ) : (
                <Package className="h-8 w-8 text-muted-foreground" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold truncate">{bundle.name}</h3>
              <p className="text-sm text-muted-foreground truncate">{bundle.items.length} músicas</p>
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
