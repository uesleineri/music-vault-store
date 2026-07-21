import { Link, Outlet, useLocation, Navigate } from 'react-router-dom';
import { LayoutDashboard, Music, ShoppingCart, LogOut, Users, History, Tag, Wallet, Package, Bell, Filter, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
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

function AdminLayoutContent() {
  const location = useLocation();
  const { signOut } = useAuth();
  const { unreadCount } = useAdminNotificationsContext();
  const { data: pendingReviewsCount } = usePendingReviewsCount();
  const { data: unreadLogsCount } = useAuditLogUnreadCount();

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside className="w-64 border-r bg-sidebar">
        <div className="p-6">
          <Link to="/admin" className="flex items-center gap-2 font-bold text-xl">
            <Music className="h-6 w-6" />
            <span>Admin</span>
          </Link>
        </div>
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
        <div className="mt-auto p-3 border-t">
          <Button variant="ghost" className="w-full justify-start" onClick={signOut}>
            <LogOut className="h-4 w-4 mr-2" />
            Sair
          </Button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col">
        <header className="h-16 border-b flex items-center justify-between px-6">
          <h1 className="text-lg font-semibold">
            {navItems.find((item) => item.href === location.pathname)?.label || 'Admin'}
          </h1>
          <ThemeToggle />
        </header>
        <main className="flex-1 p-6 bg-muted/30">
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
