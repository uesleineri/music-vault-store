import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Loader2, Copy, Check, QrCode, Tag, X, CheckCircle2, Download, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CheckoutStepper } from '@/components/CheckoutStepper';
import { PixCountdown } from '@/components/PixCountdown';
import { CardPaymentBrick } from '@/components/checkout/CardPaymentBrick';
import { useMercadoPagoSdk } from '@/hooks/useMercadoPagoSdk';
import { usePaymentStatusPoll } from '@/hooks/usePaymentStatusPoll';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { getFunctionErrorMessage } from '@/lib/functionError';
import { logFunnelEvent } from '@/lib/funnel';
import { formatCpf, validateCpf, formatPhone } from '@/lib/buyerInfo';

type CartItemPayload = { multitrack_id: string } | { bundle_id: string };
type AppliedCoupon = { code: string; discountAmount: number; finalPrice: number };
type PixResult = { qrCodeImage: string; copyPaste: string; expiration: string; amount: number };
type CardResult = { status: string; statusDetail: string; amount: number };

export interface CheckoutFormProps {
  items: CartItemPayload[];
  funnelProductRef: string;
  basePrice: number;
  // "Resumo do pedido" card shown on the data-entry step - each page builds
  // its own (single product, kit, or cart list).
  orderSummaryCard: React.ReactNode;
  // Compact summary shown on the Pix/card-result screens, given the final amount.
  compactSummary: (amount: number) => React.ReactNode;
  downloadEmailNote: string;
  dadosBackLink: string;
  dadosBackLabel: string;
  catalogBackLink: string;
  catalogBackLabel: string;
  onOrderPlaced?: () => void;
}

// Shared by Checkout.tsx (single multitrack), KitCheckout.tsx (bundle), and
// CartCheckout.tsx (multi-item cart) - the only real differences between the
// three are which `items` payload they send and how they render their order
// summary. Everything else (buyer form, coupon, Pix vs. card, poll for
// confirmation) is identical and used to be triplicated.
export function CheckoutForm({
  items,
  funnelProductRef,
  basePrice,
  orderSummaryCard,
  compactSummary,
  downloadEmailNote,
  dadosBackLink,
  dadosBackLabel,
  catalogBackLink,
  catalogBackLabel,
  onOrderPlaced,
}: CheckoutFormProps) {
  const { toast } = useToast();
  const mp = useMercadoPagoSdk();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [cpf, setCpf] = useState('');
  const [phone, setPhone] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'pix' | 'credit_card'>('pix');
  const [isProcessing, setIsProcessing] = useState(false);

  const [couponCode, setCouponCode] = useState('');
  const [isCheckingCoupon, setIsCheckingCoupon] = useState(false);
  const [appliedCoupon, setAppliedCoupon] = useState<AppliedCoupon | null>(null);

  const [pixResult, setPixResult] = useState<PixResult | null>(null);
  const [cardResult, setCardResult] = useState<CardResult | null>(null);
  const [saleId, setSaleId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const { status: paymentStatus, downloadToken } = usePaymentStatusPoll(saleId, !!pixResult);

  const cpfNumbers = cpf.replace(/\D/g, '');
  const phoneNumbers = phone.replace(/\D/g, '');
  const buyerInfoValid =
    !!name.trim() &&
    !!email &&
    validateCpf(cpfNumbers) &&
    phoneNumbers.length >= 10 &&
    phoneNumbers.length <= 11 &&
    acceptedTerms;

  const handleApplyCoupon = async () => {
    if (!couponCode.trim() || items.length === 0) return;
    setIsCheckingCoupon(true);
    try {
      const { data, error } = await supabase.functions.invoke('validate-coupon', {
        body: { code: couponCode.trim(), items },
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

  const submitOrder = async (cardData?: { token: string; payment_method_id: string; installments: number; payment_type_id: string }) => {
    const { data, error } = await supabase.functions.invoke('create-payment', {
      body: {
        items,
        buyer_name: name.trim(),
        buyer_email: email,
        buyer_cpf: cpfNumbers,
        buyer_phone: phoneNumbers,
        coupon_code: appliedCoupon?.code,
        payment_method: cardData ? 'credit_card' : 'pix',
        ...(cardData
          ? {
              card_token: cardData.token,
              card_payment_method_id: cardData.payment_method_id,
              card_installments: cardData.installments,
              // Debit cards rejected as "insufficient_amount" when sent as
              // credit_card - the Brick's own paymentTypeId tells us which it
              // really is (a card's brand id like "master" doesn't).
              card_payment_type_id: cardData.payment_type_id,
            }
          : {}),
      },
    });
    if (error) throw error;
    if (data.error) throw new Error(data.error);
    return data;
  };

  const handlePixSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (paymentMethod !== 'pix') return;
    if (!buyerInfoValid) {
      toast({
        title: 'Confira seus dados',
        description: 'Nome, e-mail, CPF, celular e o aceite dos termos são obrigatórios.',
        variant: 'destructive',
      });
      return;
    }

    setIsProcessing(true);
    try {
      const data = await submitOrder();
      if (data.pix_qr_code_image) {
        setPixResult({
          qrCodeImage: data.pix_qr_code_image,
          copyPaste: data.pix_copy_paste,
          expiration: data.pix_expiration,
          amount: data.amount,
        });
        setSaleId(data.sale_id);
        logFunnelEvent('pix_generated', { checkoutGroupId: data.sale_id, productRef: funnelProductRef });
        onOrderPlaced?.();
        toast({ title: 'PIX gerado!', description: 'Escaneie o QR Code ou copie o código para pagar.' });
      }
    } catch (error: any) {
      toast({ title: 'Erro ao processar', description: await getFunctionErrorMessage(error), variant: 'destructive' });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCardSubmit = async (cardData: { token: string; payment_method_id: string; installments: number; payment_type_id: string }) => {
    setIsProcessing(true);
    try {
      const data = await submitOrder(cardData);
      setCardResult({ status: data.status, statusDetail: data.status_detail, amount: data.amount });
      setSaleId(data.sale_id);
      if (data.status === 'processed') {
        logFunnelEvent('pix_generated', { checkoutGroupId: data.sale_id, productRef: funnelProductRef });
        onOrderPlaced?.();
      }
    } catch (error: any) {
      toast({ title: 'Erro ao processar pagamento', description: await getFunctionErrorMessage(error), variant: 'destructive' });
      throw error;
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCopy = async () => {
    if (!pixResult) return;
    await navigator.clipboard.writeText(pixResult.copyPaste);
    setCopied(true);
    toast({ title: 'Código copiado!', description: 'Cole no app do seu banco para pagar.' });
    setTimeout(() => setCopied(false), 3000);
  };

  const isConfirmed = paymentStatus === 'paid' || cardResult?.status === 'processed';

  if (isConfirmed) {
    return (
      <div className="container py-8 max-w-lg animate-fade-in">
        <CheckoutStepper currentStep="concluido" className="mb-8" />
        <div className="text-center mb-8">
          <div className="h-20 w-20 mx-auto bg-success/10 rounded-full flex items-center justify-center mb-6">
            <CheckCircle2 className="h-10 w-10 text-success" />
          </div>
          <h1 className="text-3xl font-bold mb-2">Pagamento confirmado!</h1>
          <p className="text-muted-foreground">
            Enviamos o link de download para <strong>{email}</strong>
          </p>
        </div>
        <div className="space-y-3">
          {downloadToken && (
            <Link to={`/download/${downloadToken}`}>
              <Button size="lg" className="w-full gap-2">
                <Download className="h-5 w-5" />
                Baixar agora
              </Button>
            </Link>
          )}
          <Link to={catalogBackLink}>
            <Button variant="outline" className="w-full">{catalogBackLabel}</Button>
          </Link>
        </div>
      </div>
    );
  }

  if (cardResult) {
    const rejected = cardResult.status === 'rejected';
    return (
      <div className="container py-8 max-w-lg animate-fade-in">
        <CheckoutStepper currentStep="pagamento" className="mb-8" />
        <div className="text-center mb-6">
          <div className={`h-20 w-20 mx-auto rounded-full flex items-center justify-center mb-6 ${rejected ? 'bg-destructive/10' : 'bg-amber-500/10'}`}>
            <AlertCircle className={`h-10 w-10 ${rejected ? 'text-destructive' : 'text-amber-600 dark:text-amber-400'}`} />
          </div>
          <h1 className="text-3xl font-bold mb-2">{rejected ? 'Pagamento não aprovado' : 'Pagamento em análise'}</h1>
          <p className="text-muted-foreground">
            {rejected
              ? 'O cartão foi recusado. Tente novamente com outro cartão ou pague com Pix.'
              : 'Seu pagamento está em análise. Assim que for aprovado, o link de download chega no seu e-mail.'}
          </p>
        </div>
        {compactSummary(cardResult.amount)}
        <div className="space-y-3 mt-6">
          {rejected && (
            <Button size="lg" className="w-full" onClick={() => setCardResult(null)}>
              Tentar novamente
            </Button>
          )}
          <Link to={catalogBackLink}>
            <Button variant="outline" className="w-full">{catalogBackLabel}</Button>
          </Link>
        </div>
      </div>
    );
  }

  if (pixResult) {
    return (
      <div className="container py-8 max-w-lg animate-fade-in">
        <CheckoutStepper currentStep="pagamento" className="mb-8" />

        <div className="text-center mb-6">
          <div className="h-20 w-20 mx-auto bg-primary/10 rounded-full flex items-center justify-center mb-6">
            <QrCode className="h-10 w-10 text-primary" />
          </div>
          <h1 className="text-3xl font-bold mb-2">Pague com PIX</h1>
          <p className="text-muted-foreground">Escaneie o QR Code ou copie o código para pagar</p>
        </div>

        <PixCountdown expiresAt={pixResult.expiration} className="mb-6" />

        {compactSummary(pixResult.amount)}

        <Card className="mb-6 mt-6">
          <CardContent className="p-6 flex flex-col items-center">
            <div className="bg-white p-4 rounded-lg mb-4">
              <img
                src={`data:image/png;base64,${pixResult.qrCodeImage}`}
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
                <Input value={pixResult.copyPaste} readOnly className="pr-12 text-xs font-mono" />
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
          <Link to={catalogBackLink}>
            <Button variant="outline" className="w-full">{catalogBackLabel}</Button>
          </Link>
        </div>
      </div>
    );
  }

  const finalAmount = appliedCoupon ? appliedCoupon.finalPrice : basePrice;

  return (
    <div className="container py-8 max-w-2xl animate-fade-in">
      <Link to={dadosBackLink} className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-8">
        <ArrowLeft className="h-4 w-4" />
        {dadosBackLabel}
      </Link>

      <CheckoutStepper currentStep="dados" className="mb-8" />

      <div className="grid grid-cols-1 gap-8">
        {orderSummaryCard}

        <Card>
          <CardHeader>
            <CardTitle>Finalizar compra</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handlePixSubmit} className="space-y-6">
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

              <p className="text-sm text-muted-foreground">{downloadEmailNote}</p>

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
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleApplyCoupon}
                      disabled={isCheckingCoupon || !couponCode.trim()}
                    >
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
                      <span>R$ {basePrice.toFixed(2).replace('.', ',')}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm text-success mb-1">
                      <span>Desconto ({appliedCoupon.code})</span>
                      <span>- R$ {appliedCoupon.discountAmount.toFixed(2).replace('.', ',')}</span>
                    </div>
                  </>
                )}
                <div className="flex items-center justify-between text-lg font-semibold mb-4">
                  <span>Total</span>
                  <span>R$ {finalAmount.toFixed(2).replace('.', ',')}</span>
                </div>

                <div className="space-y-2 mb-4">
                  <Label>Forma de pagamento</Label>
                  <Tabs value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as 'pix' | 'credit_card')}>
                    <TabsList className="grid grid-cols-2 w-full">
                      <TabsTrigger value="pix">Pix</TabsTrigger>
                      <TabsTrigger value="credit_card">Cartão de crédito</TabsTrigger>
                    </TabsList>
                  </Tabs>
                </div>

                <div className="flex items-start gap-2 mb-4">
                  <Checkbox
                    id="accept-terms"
                    checked={acceptedTerms}
                    onCheckedChange={(checked) => setAcceptedTerms(checked === true)}
                  />
                  <Label htmlFor="accept-terms" className="text-sm font-normal text-muted-foreground leading-snug">
                    Li e aceito os{' '}
                    <Link to="/termos" target="_blank" className="underline hover:no-underline">Termos de Uso</Link>
                    {' '}e a{' '}
                    <Link to="/privacidade" target="_blank" className="underline hover:no-underline">Política de Privacidade</Link>.
                  </Label>
                </div>

                {paymentMethod === 'pix' ? (
                  <div className="flex flex-col sm:flex-row gap-3">
                    <Button type="button" variant="outline" size="lg" className="flex-1" disabled={isProcessing} asChild>
                      <Link to={dadosBackLink}>Voltar</Link>
                    </Button>
                    <Button type="submit" size="lg" className="flex-1" disabled={isProcessing || !acceptedTerms}>
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
                ) : buyerInfoValid ? (
                  <CardPaymentBrick
                    mp={mp}
                    amount={finalAmount}
                    payerEmail={email}
                    onSubmit={handleCardSubmit}
                    onError={(error) => console.error('Card Brick error:', error)}
                  />
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4 border rounded-md bg-muted/30">
                    Preencha seus dados e aceite os termos acima para inserir os dados do cartão.
                  </p>
                )}
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
