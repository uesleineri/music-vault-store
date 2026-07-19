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
import { Loader2, Calendar, TrendingUp, TrendingDown, Wallet, Download, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { useSales } from '@/hooks/useSales';

const periodOptions = [
  { value: 'today', label: 'Hoje' },
  { value: 'week', label: 'Esta semana' },
  { value: 'month', label: 'Este mês' },
  { value: 'year', label: 'Este ano' },
  { value: '7', label: 'Últimos 7 dias' },
  { value: '30', label: 'Últimos 30 dias' },
  { value: '90', label: 'Últimos 90 dias' },
  { value: 'all', label: 'Todo o período' },
];

const chartConfig = {
  liquido: {
    label: 'Líquido',
    color: 'hsl(var(--success))',
  },
  taxas: {
    label: 'Taxas',
    color: 'hsl(var(--destructive))',
  },
};

const formatBRL = (value: number) => `R$ ${value.toFixed(2).replace('.', ',')}`;

export default function AdminFinancial() {
  const { data: sales, isLoading } = useSales();
  const [period, setPeriod] = useState('30');

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
      case 'all':
        start = sales && sales.length > 0
          ? startOfDay(new Date(Math.min(...sales.map((s) => new Date(s.created_at).getTime()))))
          : startOfDay(now);
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

  const paidSales = useMemo(
    () => filteredSales.filter((s) => s.payment_status === 'paid'),
    [filteredSales]
  );

  // Sales confirmed before the fee columns existed don't have asaas_fee/net_amount
  // captured - treat their fee as unknown (0) rather than guessing, and flag it.
  const totals = useMemo(() => {
    const grossRevenue = paidSales.reduce((sum, s) => sum + Number(s.amount), 0);
    const totalFees = paidSales.reduce((sum, s) => sum + Number(s.asaas_fee ?? 0), 0);
    const netProfit = grossRevenue - totalFees;
    const feeRate = grossRevenue > 0 ? (totalFees / grossRevenue) * 100 : 0;
    const salesMissingFeeData = paidSales.filter((s) => s.asaas_fee == null).length;

    return { grossRevenue, totalFees, netProfit, feeRate, salesMissingFeeData };
  }, [paidSales]);

  const chartData = useMemo(() => {
    const days = eachDayOfInterval({ start: startDate, end: endDate });

    return days.map((day) => {
      const dayStart = startOfDay(day);
      const dayEnd = endOfDay(day);

      const dayPaidSales = paidSales.filter((sale) =>
        isWithinInterval(new Date(sale.created_at), { start: dayStart, end: dayEnd })
      );

      const bruta = dayPaidSales.reduce((sum, s) => sum + Number(s.amount), 0);
      const taxas = dayPaidSales.reduce((sum, s) => sum + Number(s.asaas_fee ?? 0), 0);
      const liquido = bruta - taxas;

      return {
        date: format(day, 'dd/MM'),
        fullDate: format(day, 'dd/MM/yyyy'),
        bruta,
        taxas,
        liquido,
      };
    });
  }, [paidSales, startDate, endDate]);

  const salesByDay = useMemo(() => {
    const grouped: Record<string, { date: string; bruta: number; taxas: number; liquido: number; missingFee: number }> = {};

    paidSales.forEach((sale) => {
      const dateKey = format(new Date(sale.created_at), 'yyyy-MM-dd');
      const dateLabel = format(new Date(sale.created_at), "dd/MM/yyyy (EEEE)", { locale: ptBR });

      if (!grouped[dateKey]) {
        grouped[dateKey] = { date: dateLabel, bruta: 0, taxas: 0, liquido: 0, missingFee: 0 };
      }

      const fee = Number(sale.asaas_fee ?? 0);
      grouped[dateKey].bruta += Number(sale.amount);
      grouped[dateKey].taxas += fee;
      grouped[dateKey].liquido += Number(sale.amount) - fee;
      if (sale.asaas_fee == null) grouped[dateKey].missingFee++;
    });

    return Object.entries(grouped)
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([key, value]) => ({ key, ...value }));
  }, [paidSales]);

  const handleExportCsv = () => {
    const header = ['Data', 'Música', 'Artista', 'Comprador', 'Receita Bruta', 'Taxa Asaas', 'Lucro Líquido'];
    const rows = paidSales.map((sale) => {
      const fee = sale.asaas_fee != null ? Number(sale.asaas_fee) : null;
      const net = fee != null ? Number(sale.amount) - fee : null;
      return [
        format(new Date(sale.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR }),
        sale.multitrack?.song_name || 'N/A',
        sale.multitrack?.artist_name || 'N/A',
        sale.buyer_email,
        Number(sale.amount).toFixed(2).replace('.', ','),
        fee != null ? fee.toFixed(2).replace('.', ',') : 'N/D',
        net != null ? net.toFixed(2).replace('.', ',') : 'N/D',
      ];
    });

    const escapeCell = (cell: string) => `"${cell.replace(/"/g, '""')}"`;
    const csv = [header, ...rows].map((row) => row.map(escapeCell).join(',')).join('\r\n');

    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `financeiro-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">Financeiro</h2>
          <p className="text-muted-foreground">
            Receita bruta, taxas da Asaas e lucro líquido
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" className="gap-2" onClick={handleExportCsv} disabled={paidSales.length === 0}>
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

      {totals.salesMissingFeeData > 0 && (
        <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-foreground">
          <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0 text-destructive" />
          <p>
            {totals.salesMissingFeeData} venda(s) pagas neste período não têm a taxa da Asaas
            registrada (confirmadas antes do módulo financeiro existir) — foram contadas com taxa
            R$ 0,00, então "Taxas" e "Lucro Líquido" estão levemente superestimados até que os
            dados fiquem completos.
          </p>
        </div>
      )}

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Receita Bruta
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatBRL(totals.grossRevenue)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Taxas Asaas
            </CardTitle>
            <TrendingDown className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">
              {formatBRL(totals.totalFees)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Lucro Líquido
            </CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success">
              {formatBRL(totals.netProfit)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Taxa Média
            </CardTitle>
            <TrendingDown className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {totals.feeRate.toFixed(1).replace('.', ',')}%
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Líquido x Taxas por Dia</CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer config={chartConfig} className="h-[280px] w-full">
            <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }} stackOffset="sign">
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
                content={<ChartTooltipContent formatter={(value) => formatBRL(Number(value))} />}
                cursor={{ fill: 'hsl(var(--muted))' }}
              />
              <Bar dataKey="liquido" stackId="a" fill="hsl(var(--success))" radius={[4, 4, 0, 0]} />
              <Bar dataKey="taxas" stackId="a" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>

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
                  <TableHead className="text-right">Bruta</TableHead>
                  <TableHead className="text-right">Taxas</TableHead>
                  <TableHead className="text-right">Líquido</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {salesByDay.map((day) => (
                  <TableRow key={day.key}>
                    <TableCell className="font-medium">
                      {day.date}
                      {day.missingFee > 0 && (
                        <span className="ml-1.5 text-xs text-muted-foreground">
                          ({day.missingFee} sem dado de taxa)
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">{formatBRL(day.bruta)}</TableCell>
                    <TableCell className="text-right text-destructive">{formatBRL(day.taxas)}</TableCell>
                    <TableCell className="text-right text-success">{formatBRL(day.liquido)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {isLoading && (
        <div className="p-8 text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">Carregando...</p>
        </div>
      )}

      {!isLoading && paidSales.length === 0 && (
        <div className="p-8 text-center text-muted-foreground">
          Nenhuma venda paga neste período.
        </div>
      )}
    </div>
  );
}
