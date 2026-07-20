import { useEffect } from 'react';
import { Bell } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Card, CardContent } from '@/components/ui/card';
import { useAdminNotificationsContext } from '@/contexts/AdminNotificationsContext';

export default function AdminNotifications() {
  const { notifications, markAllRead } = useAdminNotificationsContext();

  // Opening this page is the "read" action - same as opening the old popover.
  useEffect(() => {
    markAllRead();
  }, [markAllRead]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h2 className="text-2xl font-bold">Notificações</h2>
        <p className="text-muted-foreground">
          Novos pedidos e pagamentos confirmados desde que você abriu o painel
        </p>
      </div>

      <Card>
        <CardContent className="p-0">
          {notifications.length === 0 ? (
            <div className="p-8 text-center">
              <Bell className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <h3 className="font-semibold mb-1">Nenhuma notificação</h3>
              <p className="text-muted-foreground">
                Nada aconteceu ainda nesta sessão - assim que houver um pedido novo ou um pagamento
                confirmado, ele aparece aqui.
              </p>
            </div>
          ) : (
            <ul className="divide-y">
              {notifications.map((notification) => (
                <li key={notification.id} className="p-4">
                  <p className="text-sm">{notification.message}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true, locale: ptBR })}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
