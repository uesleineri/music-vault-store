import { useEffect, useState } from 'react';
import { Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PixCountdownProps {
  expiresAt: string;
  className?: string;
}

function formatRemaining(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return hours > 0 ? `${pad(hours)}h ${pad(minutes)}m ${pad(seconds)}s` : `${pad(minutes)}m ${pad(seconds)}s`;
}

// A ticking per-second countdown only makes sense as urgency messaging when
// the deadline is actually near; past this threshold there's nothing urgent
// to show, so the banner doesn't render at all.
const MAX_DISPLAYED_MS = 24 * 60 * 60 * 1000;

// Counts down to the real expiration Mercado Pago set on this PIX charge
// (pixData.expiration, returned by create-payment) - not an artificial
// urgency timer. Once it hits zero the QR/copy-paste code no longer accepts
// payment, so a fresh checkout is needed.
export function PixCountdown({ expiresAt, className }: PixCountdownProps) {
  const [remainingMs, setRemainingMs] = useState(() => new Date(expiresAt).getTime() - Date.now());

  useEffect(() => {
    const interval = setInterval(() => {
      setRemainingMs(new Date(expiresAt).getTime() - Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  if (remainingMs > MAX_DISPLAYED_MS) return null;

  const expired = remainingMs <= 0;

  return (
    <div
      className={cn(
        'flex items-center justify-center gap-2 rounded-md py-2 px-4 text-sm font-medium',
        expired ? 'bg-destructive/10 text-destructive' : 'bg-amber-500/10 text-amber-700 dark:text-amber-400',
        className
      )}
    >
      <Clock className="h-4 w-4" />
      {expired ? 'PIX expirado - gere um novo código' : `Pague em até ${formatRemaining(remainingMs)}`}
    </div>
  );
}
