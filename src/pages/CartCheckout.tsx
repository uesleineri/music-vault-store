import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Music, Package, Loader2, Copy, Check, QrCode, Tag, X, ShoppingCart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useCart } from '@/contexts/CartContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { getFunctionErrorMessage } from '@/lib/functionError';
import { logFunnelEvent } from '@/lib/funnel';

export default function CartCheckout() {
  const { items, totalPrice, clear } = useCart();
  const { toast } = useToast();

  // Fires once on mount, off the cart's contents at that moment - items may
  // get cleared later (on successful checkout), which shouldn't retroactively
  // un-fire this.
  useEffect(() => {
    if (items.length > 0) logFunnelEvent('checkout_started', { productRef: 'cart' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [cpf, setCpf] = useState('');
  const [phone, setPhone] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [pixData, setPixData] = useState<{
    qrCodeImage: string;
    copyPaste: string;
    expiration: string;
    amount: number;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  const [couponCode, setCouponCode] = useState('');
  const [isCheckingCoupon, setIsCheckingCoupon] = useState(false);
  const [appliedCoupon, setAppliedCoupon] = useState<{ code: string; discountAmount: number; finalPrice: number } | null>(null);

  const cartItemsPayload = items.map((item) =>
    item.type === 'multitrack' ? { multitrack_id: item.id } : { bundle_id: item.id }
  );

  const formatCpf = (value: string) => {
    const numbers = value.replace(/\D/g, '').slice(0, 11);
    if (numbers.length <= 3) return numbers;
    if (numbers.length <= 6) return `${numbers.slice(0, 3)}.${numbers.slice(3)}`;
    if (numbers.length <= 9) return `${numbers.slice(0, 3)}.${numbers.slice(3, 6)}.${numbers.slice(6)}`;
    return `${numbers.slice(0, 3)}.${numbers.slice(3, 6)}.${numbers.slice(6, 9)}-${numbers.slice(9)}`;
  };

  const validateCpf = (cpfValue: string) => {
    const numbers = cpfValue.replace(/\D/g, '');
    if (numbers.length !== 11) return false;
    if (/^(\d)\1{10}$/.test(numbers)) return false;

    let sum = 0;
    for (let i = 0; i < 9; i++) sum += parseInt(numbers[i]) * (10 - i);
    let remainder = (sum * 10) % 11;
    if (remainder === 10 || remainder === 11) remainder = 0;
    if (remainder !== parseInt(numbers[9])) return false;

    sum = 0;
    for (let i = 0; i < 10; i++) sum += parseInt(numbers[i]) * (11 - i);
    remainder = (sum * 10) % 11;
    if (remainder === 10 || remainder === 11) remainder = 0;
    if (remainder !== parseInt(numbers[10])) return false;

    return true;
  };

  const formatPhone = (value: string) => {
    const numbers = value.replace(/\D/g, '').slice(0, 11);
    if (numbers.length <= 2) return numbers;
    if (numbers.length <= 7) return `(${numbers.slice(0, 2)}) ${numbers.slice(2)}`;
    return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7)}`;
  };

  const handleApplyCoupon = async () => {
    if (!couponCode.trim() || items.length === 0) return;
    setIsCheckingCoupon(true);
    try {
      const { data, error } = await supabase.functions.invoke('validate-coupon', {
        body: { code: couponCode.trim(), items: cartItemsPayload },
      });
      if (error) throw error;

      if (!data.valid) {
        toast({ title: 'Cupom inválido', description: data.error, variant: 'destructive' });
        setAppliedCoupon(null);
        return;
      }

      setAppliedCoupon({
        code: couponCode.trim().toUpperCase(),
        discountAmount: data.discount_amount,
        finalPrice: data.final_price,
      });
      toast({ title: 'Cupom aplicado!', description: `Desconto de R$ ${data.discount_amount.toFixed(2).replace('.', ',')}` });
    } catch (error: any) {
      toast({ title: 'Erro ao validar cupom', description: await getFunctionErrorMessage(error), variant: 'destructive' });
    } finally {
      setIsCheckingCoupon(false);
    }
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    setCouponCode('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const cpfNumbers = cpf.replace(/\D/g, '');
    const phoneNumbers = phone.replace(/\D/g, '');

    if (!name.trim()) {
      toast({ title: 'Nome obrigatório', description: 'Por favor, informe seu nome.', variant: 'destructive' });
      return;
    }

    if (!email || items.length === 0) {
      toast({
        title: 'Email obrigatório',
        description: 'Por favor, informe seu email para receber o link de download.',
        variant: 'destructive',
      });
      return;
    }

    if (!validateCpf(cpfNumbers)) {
      toast({ title: 'CPF inválido', description: 'Por favor, informe um CPF válido.', variant: 'destructive' });
      return;
    }

    if (phoneNumbers.length < 10 || phoneNumbers.length > 11) {
      toast({ title: 'Celular inválido', description: 'Por favor, informe um número de celular válido.', variant: 'destructive' });
      return;
    }

    setIsProcessing(true);

    try {
      const { data, error } = await supabase.functions.invoke('create-payment', {
        body: {
          items: cartItemsPayload,
          buyer_name: name.trim(),
          buyer_email: email,
          buyer_cpf: cpfNumbers,
          buyer_phone: phoneNumbers,
          coupon_code: appliedCoupon?.code,
        },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      if (data.pix_qr_code_image) {
        setPixData({
          qrCodeImage: data.pix_qr_code_image,
          copyPaste: data.pix_copy_paste,
          expiration: data.pix_expiration,
          amount: data.amount,
        });
        logFunnelEvent('pix_generated', { checkoutGroupId: data.sale_id, productRef: 'cart' });
        // The order is placed - clear the cart now so a refresh/back doesn't re-checkout the same items.
        clear();
        toast({ title: 'PIX gerado!', description: 'Escaneie o QR Code ou copie o código para pagar.' });
      }
    } catch (error: any) {
      console.error('Payment error:', error);
      toast({ title: 'Erro ao processar', description: await getFunctionErrorMessage(error), variant: 'destructive' });
    } finally {
      setIsProcessing(false);
    }
  };

  if (items.length === 0 && !pixData) {
    return (
      <div className="container py-8 text-center">
        <ShoppingCart className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
        <h1 className="text-2xl font-bold mb-2">Seu carrinho está vazio</h1>
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
      toast({ title: 'Código copiado!', description: 'Cole no app do seu banco para pagar.' });
      setTimeout(() => setCopied(false), 3000);
    };

    return (
      <div className="container py-8 max-w-lg animate-fade-in">
        <div className="text-center mb-8">
          <div className="h-20 w-20 mx-auto bg-primary/10 rounded-full flex items-center justify-center mb-6">
            <QrCode className="h-10 w-10 text-primary" />
          </div>
          <h1 className="text-3xl font-bold mb-2">Pague com PIX</h1>
          <p className="text-muted-foreground">Escaneie o QR Code ou copie o código para pagar</p>
        </div>

        <Card className="mb-6">
          <CardContent className="p-4 flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Total do pedido</span>
            <span className="text-lg font-bold text-primary">
              R$ {pixData.amount.toFixed(2).replace('.', ',')}
            </span>
          </CardContent>
        </Card>

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
                <Input value={pixData.copyPaste} readOnly className="pr-12 text-xs font-mono" />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1/2 -translate-y-1/2"
                  onClick={handleCopy}
                >
                  {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
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
      <Link to="/cart" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-8">
        <ArrowLeft className="h-4 w-4" />
        Voltar ao carrinho
      </Link>

      <div className="grid gap-8">
        <Card>
          <CardHeader>
            <CardTitle>Resumo do pedido</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {items.map((item) => (
              <div key={`${item.type}-${item.id}`} className="flex items-center gap-4">
                <div className="h-14 w-14 rounded bg-muted flex items-center justify-center flex-shrink-0">
                  {item.cover_url ? (
                    <img src={item.cover_url} alt={item.name} className="h-full w-full object-cover rounded" />
                  ) : item.type === 'bundle' ? (
                    <Package className="h-6 w-6 text-muted-foreground" />
                  ) : (
                    <Music className="h-6 w-6 text-muted-foreground" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{item.name}</p>
                  {item.subtitle && <p className="text-sm text-muted-foreground truncate">{item.subtitle}</p>}
                </div>
                <div className="font-semibold">R$ {item.price.toFixed(2).replace('.', ',')}</div>
              </div>
            ))}
            <div className="border-t pt-3 flex items-center justify-between text-lg font-bold">
              <span>Total</span>
              <span>R$ {totalPrice.toFixed(2).replace('.', ',')}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Finalizar compra</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="name">Nome completo</Label>
                <Input id="name" type="text" placeholder="Seu nome" value={name} onChange={(e) => setName(e.target.value)} required />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email para receber o download</Label>
                <Input id="email" type="email" placeholder="seu@email.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="cpf">CPF</Label>
                  <Input id="cpf" type="text" placeholder="000.000.000-00" value={cpf} onChange={(e) => setCpf(formatCpf(e.target.value))} required />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">Celular / WhatsApp</Label>
                  <Input id="phone" type="text" placeholder="(00) 00000-0000" value={phone} onChange={(e) => setPhone(formatPhone(e.target.value))} required />
                </div>
              </div>

              <p className="text-sm text-muted-foreground">
                O link de download de todos os itens do pedido será enviado para este email após a confirmação do pagamento.
              </p>

              <div className="space-y-2">
                <Label htmlFor="coupon">Cupom de desconto</Label>
                {appliedCoupon ? (
                  <div className="flex items-center justify-between rounded-md border bg-muted/50 px-3 py-2">
                    <span className="flex items-center gap-2 text-sm font-medium">
                      <Tag className="h-4 w-4 text-success" />
                      {appliedCoupon.code} aplicado
                    </span>
                    <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={handleRemoveCoupon}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <Input
                      id="coupon"
                      placeholder="Ex: PROMO10"
                      value={couponCode}
                      onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                    />
                    <Button type="button" variant="outline" onClick={handleApplyCoupon} disabled={isCheckingCoupon || !couponCode.trim()}>
                      {isCheckingCoupon ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Aplicar'}
                    </Button>
                  </div>
                )}
              </div>

              <div className="border-t pt-4">
                {appliedCoupon && (
                  <>
                    <div className="flex items-center justify-between text-sm text-muted-foreground mb-1">
                      <span>Subtotal</span>
                      <span>R$ {totalPrice.toFixed(2).replace('.', ',')}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm text-success mb-1">
                      <span>Desconto ({appliedCoupon.code})</span>
                      <span>- R$ {appliedCoupon.discountAmount.toFixed(2).replace('.', ',')}</span>
                    </div>
                  </>
                )}
                <div className="flex items-center justify-between text-lg font-semibold mb-4">
                  <span>Total a pagar</span>
                  <span>R$ {(appliedCoupon ? appliedCoupon.finalPrice : totalPrice).toFixed(2).replace('.', ',')}</span>
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
