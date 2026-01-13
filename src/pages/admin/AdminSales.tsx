import { useState, useMemo } from 'react';
import { format, startOfDay, endOfDay, subDays, isWithinInterval } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Music, ShoppingCart, Loader2, Calendar, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useSales } from '@/hooks/useSales';

const statusLabels: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  pending: { label: 'Pendente', variant: 'secondary' },
  paid: { label: 'Pago', variant: 'default' },
  failed: { label: 'Falhou', variant: 'destructive' },
};

const periodOptions = [
  { value: '7', label: 'Últimos 7 dias' },
  { value: '30', label: 'Últimos 30 dias' },
  { value: '90', label: 'Últimos 90 dias' },
  { value: 'all', label: 'Todo o período' },
];

export default function AdminSales() {
  const { data: sales, isLoading } = useSales();
  const [period, setPeriod] = useState('30');

  // Filter sales by period
  const filteredSales = useMemo(() => {
    if (!sales) return [];
    if (period === 'all') return sales;

    const days = parseInt(period);
    const startDate = startOfDay(subDays(new Date(), days));
    const endDate = endOfDay(new Date());

    return sales.filter((sale) =>
      isWithinInterval(new Date(sale.created_at), { start: startDate, end: endDate })
    );
  }, [sales, period]);

  // Group sales by day
  const salesByDay = useMemo(() => {
    const grouped: Record<string, { date: string; count: number; total: number; paid: number }> = {};

    filteredSales.forEach((sale) => {
      const dateKey = format(new Date(sale.created_at), 'yyyy-MM-dd');
      const dateLabel = format(new Date(sale.created_at), "dd/MM/yyyy (EEEE)", { locale: ptBR });

      if (!grouped[dateKey]) {
        grouped[dateKey] = { date: dateLabel, count: 0, total: 0, paid: 0 };
      }

      grouped[dateKey].count++;
      grouped[dateKey].total += Number(sale.amount);
      if (sale.payment_status === 'paid') {
        grouped[dateKey].paid += Number(sale.amount);
      }
    });

    return Object.entries(grouped)
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([key, value]) => ({ key, ...value }));
  }, [filteredSales]);

  // Calculate totals
  const totals = useMemo(() => {
    const totalSales = filteredSales.length;
    const totalRevenue = filteredSales
      .filter((s) => s.payment_status === 'paid')
      .reduce((sum, s) => sum + Number(s.amount), 0);
    const pendingRevenue = filteredSales
      .filter((s) => s.payment_status === 'pending')
      .reduce((sum, s) => sum + Number(s.amount), 0);

    return { totalSales, totalRevenue, pendingRevenue };
  }, [filteredSales]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">Vendas</h2>
          <p className="text-muted-foreground">
            Histórico de todas as vendas realizadas
          </p>
        </div>
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-[180px]">
            <Calendar className="h-4 w-4 mr-2" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {periodOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total de Vendas
            </CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totals.totalSales}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Receita Confirmada
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success">
              R$ {totals.totalRevenue.toFixed(2).replace('.', ',')}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Pendente
            </CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-muted-foreground">
              R$ {totals.pendingRevenue.toFixed(2).replace('.', ',')}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Sales by Day */}
      {salesByDay.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Vendas por Dia</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead className="text-center">Vendas</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Confirmado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {salesByDay.map((day) => (
                  <TableRow key={day.key}>
                    <TableCell className="font-medium">{day.date}</TableCell>
                    <TableCell className="text-center">{day.count}</TableCell>
                    <TableCell className="text-right">
                      R$ {day.total.toFixed(2).replace('.', ',')}
                    </TableCell>
                    <TableCell className="text-right text-success">
                      R$ {day.paid.toFixed(2).replace('.', ',')}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Sales List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Detalhes das Vendas</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center">
              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">Carregando...</p>
            </div>
          ) : filteredSales.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Produto</TableHead>
                  <TableHead>Comprador</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSales.map((sale) => {
                  const status = statusLabels[sale.payment_status] || statusLabels.pending;
                  return (
                    <TableRow key={sale.id}>
                      <TableCell className="text-muted-foreground">
                        {format(new Date(sale.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
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
                          <div className="min-w-0">
                            <p className="font-medium truncate">{sale.multitrack?.song_name || 'N/A'}</p>
                            <p className="text-sm text-muted-foreground truncate">
                              {sale.multitrack?.artist_name || 'N/A'}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{sale.buyer_email}</TableCell>
                      <TableCell className="font-medium">
                        R$ {Number(sale.amount).toFixed(2).replace('.', ',')}
                      </TableCell>
                      <TableCell>
                        <Badge variant={status.variant}>{status.label}</Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <div className="p-8 text-center">
              <ShoppingCart className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <h3 className="font-semibold mb-1">Nenhuma venda</h3>
              <p className="text-muted-foreground">
                {period === 'all' 
                  ? 'As vendas aparecerão aqui quando forem realizadas.'
                  : 'Nenhuma venda encontrada neste período.'}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}