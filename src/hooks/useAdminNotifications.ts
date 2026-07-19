import { useState, useEffect, useCallback, useRef } from 'react';
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

// A cart checkout inserts (and later pays) several `sales` rows at once, one
// per item, all sharing a checkout_group_id - Postgres fires one Realtime
// event per row. Rows from the same order land within milliseconds of each
// other, so buffer by group id for this long before turning them into one
// notification instead of one per row.
const COALESCE_WINDOW_MS = 500;

const formatAmount = (amount: number) => `R$ ${Number(amount).toFixed(2).replace('.', ',')}`;

interface PendingGroup {
  count: number;
  total: number;
  buyerEmail: string;
  timer: ReturnType<typeof setTimeout>;
}

export function useAdminNotifications() {
  const { isAdmin, needsMfaVerification } = useAuth();
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const pendingRef = useRef<Map<string, PendingGroup>>(new Map());

  const pushNotification = useCallback((notification: Omit<AdminNotification, 'id' | 'read'>) => {
    setNotifications((prev) =>
      [{ ...notification, id: crypto.randomUUID(), read: false }, ...prev].slice(0, MAX_NOTIFICATIONS)
    );
  }, []);

  const bufferEvent = useCallback(
    (kind: 'new_sale' | 'payment_confirmed', groupId: string, amount: number, buyerEmail: string) => {
      const key = `${kind}:${groupId}`;
      const existing = pendingRef.current.get(key);
      if (existing) {
        clearTimeout(existing.timer);
        existing.count += 1;
        existing.total += amount;
      }
      const bucket = existing ?? { count: 1, total: amount, buyerEmail, timer: undefined as any };

      bucket.timer = setTimeout(() => {
        pendingRef.current.delete(key);
        const itemsLabel = bucket.count > 1 ? ` (${bucket.count} itens)` : '';
        if (kind === 'new_sale') {
          pushNotification({
            type: 'new_sale',
            message: `Novo pedido de ${formatAmount(bucket.total)}${itemsLabel} - ${bucket.buyerEmail}`,
            createdAt: new Date().toISOString(),
          });
        } else {
          const message = `Pagamento confirmado: ${formatAmount(bucket.total)}${itemsLabel} - ${bucket.buyerEmail}`;
          pushNotification({ type: 'payment_confirmed', message, createdAt: new Date().toISOString() });
          toast({ title: 'Pagamento confirmado!', description: message });
        }
      }, COALESCE_WINDOW_MS);

      pendingRef.current.set(key, bucket);
    },
    [pushNotification]
  );

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
          bufferEvent('new_sale', sale.checkout_group_id, Number(sale.amount), sale.buyer_email);
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'sales' },
        (payload) => {
          const oldSale = payload.old as Sale;
          const newSale = payload.new as Sale;
          if (oldSale.payment_status !== 'paid' && newSale.payment_status === 'paid') {
            bufferEvent('payment_confirmed', newSale.checkout_group_id, Number(newSale.amount), newSale.buyer_email);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      for (const bucket of pendingRef.current.values()) clearTimeout(bucket.timer);
      pendingRef.current.clear();
    };
  }, [isAdmin, needsMfaVerification, bufferEvent]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markAllRead = useCallback(() => {
    setNotifications((prev) => (prev.some((n) => !n.read) ? prev.map((n) => ({ ...n, read: true })) : prev));
  }, []);

  return { notifications, unreadCount, markAllRead };
}
