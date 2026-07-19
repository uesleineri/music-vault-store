import { useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, History, Loader2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
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
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuditLogs, AuditLog } from '@/hooks/useAuditLogs';

const PAGE_SIZE = 20;

const actionLabels: Record<string, string> = {
  'multitrack.insert': 'Cadastrou multitrack',
  'multitrack.update': 'Atualizou multitrack',
  'multitrack.delete': 'Excluiu multitrack',
  'admin.add': 'Adicionou administrador',
  'admin.remove': 'Removeu administrador',
  'sale.verify_payment': 'Verificou pagamento na Asaas',
  'sale.resend_download': 'Reenviou download',
  'sale.payment_confirmed': 'Pagamento confirmado (webhook Asaas)',
  'sale.payment_failed': 'Pagamento falhou/expirou (webhook Asaas)',
};

const targetTypeOptions = [
  { value: 'all', label: 'Todos os tipos' },
  { value: 'multitrack', label: 'Multitracks' },
  { value: 'sale', label: 'Vendas' },
  { value: 'admin_user', label: 'Administradores' },
];

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function ChangesSummary({ log }: { log: AuditLog }) {
  if (!log.changes) return <span className="text-muted-foreground text-xs">—</span>;

  const { old: oldVals, new: newVals } = log.changes;

  if (oldVals && newVals) {
    const keys = Object.keys(newVals);
    if (keys.length === 0) return <span className="text-muted-foreground text-xs">—</span>;
    return (
      <div className="space-y-1 text-xs">
        {keys.map((key) => (
          <div key={key}>
            <span className="font-medium">{key}:</span>{' '}
            <span className="text-muted-foreground line-through">{formatValue(oldVals[key])}</span>
            {' → '}
            <span>{formatValue(newVals[key])}</span>
          </div>
        ))}
      </div>
    );
  }

  const only = newVals ?? oldVals;
  if (!only) return <span className="text-muted-foreground text-xs">—</span>;
  return (
    <div className="space-y-1 text-xs">
      {Object.entries(only).map(([key, value]) => (
        <div key={key}>
          <span className="font-medium">{key}:</span> {formatValue(value)}
        </div>
      ))}
    </div>
  );
}

export default function AdminAuditLogs() {
  const [targetType, setTargetType] = useState('all');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useAuditLogs({
    targetType: targetType === 'all' ? undefined : targetType,
    page,
    pageSize: PAGE_SIZE,
  });

  const handleFilterChange = (value: string) => {
    setTargetType(value);
    setPage(1);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">Logs de Auditoria</h2>
          <p className="text-muted-foreground">
            Quem fez o quê no painel, quando, e o que mudou
          </p>
        </div>
        <Select value={targetType} onValueChange={handleFilterChange}>
          <SelectTrigger className="w-[200px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {targetTypeOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center">
              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">Carregando...</p>
            </div>
          ) : data && data.data.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Quem</TableHead>
                  <TableHead>Ação</TableHead>
                  <TableHead>Mudanças</TableHead>
                  <TableHead>IP</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.data.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="text-muted-foreground whitespace-nowrap">
                      {format(new Date(log.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {log.actor_email ?? <span className="text-muted-foreground">sistema</span>}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{actionLabels[log.action] ?? log.action}</Badge>
                    </TableCell>
                    <TableCell className="max-w-md">
                      <ChangesSummary log={log} />
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs whitespace-nowrap">
                      {log.ip_address ?? '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="p-8 text-center">
              <History className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <h3 className="font-semibold mb-1">Nenhum registro</h3>
              <p className="text-muted-foreground">
                Nenhuma ação de auditoria encontrada com esse filtro.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {data && data.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Página {data.currentPage} de {data.totalPages} ({data.totalCount} no total)
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="gap-1"
            >
              <ChevronLeft className="h-4 w-4" />
              Anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
              disabled={page === data.totalPages}
              className="gap-1"
            >
              Próxima
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
