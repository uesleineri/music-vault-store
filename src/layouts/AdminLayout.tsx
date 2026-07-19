import { Link, Outlet, useLocation, Navigate } from 'react-router-dom';
import { LayoutDashboard, Music, ShoppingCart, LogOut, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/multitracks', label: 'Multitracks', icon: Music },
  { href: '/admin/sales', label: 'Vendas', icon: ShoppingCart },
  { href: '/admin/administrators', label: 'Administradores', icon: Users },
];

export function AdminLayout() {
  const location = useLocation();
  const { user, isAdmin, loading, signOut } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Carregando...</div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/admin/login" replace />;
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Acesso negado</h1>
          <p className="text-muted-foreground mb-4">Você não tem permissão para acessar esta área.</p>
          <Button onClick={signOut}>Sair</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside className="w-64 border-r bg-sidebar">
        <div className="p-6">
          <Link to="/" className="flex items-center gap-2 font-bold text-xl">
            <Music className="h-6 w-6" />
            <span>Admin</span>
          </Link>
        </div>
        <nav className="px-3 py-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.href;
            return (
              <Link
                key={item.href}
                to={item.href}
                className={cn(
                  'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                    : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto p-3 border-t">
          <Button variant="ghost" className="w-full justify-start" onClick={signOut}>
            <LogOut className="h-4 w-4 mr-2" />
            Sair
          </Button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col">
        <header className="h-16 border-b flex items-center px-6">
          <h1 className="text-lg font-semibold">
            {navItems.find((item) => item.href === location.pathname)?.label || 'Admin'}
          </h1>
        </header>
        <main className="flex-1 p-6 bg-muted/30">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
