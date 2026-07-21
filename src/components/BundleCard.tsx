import { Link } from 'react-router-dom';
import { Package, Star } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Bundle, ReviewSummary } from '@/types/multitrack';
import { cn } from '@/lib/utils';

interface BundleCardProps {
  bundle: Bundle;
  reviewSummary?: ReviewSummary;
  className?: string;
}

export function BundleCard({ bundle, reviewSummary, className }: BundleCardProps) {
  return (
    <Link to={`/kit/${bundle.id}`}>
      <Card className={cn('group overflow-hidden transition-all hover:shadow-lg hover:-translate-y-1', className)}>
        <div className="aspect-square relative overflow-hidden bg-muted">
          {bundle.cover_url ? (
            <img
              src={bundle.cover_url}
              alt={bundle.name}
              className="object-cover w-full h-full transition-transform group-hover:scale-105"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Package className="h-16 w-16 text-muted-foreground" />
            </div>
          )}
          <Badge className="absolute top-2 left-2">Kit</Badge>
        </div>
        <CardContent className="p-4">
          <h3 className="font-semibold truncate">{bundle.name}</h3>
          {bundle.description && (
            <p className="text-sm text-muted-foreground truncate">{bundle.description}</p>
          )}
          {reviewSummary && (
            <div className="flex items-center gap-1 mt-1">
              <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
              <span className="text-xs text-muted-foreground">
                {reviewSummary.average_rating} ({reviewSummary.review_count})
              </span>
            </div>
          )}
          <div className="flex items-center justify-between mt-3">
            <span className="text-lg font-bold">
              R$ {bundle.price.toFixed(2).replace('.', ',')}
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
