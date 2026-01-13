import { Music, DollarSign, ShoppingCart, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useMultitracks } from '@/hooks/useMultitracks';
import { useSalesStats, useTopSelling } from '@/hooks/useSales';

export default function AdminDashboard() {
  const { data: multitracks } = useMultitracks();
  const { data: stats } = useSalesStats();
  const { data: topSelling } = useTopSelling();

  const statCards = [
    {
      title: 'Total de Multitracks',
      value: multitracks?.length || 0,
      icon: Music,
    },
    {
      title: 'Vendas Realizadas',
      value: stats?.totalSales || 0,
      icon: ShoppingCart,
    },
    {
      title: 'Receita Total',
      value: `R$ ${(stats?.totalRevenue || 0).toFixed(2).replace('.', ',')}`,
      icon: DollarSign,
    },
  ];

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-3">
        {statCards.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.title}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {stat.title}
                </CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Top Selling */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Mais Vendidas
          </CardTitle>
        </CardHeader>
        <CardContent>
          {topSelling && topSelling.length > 0 ? (
            <div className="space-y-4">
              {topSelling.map((item, index) => (
                <div key={item.multitrack.id} className="flex items-center gap-4">
                  <div className="text-lg font-bold text-muted-foreground w-6">
                    {index + 1}
                  </div>
                  <div className="h-12 w-12 rounded bg-muted flex items-center justify-center flex-shrink-0">
                    {item.multitrack.cover_url ? (
                      <img
                        src={item.multitrack.cover_url}
                        alt={item.multitrack.song_name}
                        className="h-full w-full object-cover rounded"
                      />
                    ) : (
                      <Music className="h-6 w-6 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{item.multitrack.song_name}</p>
                    <p className="text-sm text-muted-foreground truncate">
                      {item.multitrack.artist_name}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">{item.count} vendas</p>
                    <p className="text-sm text-muted-foreground">
                      R$ {item.multitrack.price.toFixed(2).replace('.', ',')}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <TrendingUp className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhuma venda registrada ainda.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
