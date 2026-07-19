import { Link } from 'react-router-dom';
import { Music, ShoppingCart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/ThemeToggle';
import { useCart } from '@/contexts/CartContext';

export function Header() {
  const { count } = useCart();

  return (
    <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
      <div className="container flex h-16 items-center justify-between">
        <Link to="/" className="flex items-center gap-2 font-bold text-xl">
          <Music className="h-6 w-6" />
          <span>Multitracks</span>
        </Link>
        <nav className="flex items-center gap-4">
          <Link to="/catalog">
            <Button variant="ghost">Catálogo</Button>
          </Link>
          <Link to="/kits">
            <Button variant="ghost">Kits</Button>
          </Link>
          <Link to="/cart">
            <Button variant="ghost" size="icon" className="relative" aria-label="Carrinho">
              <ShoppingCart className="h-5 w-5" />
              {count > 0 && (
                <span className="absolute -top-1 -right-1 h-4 min-w-4 rounded-full bg-primary px-1 text-[10px] font-medium text-primary-foreground flex items-center justify-center">
                  {count > 9 ? '9+' : count}
                </span>
              )}
            </Button>
          </Link>
          <ThemeToggle />
        </nav>
      </div>
    </header>
  );
}
