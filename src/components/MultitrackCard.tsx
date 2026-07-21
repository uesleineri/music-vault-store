import { Link } from 'react-router-dom';
import { Music, Star } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { AudioPlayer } from '@/components/AudioPlayer';
import { Multitrack, ReviewSummary } from '@/types/multitrack';
import { cn } from '@/lib/utils';

interface MultitrackCardProps {
  multitrack: Multitrack;
  reviewSummary?: ReviewSummary;
  className?: string;
}

export function MultitrackCard({ multitrack, reviewSummary, className }: MultitrackCardProps) {
  return (
    <Link to={`/multitrack/${multitrack.id}`}>
      <Card className={cn('group overflow-hidden transition-all hover:shadow-lg hover:-translate-y-1', className)}>
        <div className="aspect-square relative overflow-hidden bg-muted">
          {multitrack.cover_url ? (
            <img
              src={multitrack.cover_url}
              alt={`${multitrack.artist_name} - ${multitrack.song_name}`}
              className="object-cover w-full h-full transition-transform group-hover:scale-105"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Music className="h-16 w-16 text-muted-foreground" />
            </div>
          )}
        </div>
        <CardContent className="p-4">
          <h3 className="font-semibold truncate">{multitrack.song_name}</h3>
          <p className="text-sm text-muted-foreground truncate">{multitrack.artist_name}</p>
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
              R$ {multitrack.price.toFixed(2).replace('.', ',')}
            </span>
            {multitrack.preview_url && (
              <div onClick={(e) => e.preventDefault()}>
                <AudioPlayer src={multitrack.preview_url} compact />
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
