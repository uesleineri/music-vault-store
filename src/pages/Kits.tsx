import { Package } from 'lucide-react';
import { BundleCard } from '@/components/BundleCard';
import { useBundles } from '@/hooks/useBundles';

export default function Kits() {
  const { data: bundles, isLoading } = useBundles();

  return (
    <div className="container py-8 animate-fade-in">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Kits promocionais</h1>
        <p className="text-muted-foreground">
          {bundles?.length || 0} kits disponíveis, com várias músicas por um preço fixo
        </p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="aspect-square bg-muted rounded-lg mb-4" />
              <div className="h-4 bg-muted rounded w-3/4 mb-2" />
              <div className="h-4 bg-muted rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : bundles && bundles.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {bundles.map((bundle) => (
            <BundleCard key={bundle.id} bundle={bundle} />
          ))}
        </div>
      ) : (
        <div className="text-center py-16">
          <Package className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-xl font-semibold mb-2">Nenhum kit disponível</h3>
          <p className="text-muted-foreground">Volte em breve para ver nossos kits promocionais.</p>
        </div>
      )}
    </div>
  );
}
