import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Music, CheckCircle, Loader2, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useMultitrack } from '@/hooks/useMultitracks';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

export default function Checkout() {
  const { id } = useParams<{ id: string }>();
  const { data: multitrack, isLoading } = useMultitrack(id || '');
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentUrl, setPaymentUrl] = useState<string | null>(null);
  const [saleId, setSaleId] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !multitrack) {
      toast({
        title: 'Email obrigatório',
        description: 'Por favor, informe seu email para receber o link de download.',
        variant: 'destructive',
      });
      return;
    }

    setIsProcessing(true);

    try {
      const { data, error } = await supabase.functions.invoke('create-payment', {
        body: {
          multitrack_id: multitrack.id,
          buyer_email: email,
          amount: multitrack.price,
          multitrack_name: `${multitrack.artist_name} - ${multitrack.song_name}`,
        },
      });

      if (error) throw error;

      if (data.payment_url) {
        setPaymentUrl(data.payment_url);
        setSaleId(data.sale_id);
        toast({
          title: 'Pagamento criado!',
          description: 'Clique no botão para pagar.',
        });
      }
    } catch (error: any) {
      console.error('Payment error:', error);
      toast({
        title: 'Erro ao processar',
        description: error.message || 'Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="container py-8 max-w-2xl">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-32" />
          <div className="h-64 bg-muted rounded" />
        </div>
      </div>
    );
  }

  if (!multitrack) {
    return (
      <div className="container py-8 text-center">
        <Music className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
        <h1 className="text-2xl font-bold mb-2">Produto não encontrado</h1>
        <Link to="/catalog">
          <Button>Voltar ao catálogo</Button>
        </Link>
      </div>
    );
  }

  if (paymentUrl) {
    return (
      <div className="container py-16 max-w-lg text-center animate-fade-in">
        <div className="h-20 w-20 mx-auto bg-primary/10 rounded-full flex items-center justify-center mb-6">
          <ExternalLink className="h-10 w-10 text-primary" />
        </div>
        <h1 className="text-3xl font-bold mb-4">Quase lá!</h1>
        <p className="text-muted-foreground mb-8">
          Clique no botão abaixo para finalizar o pagamento. Após a confirmação, você receberá o link de download no email <strong>{email}</strong>.
        </p>
        <Card className="text-left mb-8">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="h-16 w-16 rounded bg-muted flex items-center justify-center flex-shrink-0">
              {multitrack.cover_url ? (
                <img
                  src={multitrack.cover_url}
                  alt={multitrack.song_name}
                  className="h-full w-full object-cover rounded"
                />
              ) : (
                <Music className="h-8 w-8 text-muted-foreground" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold truncate">{multitrack.song_name}</h3>
              <p className="text-sm text-muted-foreground truncate">{multitrack.artist_name}</p>
            </div>
            <div className="text-lg font-bold">
              R$ {multitrack.price.toFixed(2).replace('.', ',')}
            </div>
          </CardContent>
        </Card>
        <a href={paymentUrl} target="_blank" rel="noopener noreferrer">
          <Button size="lg" className="w-full gap-2 mb-4">
            <ExternalLink className="h-5 w-5" />
            Pagar agora
          </Button>
        </a>
        <Link to="/catalog">
          <Button variant="outline" className="w-full">Voltar ao catálogo</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="container py-8 max-w-2xl animate-fade-in">
      <Link to={`/multitrack/${multitrack.id}`} className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-8">
        <ArrowLeft className="h-4 w-4" />
        Voltar
      </Link>

      <div className="grid gap-8">
        {/* Order Summary */}
        <Card>
          <CardHeader>
            <CardTitle>Resumo do pedido</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <div className="h-20 w-20 rounded bg-muted flex items-center justify-center flex-shrink-0">
                {multitrack.cover_url ? (
                  <img
                    src={multitrack.cover_url}
                    alt={multitrack.song_name}
                    className="h-full w-full object-cover rounded"
                  />
                ) : (
                  <Music className="h-10 w-10 text-muted-foreground" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold">{multitrack.song_name}</h3>
                <p className="text-sm text-muted-foreground">{multitrack.artist_name}</p>
              </div>
              <div className="text-xl font-bold">
                R$ {multitrack.price.toFixed(2).replace('.', ',')}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Payment Form */}
        <Card>
          <CardHeader>
            <CardTitle>Finalizar compra</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="email">Email para receber o download</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
                <p className="text-sm text-muted-foreground">
                  O link de download será enviado para este email após a confirmação do pagamento.
                </p>
              </div>

              <div className="border-t pt-4">
                <div className="flex items-center justify-between text-lg font-semibold mb-4">
                  <span>Total</span>
                  <span>R$ {multitrack.price.toFixed(2).replace('.', ',')}</span>
                </div>
                <Button type="submit" size="lg" className="w-full" disabled={isProcessing}>
                  {isProcessing ? (
                    <>
                      <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                      Processando...
                    </>
                  ) : (
                    'Continuar para pagamento'
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
