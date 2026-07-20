import { createContext, useContext, ReactNode } from 'react';
import { useAdminNotifications, AdminNotification } from '@/hooks/useAdminNotifications';

interface AdminNotificationsContextValue {
  notifications: AdminNotification[];
  unreadCount: number;
  markAllRead: () => void;
}

const AdminNotificationsContext = createContext<AdminNotificationsContextValue | null>(null);

// Single shared subscription - the sidebar badge and the /admin/notifications
// page both read from this instead of each opening their own Realtime
// channel (which would double-fire every event and desync their counts).
export function AdminNotificationsProvider({ children }: { children: ReactNode }) {
  const value = useAdminNotifications();
  return <AdminNotificationsContext.Provider value={value}>{children}</AdminNotificationsContext.Provider>;
}

export function useAdminNotificationsContext() {
  const context = useContext(AdminNotificationsContext);
  if (!context) throw new Error('useAdminNotificationsContext must be used within an AdminNotificationsProvider');
  return context;
}
