import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ShoppingCart, Music, Package, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetFooter,
  SheetClose,
} from '@/components/ui/sheet';
import { useCart } from '@/contexts/CartContext';

export function CartDrawer() {
  const { items, removeItem, totalPrice, count } = useCart();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  const handleCheckout = () => {
    setOpen(false);
    navigate('/checkout');
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label="Carrinho">
          <ShoppingCart className="h-5 w-5" />
          {count > 0 && (
            <span className="absolute -top-1 -right-1 h-4 min-w-4 rounded-full bg-primary px-1 text-[10px] font-medium text-primary-foreground flex items-center justify-center">
              {count > 9 ? '9+' : count}
            </span>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="flex flex-col w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Seu carrinho {count > 0 && `(${count})`}</SheetTitle>
        </SheetHeader>

        {items.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center gap-3">
            <ShoppingCart className="h-12 w-12 text-muted-foreground" />
            <p className="text-muted-foreground">Seu carrinho está vazio.</p>
            <SheetClose asChild>
              <Link to="/catalog">
                <Button variant="outline">Ver catálogo</Button>
              </Link>
            </SheetClose>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto -mx-6 px-6 space-y-3">
              {items.map((item) => (
                <div key={`${item.type}-${item.id}`} className="flex items-center gap-3 py-2 border-b last:border-b-0">
                  <div className="h-12 w-12 rounded bg-muted flex items-center justify-center flex-shrink-0">
                    {item.cover_url ? (
                      <img src={item.cover_url} alt={item.name} className="h-full w-full object-cover rounded" />
                    ) : item.type === 'bundle' ? (
                      <Package className="h-5 w-5 text-muted-foreground" />
                    ) : (
                      <Music className="h-5 w-5 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{item.name}</p>
                    {item.subtitle && <p className="text-xs text-muted-foreground truncate">{item.subtitle}</p>}
                  </div>
                  <p className="text-sm font-semibold whitespace-nowrap">
                    R$ {item.price.toFixed(2).replace('.', ',')}
                  </p>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive flex-shrink-0"
                    onClick={() => removeItem(item.type, item.id)}
                    aria-label="Remover do carrinho"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>

            <SheetFooter className="flex-col gap-3 sm:flex-col border-t pt-4">
              <div className="flex items-center justify-between w-full text-base font-semibold">
                <span>Total</span>
                <span>R$ {totalPrice.toFixed(2).replace('.', ',')}</span>
              </div>
              <Button size="lg" className="w-full" onClick={handleCheckout}>
                Finalizar compra
              </Button>
            </SheetFooter>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
