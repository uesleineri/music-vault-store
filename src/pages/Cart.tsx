import { Link, useNavigate } from 'react-router-dom';
import { ShoppingCart, Music, Package, Trash2, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useCart } from '@/contexts/CartContext';

export default function Cart() {
  const { items, removeItem, totalPrice } = useCart();
  const navigate = useNavigate();

  if (items.length === 0) {
    return (
      <div className="container py-16 text-center animate-fade-in">
        <ShoppingCart className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
        <h1 className="text-2xl font-bold mb-2">Seu carrinho está vazio</h1>
        <p className="text-muted-foreground mb-6">
          Adicione multitracks ou kits para comprar tudo num pagamento só.
        </p>
        <div className="flex gap-3 justify-center">
          <Link to="/catalog">
            <Button>Ver catálogo</Button>
          </Link>
          <Link to="/kits">
            <Button variant="outline">Ver kits</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container py-8 max-w-2xl animate-fade-in">
      <Link to="/catalog" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-8">
        <ArrowLeft className="h-4 w-4" />
        Continuar comprando
      </Link>

      <h1 className="text-2xl font-bold mb-6">Seu carrinho</h1>

      <div className="space-y-3 mb-6">
        {items.map((item) => (
          <Card key={`${item.type}-${item.id}`}>
            <CardContent className="p-4 flex items-center gap-4">
              <div className="h-16 w-16 rounded bg-muted flex items-center justify-center flex-shrink-0">
                {item.cover_url ? (
                  <img src={item.cover_url} alt={item.name} className="h-full w-full object-cover rounded" />
                ) : item.type === 'bundle' ? (
                  <Package className="h-8 w-8 text-muted-foreground" />
                ) : (
                  <Music className="h-8 w-8 text-muted-foreground" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold truncate">{item.name}</h3>
                {item.subtitle && <p className="text-sm text-muted-foreground truncate">{item.subtitle}</p>}
              </div>
              <div className="text-right">
                <p className="font-bold">R$ {item.price.toFixed(2).replace('.', ',')}</p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="text-destructive hover:text-destructive"
                onClick={() => removeItem(item.type, item.id)}
                aria-label="Remover do carrinho"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="p-4 flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Total ({items.length} item{items.length === 1 ? '' : 's'})</p>
            <p className="text-2xl font-bold">R$ {totalPrice.toFixed(2).replace('.', ',')}</p>
          </div>
          <Button size="lg" onClick={() => navigate('/checkout')}>
            Finalizar compra
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
