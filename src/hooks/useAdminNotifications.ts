import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';
import { Sale } from '@/types/multitrack';

export interface AdminNotification {
  id: string;
  type: 'new_sale' | 'payment_confirmed';
  message: string;
  createdAt: string;
  read: boolean;
}

// Session-only (not persisted) - a bell icon showing what happened since the
// admin opened the tab, not a durable inbox.
const MAX_NOTIFICATIONS = 20;

const formatAmount = (amount: number) => `R$ ${Number(amount).toFixed(2).replace('.', ',')}`;

export function useAdminNotifications() {
  const { isAdmin, needsMfaVerification } = useAuth();
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);

  const pushNotification = useCallback((notification: Omit<AdminNotification, 'id' | 'read'>) => {
    setNotifications((prev) =>
      [{ ...notification, id: crypto.randomUUID(), read: false }, ...prev].slice(0, MAX_NOTIFICATIONS)
    );
  }, []);

  useEffect(() => {
    if (!isAdmin || needsMfaVerification) return;

    // Runs under the logged-in admin's own session (anon key + JWT), so RLS's
    // "Admins can view all sales" policy already gates who receives events -
    // no extra filtering needed here.
    const channel = supabase
      .channel('admin-sales-notifications')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'sales' },
        (payload) => {
          const sale = payload.new as Sale;
          pushNotification({
            type: 'new_sale',
            message: `Novo pedido de ${formatAmount(sale.amount)} - ${sale.buyer_email}`,
            createdAt: new Date().toISOString(),
          });
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'sales' },
        (payload) => {
          const oldSale = payload.old as Sale;
          const newSale = payload.new as Sale;
          if (oldSale.payment_status !== 'paid' && newSale.payment_status === 'paid') {
            const message = `Pagamento confirmado: ${formatAmount(newSale.amount)} - ${newSale.buyer_email}`;
            pushNotification({ type: 'payment_confirmed', message, createdAt: new Date().toISOString() });
            toast({ title: 'Pagamento confirmado!', description: message });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isAdmin, needsMfaVerification, pushNotification]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markAllRead = useCallback(() => {
    setNotifications((prev) => (prev.some((n) => !n.read) ? prev.map((n) => ({ ...n, read: true })) : prev));
  }, []);

  return { notifications, unreadCount, markAllRead };
}
