import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Package, ShoppingCart, Music } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useBundle } from '@/hooks/useBundles';

export default function KitDetails() {
  const { id } = useParams<{ id: string }>();
  const { data: bundle, isLoading } = useBundle(id || '');

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

  if (!bundle) {
    return (
      <div className="container py-8 text-center">
        <Package className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
        <h1 className="text-2xl font-bold mb-2">Kit não encontrado</h1>
        <p className="text-muted-foreground mb-6">
          O kit que você está procurando não existe ou foi removido.
        </p>
        <Link to="/kits">
          <Button>Voltar aos kits</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="container py-8 animate-fade-in">
      <Link to="/kits" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-8">
        <ArrowLeft className="h-4 w-4" />
        Voltar aos kits
      </Link>

      <div className="grid md:grid-cols-2 gap-8 lg:gap-12">
        <div className="aspect-square rounded-lg overflow-hidden bg-muted">
          {bundle.cover_url ? (
            <img src={bundle.cover_url} alt={bundle.name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Package className="h-24 w-24 text-muted-foreground" />
            </div>
          )}
        </div>

        <div className="flex flex-col">
          <h1 className="text-3xl md:text-4xl font-bold mb-2">{bundle.name}</h1>
          {bundle.description && (
            <p className="text-muted-foreground mb-6">{bundle.description}</p>
          )}

          <Card className="mb-6">
            <CardContent className="p-4">
              <h3 className="font-semibold mb-3">{bundle.items.length} músicas incluídas</h3>
              <ul className="space-y-2">
                {bundle.items.map((item) => (
                  <li key={item.id} className="flex items-center gap-2 text-sm">
                    <Music className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <span className="truncate">
                      {item.multitrack?.artist_name} - {item.multitrack?.song_name}
                    </span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <div className="mt-auto">
            <div className="text-3xl font-bold mb-4">
              R$ {bundle.price.toFixed(2).replace('.', ',')}
            </div>
            <Link to={`/checkout/kit/${bundle.id}`}>
              <Button size="lg" className="w-full md:w-auto gap-2">
                <ShoppingCart className="h-5 w-5" />
                Comprar kit
              </Button>
            </Link>
          </div>

          <p className="text-sm text-muted-foreground mt-6">
            Após a compra, você receberá o link de download de todas as músicas do kit por email.
          </p>
        </div>
      </div>
    </div>
  );
}
