import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Music, Package, ShoppingCart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckoutForm } from '@/components/checkout/CheckoutForm';
import { useCart } from '@/contexts/CartContext';
import { logFunnelEvent } from '@/lib/funnel';

export default function CartCheckout() {
  const { items, totalPrice, clear } = useCart();
  // The order-placed callback clears the cart so a refresh/back doesn't
  // re-checkout the same items - but that would also make the "carrinho
  // vazio" guard below kick back in and unmount CheckoutForm (losing the
  // Pix/card result it's showing) if it only looked at items.length.
  const [orderPlaced, setOrderPlaced] = useState(false);

  // Fires once on mount, off the cart's contents at that moment - items may
  // get cleared later (on successful checkout), which shouldn't retroactively
  // un-fire this.
  useEffect(() => {
    if (items.length > 0) logFunnelEvent('checkout_started', { productRef: 'cart' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (items.length === 0 && !orderPlaced) {
    return (
      <div className="container py-8 text-center">
        <ShoppingCart className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
        <h1 className="text-2xl font-bold mb-2">Seu carrinho está vazio</h1>
        <Link to="/catalog">
          <Button>Voltar ao catálogo</Button>
        </Link>
      </div>
    );
  }

  const cartItemsPayload = items.map((item) =>
    item.type === 'multitrack' ? { multitrack_id: item.id } : { bundle_id: item.id }
  );

  return (
    <CheckoutForm
      items={cartItemsPayload}
      funnelProductRef="cart"
      basePrice={totalPrice}
      downloadEmailNote="O link de download de todos os itens do pedido será enviado para este email após a confirmação do pagamento."
      dadosBackLink="/cart"
      dadosBackLabel="Voltar ao carrinho"
      catalogBackLink="/catalog"
      catalogBackLabel="Voltar ao catálogo"
      // The order is placed - clear the cart now so a refresh/back doesn't re-checkout the same items.
      onOrderPlaced={() => {
        clear();
        setOrderPlaced(true);
      }}
      orderSummaryCard={
        <Card>
          <CardHeader>
            <CardTitle>Resumo do pedido</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {items.map((item) => (
              <div key={`${item.type}-${item.id}`} className="flex items-center gap-4">
                <div className="h-14 w-14 rounded bg-muted flex items-center justify-center flex-shrink-0">
                  {item.cover_url ? (
                    <img src={item.cover_url} alt={item.name} className="h-full w-full object-cover rounded" />
                  ) : item.type === 'bundle' ? (
                    <Package className="h-6 w-6 text-muted-foreground" />
                  ) : (
                    <Music className="h-6 w-6 text-muted-foreground" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{item.name}</p>
                  {item.subtitle && <p className="text-sm text-muted-foreground truncate">{item.subtitle}</p>}
                </div>
                <div className="font-semibold">R$ {item.price.toFixed(2).replace('.', ',')}</div>
              </div>
            ))}
            <div className="border-t pt-3 flex items-center justify-between text-lg font-bold">
              <span>Total</span>
              <span>R$ {totalPrice.toFixed(2).replace('.', ',')}</span>
            </div>
          </CardContent>
        </Card>
      }
      compactSummary={(amount) => (
        <Card>
          <CardContent className="p-4 flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Total do pedido</span>
            <span className="text-lg font-bold text-primary">
              R$ {amount.toFixed(2).replace('.', ',')}
            </span>
          </CardContent>
        </Card>
      )}
    />
  );
}
