import { useState, useMemo } from 'react';
import {
  format,
  startOfDay,
  endOfDay,
  subDays,
  isWithinInterval,
  eachDayOfInterval,
  startOfWeek,
  startOfMonth,
  startOfYear,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Music, ShoppingCart, Loader2, Calendar, TrendingUp, RefreshCw, Send, Download, Receipt, Percent } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
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
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, LineChart, Line, CartesianGrid } from 'recharts';
import { useSales } from '@/hooks/useSales';

const statusLabels: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  pending: { label: 'Pendente', variant: 'secondary' },
  paid: { label: 'Pago', variant: 'default' },
  failed: { label: 'Falhou', variant: 'destructive' },
};

const periodOptions = [
  { value: 'today', label: 'Hoje' },
  { value: 'week', label: 'Esta semana' },
  { value: 'month', label: 'Este mês' },
  { value: 'year', label: 'Este ano' },
  { value: '7', label: 'Últimos 7 dias' },
  { value: '30', label: 'Últimos 30 dias' },
  { value: '90', label: 'Últimos 90 dias' },
];

const chartConfig = {
  vendas: {
    label: "Vendas",
    color: "hsl(var(--primary))",
  },
  receita: {
    label: "Receita",
    color: "hsl(var(--success))",
  },
};

export default function AdminSales() {
  const { data: sales, isLoading } = useSales();
  const [period, setPeriod] = useState('30');
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const verifyPayment = useMutation({
    mutationFn: async (saleId: string) => {
      const { data, error } = await supabase.functions.invoke('verify-payment', {
        body: { sale_id: saleId },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      if (data.already_paid) {
        toast({ title: 'Essa venda já estava marcada como paga.' });
      } else if (data.confirmed) {
        toast({ title: 'Pagamento confirmado na Asaas!', description: 'Arquivo compartilhado com o comprador.' });
        queryClient.invalidateQueries({ queryKey: ['sales'] });
        queryClient.invalidateQueries({ queryKey: ['sales-stats'] });
      } else {
        toast({
          title: 'Pagamento ainda não confirmado',
          description: data.message || `Status na Asaas: ${data.asaas_status}`,
          variant: 'destructive',
        });
      }
    },
    onError: (error: any) => {
      toast({ title: 'Erro ao verificar pagamento', description: error.message, variant: 'destructive' });
    },
  });

  const resendDownload = useMutation({
    mutationFn: async (saleId: string) => {
      const { data, error } = await supabase.functions.invoke('resend-download', {
        body: { sale_id: saleId },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast({ title: 'Download reenviado!', description: `E-mail enviado para ${data.sent_to}.` });
    },
    onError: (error: any) => {
      toast({ title: 'Erro ao reenviar download', description: error.message, variant: 'destructive' });
    },
  });

  // Filter sales by period
  const { filteredSales, startDate, endDate } = useMemo(() => {
    const now = new Date();
    let start: Date;
    switch (period) {
      case 'today':
        start = startOfDay(now);
        break;
      case 'week':
        start = startOfWeek(now, { weekStartsOn: 0 });
        break;
      case 'month':
        start = startOfMonth(now);
        break;
      case 'year':
        start = startOfYear(now);
        break;
      default:
        start = startOfDay(subDays(now, parseInt(period)));
    }
    const end = endOfDay(now);

    if (!sales) return { filteredSales: [], startDate: start, endDate: end };

    const filtered = sales.filter((sale) =>
      isWithinInterval(new Date(sale.created_at), { start, end })
    );

    return { filteredSales: filtered, startDate: start, endDate: end };
  }, [sales, period]);

  // Generate chart data for all days in period
  const chartData = useMemo(() => {
    const days = eachDayOfInterval({ start: startDate, end: endDate });
    
    return days.map((day) => {
      const dayStart = startOfDay(day);
      const dayEnd = endOfDay(day);
      
      const daySales = filteredSales.filter((sale) =>
        isWithinInterval(new Date(sale.created_at), { start: dayStart, end: dayEnd })
      );

      const vendas = daySales.length;
      const receita = daySales
        .filter((s) => s.payment_status === 'paid')
        .reduce((sum, s) => sum + Number(s.amount), 0);

      return {
        date: format(day, 'dd/MM'),
        fullDate: format(day, 'dd/MM/yyyy'),
        vendas,
        receita,
      };
    });
  }, [filteredSales, startDate, endDate]);

  // Group sales by day for table
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
    const paidSales = filteredSales.filter((s) => s.payment_status === 'paid');
    const totalRevenue = paidSales.reduce((sum, s) => sum + Number(s.amount), 0);
    const pendingRevenue = filteredSales
      .filter((s) => s.payment_status === 'pending')
      .reduce((sum, s) => sum + Number(s.amount), 0);
    const averageTicket = paidSales.length > 0 ? totalRevenue / paidSales.length : 0;
    const conversionRate = totalSales > 0 ? (paidSales.length / totalSales) * 100 : 0;

    return { totalSales, totalRevenue, pendingRevenue, averageTicket, conversionRate };
  }, [filteredSales]);

  const handleExportCsv = () => {
    const header = ['Data', 'Música', 'Artista', 'Comprador', 'Valor', 'Status'];
    const rows = filteredSales.map((sale) => [
      format(new Date(sale.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR }),
      sale.multitrack?.song_name || 'N/A',
      sale.multitrack?.artist_name || 'N/A',
      sale.buyer_email,
      Number(sale.amount).toFixed(2).replace('.', ','),
      (statusLabels[sale.payment_status] || statusLabels.pending).label,
    ]);

    // Escape quotes/commas per RFC 4180 so accented names and commas don't break columns.
    const escapeCell = (cell: string) => `"${cell.replace(/"/g, '""')}"`;
    const csv = [header, ...rows].map((row) => row.map(escapeCell).join(',')).join('\r\n');

    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `vendas-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">Vendas</h2>
          <p className="text-muted-foreground">
            Histórico de todas as vendas realizadas
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" className="gap-2" onClick={handleExportCsv} disabled={filteredSales.length === 0}>
            <Download className="h-4 w-4" />
            Exportar CSV
          </Button>
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
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-5">
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
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Ticket Médio
            </CardTitle>
            <Receipt className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              R$ {totals.averageTicket.toFixed(2).replace('.', ',')}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Taxa de Conversão
            </CardTitle>
            <Percent className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {totals.conversionRate.toFixed(1).replace('.', ',')}%
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Sales Chart */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Vendas por Dia</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[250px] w-full">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis 
                  dataKey="date" 
                  tickLine={false} 
                  axisLine={false}
                  fontSize={12}
                  tickMargin={8}
                />
                <YAxis 
                  tickLine={false} 
                  axisLine={false}
                  fontSize={12}
                  tickMargin={8}
                  allowDecimals={false}
                />
                <ChartTooltip 
                  content={<ChartTooltipContent />}
                  cursor={{ fill: 'hsl(var(--muted))' }}
                />
                <Bar 
                  dataKey="vendas" 
                  fill="hsl(var(--primary))" 
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Receita por Dia</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[250px] w-full">
              <LineChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis 
                  dataKey="date" 
                  tickLine={false} 
                  axisLine={false}
                  fontSize={12}
                  tickMargin={8}
                />
                <YAxis 
                  tickLine={false} 
                  axisLine={false}
                  fontSize={12}
                  tickMargin={8}
                  tickFormatter={(value) => `R$${value}`}
                />
                <ChartTooltip 
                  content={<ChartTooltipContent formatter={(value) => `R$ ${Number(value).toFixed(2).replace('.', ',')}`} />}
                />
                <Line 
                  type="monotone"
                  dataKey="receita" 
                  stroke="hsl(142 76% 36%)"
                  strokeWidth={2}
                  dot={{ fill: 'hsl(142 76% 36%)', strokeWidth: 0, r: 3 }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      {/* Sales by Day Table */}
      {salesByDay.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Resumo por Dia</CardTitle>
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
                  <TableHead className="text-right">Ações</TableHead>
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
                      <TableCell className="text-right">
                        {sale.payment_status === 'pending' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="gap-1.5"
                            disabled={verifyPayment.isPending}
                            onClick={() => verifyPayment.mutate(sale.id)}
                          >
                            {verifyPayment.isPending && verifyPayment.variables === sale.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <RefreshCw className="h-3.5 w-3.5" />
                            )}
                            Verificar status
                          </Button>
                        )}
                        {sale.payment_status === 'paid' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="gap-1.5"
                            disabled={resendDownload.isPending}
                            onClick={() => resendDownload.mutate(sale.id)}
                          >
                            {resendDownload.isPending && resendDownload.variables === sale.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Send className="h-3.5 w-3.5" />
                            )}
                            Reenviar download
                          </Button>
                        )}
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
                Nenhuma venda encontrada neste período.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}