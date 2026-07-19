import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, Plus, ShieldCheck, Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { TwoFactorSettings } from '@/components/admin/TwoFactorSettings';

interface AdminRow {
  id: string;
  user_id: string;
  email: string;
  created_at: string;
}

export default function AdminAdministrators() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newEmail, setNewEmail] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['admins'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('manage-admins', {
        body: { action: 'list' },
      });
      if (error) throw error;
      return data.admins as AdminRow[];
    },
  });

  const addAdmin = useMutation({
    mutationFn: async (email: string) => {
      const { data, error } = await supabase.functions.invoke('manage-admins', {
        body: { action: 'add', email },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      toast({
        title: 'Administrador adicionado',
        description: 'Se a pessoa ainda não tinha conta, um e-mail de convite foi enviado.',
      });
      queryClient.invalidateQueries({ queryKey: ['admins'] });
      setIsDialogOpen(false);
      setNewEmail('');
    },
    onError: (error: any) => {
      toast({ title: 'Erro ao adicionar administrador', description: error.message, variant: 'destructive' });
    },
  });

  const removeAdmin = useMutation({
    mutationFn: async (adminUserId: string) => {
      const { data, error } = await supabase.functions.invoke('manage-admins', {
        body: { action: 'remove', admin_user_id: adminUserId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      toast({ title: 'Administrador removido' });
      queryClient.invalidateQueries({ queryKey: ['admins'] });
    },
    onError: (error: any) => {
      toast({ title: 'Erro ao remover administrador', description: error.message, variant: 'destructive' });
    },
  });

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (newEmail.trim()) addAdmin.mutate(newEmail.trim());
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <TwoFactorSettings />

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Administradores</h2>
          <p className="text-muted-foreground">Quem tem acesso a este painel</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Adicionar administrador
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Adicionar administrador</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleAdd} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="new-admin-email">E-mail</Label>
                <Input
                  id="new-admin-email"
                  type="email"
                  placeholder="pessoa@exemplo.com"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Se já existir uma conta com esse e-mail, ela vira admin na hora. Senão, enviamos um
                  convite por e-mail para a pessoa criar a senha.
                </p>
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={addAdmin.isPending}>
                  {addAdmin.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Adicionar'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center">
              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">Carregando...</p>
            </div>
          ) : data && data.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>E-mail</TableHead>
                  <TableHead>Adicionado em</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((admin) => (
                  <TableRow key={admin.id}>
                    <TableCell className="font-medium flex items-center gap-2">
                      <ShieldCheck className="h-4 w-4 text-muted-foreground" />
                      {admin.email}
                      {admin.user_id === user?.id && (
                        <span className="text-xs text-muted-foreground">(você)</span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {format(new Date(admin.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </TableCell>
                    <TableCell className="text-right">
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive hover:text-destructive"
                            disabled={admin.user_id === user?.id || data.length <= 1}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Remover administrador?</AlertDialogTitle>
                            <AlertDialogDescription>
                              {admin.email} perde acesso ao painel imediatamente. Isso não apaga a conta,
                              só a permissão de administrador.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => removeAdmin.mutate(admin.id)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Remover
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="p-8 text-center text-muted-foreground">Nenhum administrador encontrado.</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
