import { Link } from 'react-router-dom';
import { Music } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/ThemeToggle';
import { CartDrawer } from '@/components/CartDrawer';

export function Header() {
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
          <Link to="/minha-conta">
            <Button variant="ghost">Minha Conta</Button>
          </Link>
          <CartDrawer />
          <ThemeToggle />
        </nav>
      </div>
    </header>
  );
}
