import { useEffect, useRef } from 'react';
import { Loader2 } from 'lucide-react';

interface CardTokenData {
  token: string;
  payment_method_id: string;
  installments: number;
}

interface CardPaymentBrickProps {
  mp: any;
  amount: number;
  payerEmail: string;
  onSubmit: (data: CardTokenData) => Promise<void>;
  onError?: (error: unknown) => void;
  onReady?: () => void;
}

// Mounts Mercado Pago's Card Payment Brick, which owns the entire card form
// (number/name/expiry/cvv/installments) inside an iframe and only ever hands
// this app a single-use token - the real card number never touches our code
// or backend, satisfying PCI requirements without us building a card form.
export function CardPaymentBrick({ mp, amount, payerEmail, onSubmit, onError, onReady }: CardPaymentBrickProps) {
  const containerId = useRef(`card-payment-brick-${Math.random().toString(36).slice(2)}`);
  const controllerRef = useRef<any>(null);

  useEffect(() => {
    if (!mp) return;
    let cancelled = false;

    mp.bricks()
      .create('cardPayment', containerId.current, {
        initialization: { amount, payer: { email: payerEmail } },
        // Deliberately no `customization.paymentMethods` installment
        // restriction here - forcing minInstallments === maxInstallments
        // (tried to cap this store to a single installment) made the Brick's
        // internal installment-plan lookup hang for minutes instead of
        // seconds in testing. Whatever installments value the Brick returns
        // is forwarded as-is; it only affects how the buyer's bank bills the
        // card, not the amount we charge.
        callbacks: {
          // Mercado Pago's docs list onReady and onError as required callbacks
          // ("missing_required_callbacks") - omitting onReady left the Brick
          // stuck on its loading skeleton indefinitely instead of failing
          // loudly, which is exactly the bug we chased for hours.
          onReady: () => onReady?.(),
          onSubmit: (cardFormData: any) =>
            onSubmit({
              token: cardFormData.token,
              payment_method_id: cardFormData.payment_method_id,
              installments: cardFormData.installments,
            }),
          onError: (error: unknown) => onError?.(error),
        },
      })
      .then((controller: any) => {
        if (cancelled) controller.unmount();
        else controllerRef.current = controller;
      });

    return () => {
      cancelled = true;
      controllerRef.current?.unmount();
      controllerRef.current = null;
    };
    // Deliberately mount once per payerEmail/amount pair - the Brick doesn't
    // support live-updating those after mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mp]);

  return (
    <div>
      <div id={containerId.current} />
      {!mp && (
        <div className="flex items-center justify-center gap-2 py-8 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Carregando formulário de cartão...
        </div>
      )}
    </div>
  );
}
