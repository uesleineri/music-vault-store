import { Music, DollarSign, ShoppingCart, TrendingUp, TrendingDown, Clock, HardDrive, Percent, Receipt } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useMultitracks } from '@/hooks/useMultitracks';
import { useSalesStats, useTopSelling, useSales, useStagnantProducts } from '@/hooks/useSales';
import { supabase } from '@/integrations/supabase/client';

const statusLabels: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' }> = {
  pending: { label: 'Pendente', variant: 'secondary' },
  paid: { label: 'Pago', variant: 'default' },
  failed: { label: 'Falhou', variant: 'destructive' },
};

function formatBytes(bytes: number) {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

function useDriveUsage() {
  return useQuery({
    queryKey: ['drive-usage'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('drive-usage');
      if (error) throw error;
      return data as {
        email: string;
        usage: number;
        usageInDrive: number;
        limit: number | null;
        appFolderBytes: number;
        appFolderFileCount: number;
      };
    },
    staleTime: 5 * 60 * 1000,
  });
}

export default function AdminDashboard() {
  const { data } = useMultitracks({ includeInactive: true });
  const { data: stats } = useSalesStats();
  const { data: topSelling } = useTopSelling();
  const { data: sales } = useSales();
  const { data: stagnantProducts } = useStagnantProducts();
  const { data: driveUsage, isLoading: isDriveLoading } = useDriveUsage();

  const recentSales = sales?.slice(0, 5) ?? [];

  const statCards = [
    {
      title: 'Total de Multitracks',
      value: data?.totalCount || 0,
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
    {
      title: 'Ticket Médio',
      value: `R$ ${(stats?.averageTicket || 0).toFixed(2).replace('.', ',')}`,
      icon: Receipt,
    },
    {
      title: 'Taxa de Conversão',
      value: `${(stats?.conversionRate || 0).toFixed(1).replace('.', ',')}%`,
      icon: Percent,
    },
  ];

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Stats Grid */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-5">
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

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
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

        {/* Recent Sales */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Vendas Recentes
            </CardTitle>
          </CardHeader>
          <CardContent>
            {recentSales.length > 0 ? (
              <div className="space-y-4">
                {recentSales.map((sale) => {
                  const status = statusLabels[sale.payment_status] || statusLabels.pending;
                  return (
                    <div key={sale.id} className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded bg-muted flex items-center justify-center flex-shrink-0">
                        {sale.multitrack?.cover_url ? (
                          <img
                            src={sale.multitrack.cover_url}
                            alt={sale.multitrack.song_name}
                            className="h-full w-full object-cover rounded"
                          />
                        ) : (
                          <Music className="h-5 w-5 text-muted-foreground" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{sale.multitrack?.song_name || 'N/A'}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {sale.buyer_email} · {format(new Date(sale.created_at), "dd/MM 'às' HH:mm", { locale: ptBR })}
                        </p>
                      </div>
                      <Badge variant={status.variant}>{status.label}</Badge>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Nenhuma venda registrada ainda.</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Stagnant Products */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingDown className="h-5 w-5" />
              Produtos Estagnados
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stagnantProducts && stagnantProducts.length > 0 ? (
              <div className="space-y-4 max-h-72 overflow-y-auto">
                {stagnantProducts.map((mt) => (
                  <div key={mt.id} className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded bg-muted flex items-center justify-center flex-shrink-0">
                      {mt.cover_url ? (
                        <img src={mt.cover_url} alt={mt.song_name} className="h-full w-full object-cover rounded" />
                      ) : (
                        <Music className="h-5 w-5 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{mt.song_name}</p>
                      <p className="text-xs text-muted-foreground truncate">{mt.artist_name}</p>
                    </div>
                    {!mt.is_active && <Badge variant="secondary">Despublicada</Badge>}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <TrendingDown className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Todas as músicas já venderam pelo menos uma vez.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Drive Usage */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HardDrive className="h-5 w-5" />
            Uso do Google Drive
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isDriveLoading ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : driveUsage ? (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{driveUsage.email}</span>
                <span className="font-medium">
                  {formatBytes(driveUsage.usage)}
                  {driveUsage.limit ? ` de ${formatBytes(driveUsage.limit)}` : ' (sem limite definido)'}
                </span>
              </div>
              {driveUsage.limit && (
                <Progress value={(driveUsage.usage / driveUsage.limit) * 100} className="h-2" />
              )}
              <p className="text-xs text-muted-foreground">
                Uso total da sua conta do Drive (inclui outros arquivos, não só as multitracks).
              </p>
              <div className="flex justify-between text-sm pt-2 mt-2 border-t">
                <span className="text-muted-foreground">Pasta "Gospel VS - Multitracks"</span>
                <span className="font-medium">
                  {formatBytes(driveUsage.appFolderBytes)} · {driveUsage.appFolderFileCount} arquivo
                  {driveUsage.appFolderFileCount === 1 ? '' : 's'}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Calculado somando o tamanho de cada arquivo (o Drive não mostra isso por pasta).
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Não foi possível carregar o uso do Drive.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
