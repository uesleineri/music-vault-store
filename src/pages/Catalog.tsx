import { useState } from 'react';
import { Music } from 'lucide-react';
import { SearchBar } from '@/components/SearchBar';
import { MultitrackCard } from '@/components/MultitrackCard';
import { useMultitracks } from '@/hooks/useMultitracks';

export default function Catalog() {
  const [searchQuery, setSearchQuery] = useState('');
  const { data: multitracks, isLoading } = useMultitracks(searchQuery);

  return (
    <div className="container py-8 animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">Catálogo</h1>
          <p className="text-muted-foreground">
            {multitracks?.length || 0} multitracks disponíveis
          </p>
        </div>
        <SearchBar onSearch={setSearchQuery} className="md:w-96" />
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="aspect-square bg-muted rounded-lg mb-4" />
              <div className="h-4 bg-muted rounded w-3/4 mb-2" />
              <div className="h-4 bg-muted rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : multitracks && multitracks.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {multitracks.map((multitrack) => (
            <MultitrackCard key={multitrack.id} multitrack={multitrack} />
          ))}
        </div>
      ) : (
        <div className="text-center py-16">
          <Music className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-xl font-semibold mb-2">
            {searchQuery ? 'Nenhum resultado encontrado' : 'Catálogo vazio'}
          </h3>
          <p className="text-muted-foreground">
            {searchQuery 
              ? 'Tente buscar por outro artista ou música.' 
              : 'Não há multitracks disponíveis no momento.'}
          </p>
        </div>
      )}
    </div>
  );
}
