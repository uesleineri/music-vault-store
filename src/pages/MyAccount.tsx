import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Music, Package, LogOut, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useCustomerAuth } from '@/hooks/useCustomerAuth';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { ReviewDialog } from '@/components/ReviewDialog';

const statusLabels: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' }> = {
  pending: { label: 'Pendente', variant: 'secondary' },
  paid: { label: 'Pago', variant: 'default' },
  failed: { label: 'Falhou', variant: 'destructive' },
};

// RLS's "Customers can view own sales" policy (buyer_email = auth.jwt() email)
// guarantees this only ever returns the logged-in buyer's own rows.
function useMySales(email?: string | null) {
  return useQuery({
    queryKey: ['my-sales', email],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sales')
        .select('*, multitrack:multitracks(*), bundle:bundles(*)')
        .eq('buyer_email', email)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!email,
  });
}

export default function MyAccount() {
  const { user, loading, signIn, signOut, requestPasswordReset } = useCustomerAuth();
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: sales, isLoading: salesLoading } = useMySales(user?.email);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await signIn(email, password);
    } catch (error: any) {
      toast({ title: 'Erro ao entrar', description: error.message, variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      toast({
        title: 'Informe seu e-mail',
        description: 'Digite o e-mail usado na compra para receber o link de acesso.',
        variant: 'destructive',
      });
      return;
    }
    try {
      await requestPasswordReset(email);
      toast({ title: 'E-mail enviado!', description: 'Confira sua caixa de entrada para definir sua senha.' });
    } catch (error: any) {
      toast({ title: 'Erro ao enviar e-mail', description: error.message, variant: 'destructive' });
    }
  };

  if (loading) {
    return <div className="container py-16 text-center text-muted-foreground">Carregando...</div>;
  }

  if (!user) {
    return (
      <div className="container py-16 max-w-md animate-fade-in">
        <h1 className="text-2xl font-bold mb-2">Minha Conta</h1>
        <p className="text-muted-foreground mb-6">
          Entre com o e-mail que você usou numa compra. Assim que o pagamento é confirmado, você
          recebe um e-mail para definir sua senha.
        </p>
        <Card>
          <CardContent className="p-6">
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">E-mail</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Senha</Label>
                <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
              </div>
              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Entrar'}
              </Button>
              <Button type="button" variant="ghost" className="w-full" onClick={handleForgotPassword}>
                Esqueci minha senha / ainda não defini uma senha
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container py-8 max-w-3xl animate-fade-in">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">Minha Conta</h1>
          <p className="text-muted-foreground">{user.email}</p>
        </div>
        <Button variant="outline" className="gap-2" onClick={signOut}>
          <LogOut className="h-4 w-4" />
          Sair
        </Button>
      </div>

      <h2 className="text-lg font-semibold mb-4">Minhas compras</h2>
      {salesLoading ? (
        <p className="text-muted-foreground">Carregando...</p>
      ) : sales && sales.length > 0 ? (
        <div className="space-y-3">
          {sales.map((sale) => {
            const status = statusLabels[sale.payment_status] ?? statusLabels.pending;
            const coverUrl = sale.multitrack?.cover_url || sale.bundle?.cover_url;
            const name = sale.multitrack
              ? `${sale.multitrack.artist_name} - ${sale.multitrack.song_name}`
              : sale.bundle?.name ?? 'N/A';

            return (
              <Card key={sale.id}>
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="h-12 w-12 rounded bg-muted flex items-center justify-center flex-shrink-0">
                    {coverUrl ? (
                      <img src={coverUrl} alt={name} className="h-full w-full object-cover rounded" />
                    ) : sale.bundle ? (
                      <Package className="h-5 w-5 text-muted-foreground" />
                    ) : (
                      <Music className="h-5 w-5 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{name}</p>
                    <p className="text-sm text-muted-foreground">
                      {format(new Date(sale.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </p>
                  </div>
                  <Badge variant={status.variant}>{status.label}</Badge>
                  {sale.payment_status === 'paid' && sale.download_token && (
                    <Link to={`/download/${sale.download_token}`}>
                      <Button size="sm" variant="ghost">Baixar</Button>
                    </Link>
                  )}
                  {sale.payment_status === 'paid' && (
                    <ReviewDialog
                      buyerEmail={user.email!}
                      productName={name}
                      multitrackId={sale.multitrack_id}
                      bundleId={sale.bundle_id}
                    />
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <p className="text-muted-foreground">Nenhuma compra encontrada para este e-mail.</p>
      )}
    </div>
  );
}
