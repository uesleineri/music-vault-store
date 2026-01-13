import { useState } from 'react';
import { Music, ArrowUpDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { SearchBar } from '@/components/SearchBar';
import { MultitrackCard } from '@/components/MultitrackCard';
import { useMultitracks } from '@/hooks/useMultitracks';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationEllipsis,
} from '@/components/ui/pagination';

type SortBy = 'created_at' | 'artist_name' | 'song_name' | 'price';
type SortOrder = 'asc' | 'desc';

export default function Catalog() {
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState<SortBy>('created_at');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  
  const { data, isLoading } = useMultitracks({ 
    searchQuery, 
    page, 
    pageSize: 12, 
    sortBy, 
    sortOrder 
  });

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    setPage(1);
  };

  const handleSortChange = (value: string) => {
    const [newSortBy, newSortOrder] = value.split('-') as [SortBy, SortOrder];
    setSortBy(newSortBy);
    setSortOrder(newSortOrder);
    setPage(1);
  };

  const renderPaginationItems = () => {
    if (!data) return null;
    const { totalPages, currentPage } = data;
    const items = [];
    
    const showPage = (pageNum: number) => (
      <PaginationItem key={pageNum}>
        <PaginationLink
          onClick={() => setPage(pageNum)}
          isActive={currentPage === pageNum}
          className="cursor-pointer"
        >
          {pageNum}
        </PaginationLink>
      </PaginationItem>
    );

    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) {
        items.push(showPage(i));
      }
    } else {
      items.push(showPage(1));
      
      if (currentPage > 3) {
        items.push(<PaginationItem key="ellipsis-start"><PaginationEllipsis /></PaginationItem>);
      }
      
      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);
      
      for (let i = start; i <= end; i++) {
        items.push(showPage(i));
      }
      
      if (currentPage < totalPages - 2) {
        items.push(<PaginationItem key="ellipsis-end"><PaginationEllipsis /></PaginationItem>);
      }
      
      items.push(showPage(totalPages));
    }
    
    return items;
  };

  return (
    <div className="container py-8 animate-fade-in">
      <div className="flex flex-col gap-4 mb-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold mb-2">Catálogo</h1>
            <p className="text-muted-foreground">
              {data?.totalCount || 0} multitracks disponíveis
            </p>
          </div>
          <SearchBar onSearch={handleSearch} className="md:w-96" />
        </div>
        
        <div className="flex items-center gap-2">
          <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
          <Select 
            value={`${sortBy}-${sortOrder}`} 
            onValueChange={handleSortChange}
          >
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Ordenar por" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="created_at-desc">Mais recentes</SelectItem>
              <SelectItem value="created_at-asc">Mais antigos</SelectItem>
              <SelectItem value="artist_name-asc">Artista (A-Z)</SelectItem>
              <SelectItem value="artist_name-desc">Artista (Z-A)</SelectItem>
              <SelectItem value="song_name-asc">Música (A-Z)</SelectItem>
              <SelectItem value="song_name-desc">Música (Z-A)</SelectItem>
              <SelectItem value="price-asc">Menor preço</SelectItem>
              <SelectItem value="price-desc">Maior preço</SelectItem>
            </SelectContent>
          </Select>
        </div>
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
      ) : data && data.data.length > 0 ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {data.data.map((multitrack) => (
              <MultitrackCard key={multitrack.id} multitrack={multitrack} />
            ))}
          </div>
          
          {data.totalPages > 1 && (
            <div className="mt-8 flex justify-center">
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className="gap-1"
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Anterior
                    </Button>
                  </PaginationItem>
                  
                  {renderPaginationItems()}
                  
                  <PaginationItem>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setPage(p => Math.min(data.totalPages, p + 1))}
                      disabled={page === data.totalPages}
                      className="gap-1"
                    >
                      Próxima
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          )}
        </>
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
