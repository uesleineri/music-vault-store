import { cn } from '@/lib/utils';

interface PasswordStrengthMeterProps {
  password: string;
  className?: string;
}

const LEVELS = [
  { label: 'Muito fraca', color: 'bg-destructive' },
  { label: 'Fraca', color: 'bg-destructive' },
  { label: 'Média', color: 'bg-amber-500' },
  { label: 'Forte', color: 'bg-amber-500' },
  { label: 'Muito forte', color: 'bg-success' },
];

// Purely informational - doesn't block submission beyond the existing
// 6-character minimum in SetPassword.tsx. Scores 0-4 from five independent
// criteria (length counts once it clears 8, not per extra character).
function scorePassword(password: string): number {
  if (!password) return 0;
  const criteria = [
    password.length >= 8,
    /[a-z]/.test(password),
    /[A-Z]/.test(password),
    /[0-9]/.test(password),
    /[^a-zA-Z0-9]/.test(password),
  ];
  const met = criteria.filter(Boolean).length;
  return Math.max(0, met - 1); // 1 criterion met (e.g. just lowercase) still reads as "muito fraca"
}

export function PasswordStrengthMeter({ password, className }: PasswordStrengthMeterProps) {
  if (!password) return null;

  const score = scorePassword(password);
  const level = LEVELS[score];

  return (
    <div className={cn('space-y-1.5', className)}>
      <div className="flex gap-1">
        {LEVELS.slice(1).map((_, index) => (
          <div
            key={index}
            className={cn('h-1.5 flex-1 rounded-full bg-muted transition-colors', index <= score - 1 && level.color)}
          />
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        Força da senha: <span className="font-medium">{level.label}</span> - use maiúsculas, minúsculas, números e
        símbolos para uma senha mais forte.
      </p>
    </div>
  );
}
