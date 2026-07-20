import { useState, useMemo } from 'react';
import {
  startOfDay,
  endOfDay,
  subDays,
  isWithinInterval,
  startOfWeek,
  startOfMonth,
  startOfYear,
} from 'date-fns';
import { Calendar, MousePointerClick, QrCode, CircleDollarSign, Download } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useFunnelEvents } from '@/hooks/useFunnel';

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

const stages = [
  { type: 'checkout_started' as const, label: 'Checkout iniciado', icon: MousePointerClick, key: 'session_id' as const },
  { type: 'pix_generated' as const, label: 'PIX gerado', icon: QrCode, key: 'session_id' as const },
  { type: 'payment_confirmed' as const, label: 'Pago', icon: CircleDollarSign, key: 'checkout_group_id' as const },
  { type: 'download_completed' as const, label: 'Download realizado', icon: Download, key: 'checkout_group_id' as const },
];

export default function AdminFunnel() {
  const { data: events, isLoading } = useFunnelEvents();
  const [period, setPeriod] = useState('30');

  const filteredEvents = useMemo(() => {
    if (!events) return [];
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
        return events;
      default:
        start = startOfDay(subDays(now, parseInt(period)));
    }
    const end = endOfDay(now);
    return events.filter((e) => isWithinInterval(new Date(e.created_at), { start, end }));
  }, [events, period]);

  // Each stage is counted by distinct visit (session_id) for the first two
  // steps - before a sale row exists - and by distinct order
  // (checkout_group_id) for the last two, once one does.
  const counts = useMemo(() => {
    return stages.map((stage) => {
      const rows = filteredEvents.filter((e) => e.event_type === stage.type);
      const ids = new Set(rows.map((r) => r[stage.key]).filter((id): id is string => !!id));
      return { ...stage, count: ids.size };
    });
  }, [filteredEvents]);

  const maxCount = Math.max(1, ...counts.map((c) => c.count));

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">Funil de Vendas</h2>
          <p className="text-muted-foreground">
            Do checkout iniciado até o download realizado
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

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {counts.map((stage) => {
          const Icon = stage.icon;
          return (
            <Card key={stage.type}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{stage.label}</CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stage.count}</div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Funil</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground text-sm">Carregando...</p>
          ) : maxCount <= 1 && counts.every((c) => c.count === 0) ? (
            <p className="text-muted-foreground text-sm">
              Nenhum evento registrado neste período ainda.
            </p>
          ) : (
            <div className="space-y-4">
              {counts.map((stage, index) => {
                const widthPct = (stage.count / maxCount) * 100;
                const previous = counts[index - 1];
                const dropFromPrevious =
                  previous && previous.count > 0 ? (stage.count / previous.count) * 100 : null;
                return (
                  <div key={stage.type}>
                    <div className="flex items-baseline justify-between mb-1">
                      <span className="text-sm font-medium">{stage.label}</span>
                      <span className="text-sm text-muted-foreground">
                        {stage.count}
                        {dropFromPrevious !== null && (
                          <span className="ml-2">({dropFromPrevious.toFixed(0)}% do passo anterior)</span>
                        )}
                      </span>
                    </div>
                    <div className="h-8 w-full rounded bg-muted overflow-hidden">
                      <div
                        className="h-full rounded bg-primary transition-all"
                        style={{ width: `${Math.max(widthPct, stage.count > 0 ? 2 : 0)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        "Checkout iniciado" e "PIX gerado" contam visitas distintas (por navegador/sessão); "Pago" e
        "Download realizado" contam pedidos distintos. Eventos só existem a partir de quando esse
        rastreamento foi ativado - compras anteriores não aparecem aqui.
      </p>
    </div>
  );
}
