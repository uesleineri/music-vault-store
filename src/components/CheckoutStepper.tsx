import { ShoppingCart, ClipboardList, QrCode, CheckCircle2, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export type CheckoutStep = 'carrinho' | 'dados' | 'pagamento' | 'concluido';

const STEPS: { key: CheckoutStep; label: string; icon: typeof ShoppingCart }[] = [
  { key: 'carrinho', label: 'Carrinho', icon: ShoppingCart },
  { key: 'dados', label: 'Dados', icon: ClipboardList },
  { key: 'pagamento', label: 'Pagamento', icon: QrCode },
  { key: 'concluido', label: 'Concluído', icon: CheckCircle2 },
];

interface CheckoutStepperProps {
  currentStep: CheckoutStep;
  className?: string;
}

// Purely visual progress indicator - the checkout itself stays a single page
// per step (see Checkout.tsx/KitCheckout.tsx/CartCheckout.tsx), this just
// shows the buyer where they are in that page's flow.
export function CheckoutStepper({ currentStep, className }: CheckoutStepperProps) {
  const currentIndex = STEPS.findIndex((s) => s.key === currentStep);

  return (
    <div className={cn('flex items-start', className)}>
      {STEPS.map((step, index) => {
        const isCompleted = index < currentIndex;
        const isActive = index === currentIndex;
        const Icon = isCompleted ? Check : step.icon;

        return (
          <div key={step.key} className="flex items-start flex-1 last:flex-none">
            <div className="flex flex-col items-center gap-1.5 flex-shrink-0">
              <div
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-full border-2 transition-colors',
                  (isActive || isCompleted) && 'border-primary',
                  isActive && 'bg-primary text-primary-foreground',
                  isCompleted && 'bg-primary/10 text-primary',
                  !isActive && !isCompleted && 'border-muted-foreground/30 text-muted-foreground'
                )}
              >
                <Icon className="h-4 w-4" />
              </div>
              <span
                className={cn(
                  'text-xs font-medium whitespace-nowrap',
                  (isActive || isCompleted) && 'text-foreground',
                  !isActive && !isCompleted && 'text-muted-foreground'
                )}
              >
                {step.label}
              </span>
            </div>
            {index < STEPS.length - 1 && (
              <div className={cn('h-px flex-1 mx-2 mt-4', index < currentIndex ? 'bg-primary' : 'bg-border')} />
            )}
          </div>
        );
      })}
    </div>
  );
}
