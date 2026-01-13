import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Music, Loader2, Copy, Check, QrCode } from 'lucide-react';
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
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [cpf, setCpf] = useState('');
  const [phone, setPhone] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [pixData, setPixData] = useState<{
    qrCodeImage: string;
    copyPaste: string;
    expiration: string;
  } | null>(null);
  const [saleId, setSaleId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Format CPF as user types
  const formatCpf = (value: string) => {
    const numbers = value.replace(/\D/g, '').slice(0, 11);
    if (numbers.length <= 3) return numbers;
    if (numbers.length <= 6) return `${numbers.slice(0, 3)}.${numbers.slice(3)}`;
    if (numbers.length <= 9) return `${numbers.slice(0, 3)}.${numbers.slice(3, 6)}.${numbers.slice(6)}`;
    return `${numbers.slice(0, 3)}.${numbers.slice(3, 6)}.${numbers.slice(6, 9)}-${numbers.slice(9)}`;
  };

  // Validate CPF using the official algorithm
  const validateCpf = (cpfValue: string) => {
    const numbers = cpfValue.replace(/\D/g, '');
    if (numbers.length !== 11) return false;
    
    // Check for known invalid patterns
    if (/^(\d)\1{10}$/.test(numbers)) return false;
    
    // Validate first digit
    let sum = 0;
    for (let i = 0; i < 9; i++) {
      sum += parseInt(numbers[i]) * (10 - i);
    }
    let remainder = (sum * 10) % 11;
    if (remainder === 10 || remainder === 11) remainder = 0;
    if (remainder !== parseInt(numbers[9])) return false;
    
    // Validate second digit
    sum = 0;
    for (let i = 0; i < 10; i++) {
      sum += parseInt(numbers[i]) * (11 - i);
    }
    remainder = (sum * 10) % 11;
    if (remainder === 10 || remainder === 11) remainder = 0;
    if (remainder !== parseInt(numbers[10])) return false;
    
    return true;
  };

  // Format phone as user types
  const formatPhone = (value: string) => {
    const numbers = value.replace(/\D/g, '').slice(0, 11);
    if (numbers.length <= 2) return numbers;
    if (numbers.length <= 7) return `(${numbers.slice(0, 2)}) ${numbers.slice(2)}`;
    return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7)}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const cpfNumbers = cpf.replace(/\D/g, '');
    const phoneNumbers = phone.replace(/\D/g, '');
    
    if (!name.trim()) {
      toast({
        title: 'Nome obrigatório',
        description: 'Por favor, informe seu nome.',
        variant: 'destructive',
      });
      return;
    }
    
    if (!email || !multitrack) {
      toast({
        title: 'Email obrigatório',
        description: 'Por favor, informe seu email para receber o link de download.',
        variant: 'destructive',
      });
      return;
    }

    if (!validateCpf(cpfNumbers)) {
      toast({
        title: 'CPF inválido',
        description: 'Por favor, informe um CPF válido.',
        variant: 'destructive',
      });
      return;
    }

    if (phoneNumbers.length < 10 || phoneNumbers.length > 11) {
      toast({
        title: 'Celular inválido',
        description: 'Por favor, informe um número de celular válido.',
        variant: 'destructive',
      });
      return;
    }

    setIsProcessing(true);

    try {
      const { data, error } = await supabase.functions.invoke('create-payment', {
        body: {
          multitrack_id: multitrack.id,
          buyer_name: name.trim(),
          buyer_email: email,
          buyer_cpf: cpfNumbers,
          buyer_phone: phoneNumbers,
          amount: multitrack.price,
          multitrack_name: `${multitrack.artist_name} - ${multitrack.song_name}`,
        },
      });

      if (error) throw error;

      if (data.pix_qr_code_image) {
        setPixData({
          qrCodeImage: data.pix_qr_code_image,
          copyPaste: data.pix_copy_paste,
          expiration: data.pix_expiration,
        });
        setSaleId(data.sale_id);
        toast({
          title: 'PIX gerado!',
          description: 'Escaneie o QR Code ou copie o código para pagar.',
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

  if (pixData) {
    const handleCopy = async () => {
      await navigator.clipboard.writeText(pixData.copyPaste);
      setCopied(true);
      toast({
        title: 'Código copiado!',
        description: 'Cole no app do seu banco para pagar.',
      });
      setTimeout(() => setCopied(false), 3000);
    };

    return (
      <div className="container py-8 max-w-lg animate-fade-in">
        <div className="text-center mb-8">
          <div className="h-20 w-20 mx-auto bg-primary/10 rounded-full flex items-center justify-center mb-6">
            <QrCode className="h-10 w-10 text-primary" />
          </div>
          <h1 className="text-3xl font-bold mb-2">Pague com PIX</h1>
          <p className="text-muted-foreground">
            Escaneie o QR Code ou copie o código para pagar
          </p>
        </div>

        {/* Product Summary */}
        <Card className="mb-6">
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
            <div className="text-lg font-bold text-primary">
              R$ {multitrack.price.toFixed(2).replace('.', ',')}
            </div>
          </CardContent>
        </Card>

        {/* QR Code */}
        <Card className="mb-6">
          <CardContent className="p-6 flex flex-col items-center">
            <div className="bg-white p-4 rounded-lg mb-4">
              <img
                src={`data:image/png;base64,${pixData.qrCodeImage}`}
                alt="QR Code PIX"
                className="w-48 h-48"
              />
            </div>
            <p className="text-sm text-muted-foreground text-center mb-4">
              Abra o app do seu banco e escaneie o QR Code acima
            </p>
            
            <div className="w-full">
              <p className="text-sm font-medium mb-2 text-center">Ou copie o código PIX:</p>
              <div className="relative">
                <Input
                  value={pixData.copyPaste}
                  readOnly
                  className="pr-12 text-xs font-mono"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1/2 -translate-y-1/2"
                  onClick={handleCopy}
                >
                  {copied ? (
                    <Check className="h-4 w-4 text-green-500" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="text-center space-y-4">
          <p className="text-sm text-muted-foreground">
            Após o pagamento, você receberá o link de download no email <strong>{email}</strong>
          </p>
          <Link to="/catalog">
            <Button variant="outline" className="w-full">Voltar ao catálogo</Button>
          </Link>
        </div>
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
                <Label htmlFor="name">Nome completo</Label>
                <Input
                  id="name"
                  type="text"
                  placeholder="Seu nome"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>

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
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="cpf">CPF</Label>
                  <Input
                    id="cpf"
                    type="text"
                    placeholder="000.000.000-00"
                    value={cpf}
                    onChange={(e) => setCpf(formatCpf(e.target.value))}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">Celular / WhatsApp</Label>
                  <Input
                    id="phone"
                    type="text"
                    placeholder="(00) 00000-0000"
                    value={phone}
                    onChange={(e) => setPhone(formatPhone(e.target.value))}
                    required
                  />
                </div>
              </div>

              <p className="text-sm text-muted-foreground">
                O link de download será enviado para este email após a confirmação do pagamento.
              </p>

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
