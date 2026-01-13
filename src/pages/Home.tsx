import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Music } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SearchBar } from '@/components/SearchBar';
import { MultitrackCard } from '@/components/MultitrackCard';
import { useMultitracks } from '@/hooks/useMultitracks';

export default function Home() {
  const [searchQuery, setSearchQuery] = useState('');
  const { data: multitracks, isLoading } = useMultitracks(searchQuery);

  const featuredMultitracks = multitracks?.slice(0, 4) || [];

  return (
    <div className="animate-fade-in">
      {/* Hero Section */}
      <section className="py-20 md:py-32 bg-gradient-to-b from-muted/50 to-background">
        <div className="container text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-secondary text-sm font-medium mb-6">
            <Music className="h-4 w-4" />
            Multitracks profissionais
          </div>
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-6 text-balance">
            Multitracks de alta qualidade para sua produção
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
            Encontre as multitracks que você precisa. Stems separados, qualidade profissional, download instantâneo.
          </p>
          <SearchBar 
            onSearch={setSearchQuery} 
            className="max-w-xl mx-auto"
          />
        </div>
      </section>

      {/* Featured Section */}
      <section className="py-16 container">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl md:text-3xl font-bold">
            {searchQuery ? 'Resultados da busca' : 'Destaques'}
          </h2>
          <Link to="/catalog">
            <Button variant="ghost" className="gap-2">
              Ver todos <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="aspect-square bg-muted rounded-lg mb-4" />
                <div className="h-4 bg-muted rounded w-3/4 mb-2" />
                <div className="h-4 bg-muted rounded w-1/2" />
              </div>
            ))}
          </div>
        ) : featuredMultitracks.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {featuredMultitracks.map((multitrack) => (
              <MultitrackCard key={multitrack.id} multitrack={multitrack} />
            ))}
          </div>
        ) : (
          <div className="text-center py-16">
            <Music className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold mb-2">
              {searchQuery ? 'Nenhum resultado encontrado' : 'Nenhuma multitrack disponível'}
            </h3>
            <p className="text-muted-foreground">
              {searchQuery 
                ? 'Tente buscar por outro termo.' 
                : 'Volte mais tarde para conferir nosso catálogo.'}
            </p>
          </div>
        )}
      </section>

      {/* CTA Section */}
      <section className="py-16 bg-primary text-primary-foreground">
        <div className="container text-center">
          <h2 className="text-2xl md:text-3xl font-bold mb-4">
            Não encontrou o que procura?
          </h2>
          <p className="text-primary-foreground/80 mb-6">
            Navegue por todo o nosso catálogo de multitracks.
          </p>
          <Link to="/catalog">
            <Button variant="secondary" size="lg">
              Ver catálogo completo
            </Button>
          </Link>
        </div>
      </section>
    </div>
  );
}
