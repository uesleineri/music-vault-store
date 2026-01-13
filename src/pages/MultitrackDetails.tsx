import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Music, ShoppingCart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { AudioPlayer } from '@/components/AudioPlayer';
import { useMultitrack } from '@/hooks/useMultitracks';

export default function MultitrackDetails() {
  const { id } = useParams<{ id: string }>();
  const { data: multitrack, isLoading } = useMultitrack(id || '');

  if (isLoading) {
    return (
      <div className="container py-8">
        <div className="animate-pulse">
          <div className="h-8 bg-muted rounded w-32 mb-8" />
          <div className="grid md:grid-cols-2 gap-8">
            <div className="aspect-square bg-muted rounded-lg" />
            <div className="space-y-4">
              <div className="h-8 bg-muted rounded w-3/4" />
              <div className="h-6 bg-muted rounded w-1/2" />
              <div className="h-12 bg-muted rounded w-1/3" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!multitrack) {
    return (
      <div className="container py-8 text-center">
        <Music className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
        <h1 className="text-2xl font-bold mb-2">Multitrack não encontrada</h1>
        <p className="text-muted-foreground mb-6">
          A multitrack que você está procurando não existe ou foi removida.
        </p>
        <Link to="/catalog">
          <Button>Voltar ao catálogo</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="container py-8 animate-fade-in">
      <Link to="/catalog" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-8">
        <ArrowLeft className="h-4 w-4" />
        Voltar ao catálogo
      </Link>

      <div className="grid md:grid-cols-2 gap-8 lg:gap-12">
        {/* Cover */}
        <div className="aspect-square rounded-lg overflow-hidden bg-muted">
          {multitrack.cover_url ? (
            <img
              src={multitrack.cover_url}
              alt={`${multitrack.artist_name} - ${multitrack.song_name}`}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Music className="h-24 w-24 text-muted-foreground" />
            </div>
          )}
        </div>

        {/* Details */}
        <div className="flex flex-col">
          <h1 className="text-3xl md:text-4xl font-bold mb-2">{multitrack.song_name}</h1>
          <p className="text-xl text-muted-foreground mb-6">{multitrack.artist_name}</p>

          {/* Preview Player */}
          {multitrack.preview_url && (
            <Card className="mb-6">
              <CardContent className="p-0">
                <AudioPlayer src={multitrack.preview_url} />
              </CardContent>
            </Card>
          )}

          <div className="mt-auto">
            <div className="text-3xl font-bold mb-4">
              R$ {multitrack.price.toFixed(2).replace('.', ',')}
            </div>
            <Link to={`/checkout/${multitrack.id}`}>
              <Button size="lg" className="w-full md:w-auto gap-2">
                <ShoppingCart className="h-5 w-5" />
                Comprar agora
              </Button>
            </Link>
          </div>

          <p className="text-sm text-muted-foreground mt-6">
            Após a compra, você receberá o link de download por email e poderá baixar imediatamente.
          </p>
        </div>
      </div>
    </div>
  );
}
