import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';

export interface AdminNotification {
  id: string;
  type: 'new_sale' | 'payment_confirmed';
  message: string;
  createdAt: string;
  read: boolean;
}

// Backed by the admin_notifications table (written server-side by
// create-payment/asaas-webhook/verify-payment, one row per checkout group) -
// survives a closed tab and captures orders that happened while no admin was
// online, unlike the old client-side-only notification list.
const PAGE_SIZE = 30;

interface NotificationRow {
  id: string;
  type: 'new_sale' | 'payment_confirmed';
  message: string;
  created_at: string;
  read: boolean;
}

const fromRow = (row: NotificationRow): AdminNotification => ({
  id: row.id,
  type: row.type,
  message: row.message,
  createdAt: row.created_at,
  read: row.read,
});

export function useAdminNotifications() {
  const { isAdmin, needsMfaVerification } = useAuth();
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);

  useEffect(() => {
    if (!isAdmin || needsMfaVerification) return;

    let active = true;

    supabase
      .from('admin_notifications')
      .select('id, type, message, created_at, read')
      .order('created_at', { ascending: false })
      .limit(PAGE_SIZE)
      .then(({ data, error }) => {
        if (error) {
          console.error('Failed to load admin notifications:', error);
          return;
        }
        if (active && data) setNotifications(data.map(fromRow));
      });

    // Runs under the logged-in admin's own session (anon key + JWT), so RLS's
    // "Admins can view notifications" policy already gates who receives
    // events - no extra filtering needed here.
    const channel = supabase
      .channel('admin-notifications-feed')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'admin_notifications' },
        (payload) => {
          const row = payload.new as NotificationRow;
          setNotifications((prev) => [fromRow(row), ...prev].slice(0, PAGE_SIZE));
          if (row.type === 'payment_confirmed') {
            toast({ title: 'Pagamento confirmado!', description: row.message });
          }
        }
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [isAdmin, needsMfaVerification]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markAllRead = useCallback(() => {
    setNotifications((prev) => (prev.some((n) => !n.read) ? prev.map((n) => ({ ...n, read: true })) : prev));
    supabase
      .from('admin_notifications')
      .update({ read: true })
      .eq('read', false)
      .then(({ error }) => {
        if (error) console.error('Failed to mark notifications as read:', error);
      });
  }, []);

  return { notifications, unreadCount, markAllRead };
}
