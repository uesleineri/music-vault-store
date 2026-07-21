import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StarRatingProps {
  value: number;
  onChange?: (value: number) => void;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeClasses = { sm: 'h-3.5 w-3.5', md: 'h-5 w-5', lg: 'h-7 w-7' };

// Read-only when `onChange` is omitted (product pages, review lists);
// interactive picker when passed (the review submission form).
export function StarRating({ value, onChange, size = 'md', className }: StarRatingProps) {
  const interactive = !!onChange;

  return (
    <div className={cn('flex items-center gap-0.5', className)}>
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={!interactive}
          onClick={() => onChange?.(star)}
          className={cn(!interactive && 'cursor-default')}
          aria-label={`${star} estrela${star > 1 ? 's' : ''}`}
        >
          <Star
            className={cn(
              sizeClasses[size],
              star <= value ? 'fill-yellow-400 text-yellow-400' : 'fill-transparent text-muted-foreground'
            )}
          />
        </button>
      ))}
    </div>
  );
}
