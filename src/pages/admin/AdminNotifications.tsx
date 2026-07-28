import { useEffect } from 'react';
import { Bell, Music, Check, Undo2, Trash2, Loader2 } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useAdminNotificationsContext } from '@/contexts/AdminNotificationsContext';
import { useToast } from '@/hooks/use-toast';
import {
  useMusicRequests,
  useSetMusicRequestStatus,
  useDeleteMusicRequest,
} from '@/hooks/useMusicRequests';

function NotificationsTab() {
  const { notifications } = useAdminNotificationsContext();

  return (
    <Card>
      <CardContent className="p-0">
        {notifications.length === 0 ? (
          <div className="p-8 text-center">
            <Bell className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <h3 className="font-semibold mb-1">Nenhuma notificação</h3>
            <p className="text-muted-foreground">
              Nada por aqui ainda - assim que houver um pedido novo ou um pagamento confirmado,
              ele aparece aqui.
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
  );
}

function MusicRequestsTab() {
  const { data: requests, isLoading } = useMusicRequests();
  const setStatus = useSetMusicRequestStatus();
  const deleteRequest = useDeleteMusicRequest();
  const { toast } = useToast();

  const pendingCount = requests?.filter((r) => r.status === 'pending').length ?? 0;

  const handleToggleStatus = async (id: string, currentStatus: 'pending' | 'done') => {
    const nextStatus = currentStatus === 'pending' ? 'done' : 'pending';
    try {
      await setStatus.mutateAsync({ id, status: nextStatus });
      toast({ title: nextStatus === 'done' ? 'Marcada como atendida' : 'Marcada como pendente' });
    } catch (error: any) {
      toast({ title: 'Erro ao atualizar', description: error.message, variant: 'destructive' });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteRequest.mutateAsync(id);
      toast({ title: 'Solicitação removida' });
    } catch (error: any) {
      toast({ title: 'Erro ao remover', description: error.message, variant: 'destructive' });
    }
  };

  return (
    <Card>
      <CardContent className="p-0">
        {isLoading ? (
          <div className="p-8 text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">Carregando...</p>
          </div>
        ) : requests && requests.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Artista</TableHead>
                <TableHead>Música</TableHead>
                <TableHead>Tom</TableHead>
                <TableHead>Versão</TableHead>
                <TableHead>Solicitante</TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {requests.map((request) => (
                <TableRow key={request.id}>
                  <TableCell className="max-w-[160px] truncate">{request.artist_name}</TableCell>
                  <TableCell className="max-w-[160px] truncate">{request.song_name}</TableCell>
                  <TableCell>{request.key_signature || '-'}</TableCell>
                  <TableCell>{request.version || '-'}</TableCell>
                  <TableCell className="max-w-[200px]">
                    <div className="truncate">{request.requester_name}</div>
                    <div className="truncate text-xs text-muted-foreground">{request.requester_email}</div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {format(new Date(request.created_at), 'dd/MM/yyyy', { locale: ptBR })}
                  </TableCell>
                  <TableCell>
                    {request.status === 'done' ? (
                      <Badge>Atendida</Badge>
                    ) : (
                      <Badge variant="secondary">Pendente</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      {request.status === 'pending' ? (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleToggleStatus(request.id, request.status)}
                          title="Marcar como atendida"
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                      ) : (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleToggleStatus(request.id, request.status)}
                          title="Marcar como pendente"
                        >
                          <Undo2 className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive"
                        onClick={() => handleDelete(request.id)}
                        title="Excluir"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="p-8 text-center">
            <Music className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <h3 className="font-semibold mb-1">Nenhuma solicitação ainda</h3>
            <p className="text-muted-foreground">
              Assim que alguém pedir uma música pela home, ela aparece aqui.
            </p>
          </div>
        )}
      </CardContent>
      {pendingCount > 0 && (
        <p className="px-4 pb-4 text-sm text-muted-foreground">{pendingCount} aguardando atendimento</p>
      )}
    </Card>
  );
}

export default function AdminNotifications() {
  const { markAllRead } = useAdminNotificationsContext();

  // Opening this page is the "read" action - same as opening the old popover.
  useEffect(() => {
    markAllRead();
  }, [markAllRead]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h2 className="text-2xl font-bold">Notificações</h2>
        <p className="text-muted-foreground">
          Histórico de pedidos, pagamentos confirmados e solicitações de música
        </p>
      </div>

      <Tabs defaultValue="notifications">
        <TabsList>
          <TabsTrigger value="notifications">Notificações</TabsTrigger>
          <TabsTrigger value="requests">Solicitações</TabsTrigger>
        </TabsList>
        <TabsContent value="notifications" className="mt-4">
          <NotificationsTab />
        </TabsContent>
        <TabsContent value="requests" className="mt-4">
          <MusicRequestsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
