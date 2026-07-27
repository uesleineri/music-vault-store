import { useState } from 'react';
import { Link, Outlet, useLocation, Navigate } from 'react-router-dom';
import { LayoutDashboard, Music, ShoppingCart, LogOut, Users, History, Tag, Wallet, Package, Bell, Filter, Star, Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetClose } from '@/components/ui/sheet';
import { ThemeToggle } from '@/components/ThemeToggle';
import { useAuth } from '@/hooks/useAuth';
import { AdminNotificationsProvider, useAdminNotificationsContext } from '@/contexts/AdminNotificationsContext';
import { UploadQueueProvider } from '@/contexts/UploadQueueContext';
import { UploadQueueWidget } from '@/components/admin/UploadQueueWidget';
import { usePendingReviewsCount } from '@/hooks/useReviews';
import { useAuditLogUnreadCount } from '@/hooks/useAuditLogs';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/multitracks', label: 'Multitracks', icon: Music },
  { href: '/admin/bundles', label: 'Kits', icon: Package },
  { href: '/admin/sales', label: 'Vendas', icon: ShoppingCart },
  { href: '/admin/funnel', label: 'Funil de Vendas', icon: Filter },
  { href: '/admin/financial', label: 'Financeiro', icon: Wallet },
  { href: '/admin/coupons', label: 'Cupons', icon: Tag },
  { href: '/admin/reviews', label: 'Avaliações', icon: Star },
  { href: '/admin/notifications', label: 'Notificações', icon: Bell },
  { href: '/admin/administrators', label: 'Administradores', icon: Users },
  { href: '/admin/audit-logs', label: 'Logs de Auditoria', icon: History },
];

function AdminNav({ onNavigate }: { onNavigate?: () => void }) {
  const location = useLocation();
  const { unreadCount } = useAdminNotificationsContext();
  const { data: pendingReviewsCount } = usePendingReviewsCount();
  const { data: unreadLogsCount } = useAuditLogUnreadCount();

  return (
    <nav className="px-3 py-2">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = location.pathname === item.href;
        const isNotifications = item.href === '/admin/notifications';
        const isReviews = item.href === '/admin/reviews';
        const isAuditLogs = item.href === '/admin/audit-logs';
        const badgeCount = isNotifications
          ? unreadCount
          : isReviews
          ? pendingReviewsCount ?? 0
          : isAuditLogs
          ? unreadLogsCount ?? 0
          : 0;
        return (
          <Link
            key={item.href}
            to={item.href}
            onClick={onNavigate}
            className={cn(
              'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors',
              isActive
                ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
            )}
          >
            <Icon className="h-4 w-4" />
            <span className="flex-1">{item.label}</span>
            {badgeCount > 0 && (
              <span className="h-5 min-w-5 rounded-full bg-destructive px-1.5 text-[11px] font-medium text-destructive-foreground flex items-center justify-center">
                {badgeCount > 9 ? '9+' : badgeCount}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}

function AdminLayoutContent() {
  const location = useLocation();
  const { signOut } = useAuth();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <div className="min-h-screen flex">
      {/* Sidebar - permanent from lg up, replaced by the Sheet below on smaller screens */}
      <aside className="hidden lg:flex lg:flex-col w-64 border-r bg-sidebar">
        <div className="p-6">
          <Link to="/admin" className="flex items-center gap-2 font-bold text-xl">
            <img src="/logo-gospel-vs-icon-transparent.png" alt="" className="h-9 w-9 dark:hidden" />
            <img src="/logo-gospel-vs-icon-transparent-white.png" alt="" className="hidden h-9 w-9 dark:block" />
            <span>Admin</span>
          </Link>
        </div>
        <AdminNav />
        <div className="mt-auto p-3 border-t">
          <Button variant="ghost" className="w-full justify-start" onClick={signOut}>
            <LogOut className="h-4 w-4 mr-2" />
            Sair
          </Button>
        </div>
      </aside>

      {/* Mobile/tablet side menu */}
      <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
        <SheetContent side="left" className="w-72 p-0 flex flex-col">
          <SheetHeader className="p-6 pb-0">
            <SheetTitle asChild>
              <Link to="/admin" className="flex items-center gap-2 font-bold text-xl" onClick={() => setMobileNavOpen(false)}>
                <img src="/logo-gospel-vs-icon-transparent.png" alt="" className="h-8 w-8 dark:hidden" />
                <img src="/logo-gospel-vs-icon-transparent-white.png" alt="" className="hidden h-8 w-8 dark:block" />
                <span>Admin</span>
              </Link>
            </SheetTitle>
          </SheetHeader>
          <div className="mt-4">
            <AdminNav onNavigate={() => setMobileNavOpen(false)} />
          </div>
          <div className="mt-auto p-3 border-t">
            <SheetClose asChild>
              <Button variant="ghost" className="w-full justify-start" onClick={signOut}>
                <LogOut className="h-4 w-4 mr-2" />
                Sair
              </Button>
            </SheetClose>
          </div>
        </SheetContent>
      </Sheet>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 border-b flex items-center justify-between px-4 lg:px-6 gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden flex-shrink-0"
              aria-label="Abrir menu"
              onClick={() => setMobileNavOpen(true)}
            >
              <Menu className="h-5 w-5" />
            </Button>
            <h1 className="text-lg font-semibold truncate">
              {navItems.find((item) => item.href === location.pathname)?.label || 'Admin'}
            </h1>
          </div>
          <ThemeToggle />
        </header>
        <main className="flex-1 p-4 lg:p-6 bg-muted/30 overflow-x-hidden">
          <Outlet />
        </main>
      </div>
      <UploadQueueWidget />
    </div>
  );
}

export function AdminLayout() {
  const { user, isAdmin, loading, signOut, needsMfaVerification } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Carregando...</div>
      </div>
    );
  }

  if (!user || needsMfaVerification) {
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
    <AdminNotificationsProvider>
      <UploadQueueProvider>
        <AdminLayoutContent />
      </UploadQueueProvider>
    </AdminNotificationsProvider>
  );
}
