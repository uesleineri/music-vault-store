import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/ThemeToggle';
import { CartDrawer } from '@/components/CartDrawer';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetClose } from '@/components/ui/sheet';

const navLinks = [
  { to: '/catalog', label: 'Catálogo' },
  { to: '/kits', label: 'Kits' },
  { to: '/minha-conta', label: 'Minha Conta' },
];

export function Header() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
      <div className="container flex h-16 items-center justify-between">
        <Link to="/" className="flex items-center gap-2 font-bold text-xl">
          <img src="/logo-gospel-vs-icon-transparent.png" alt="" className="h-10 w-10 dark:hidden" />
          <img src="/logo-gospel-vs-icon-transparent-white.png" alt="" className="hidden h-10 w-10 dark:block" />
          <span>Gospel VS</span>
        </Link>

        {/* Desktop nav - hidden below md, replaced by the side menu */}
        <nav className="hidden md:flex items-center gap-4">
          <Link to="/catalog">
            <Button variant="outline">Catálogo</Button>
          </Link>
          <Link to="/kits">
            <Button variant="outline">Kits</Button>
          </Link>
          <Link to="/minha-conta">
            <Button variant="default">Minha Conta</Button>
          </Link>
          <CartDrawer />
          <ThemeToggle />
        </nav>

        {/* Mobile: cart + theme stay one tap away, rest lives in the side menu */}
        <div className="flex md:hidden items-center gap-1">
          <CartDrawer />
          <ThemeToggle />
          <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
            <Button variant="ghost" size="icon" aria-label="Abrir menu" onClick={() => setMenuOpen(true)}>
              <Menu className="h-5 w-5" />
            </Button>
            <SheetContent side="right" className="w-72">
              <SheetHeader>
                <SheetTitle>Menu</SheetTitle>
              </SheetHeader>
              <nav className="flex flex-col gap-2 mt-6">
                {navLinks.map((link) => (
                  <SheetClose asChild key={link.to}>
                    <Link to={link.to}>
                      <Button variant={link.to === '/minha-conta' ? 'default' : 'outline'} className="w-full justify-start">
                        {link.label}
                      </Button>
                    </Link>
                  </SheetClose>
                ))}
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
