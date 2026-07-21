import { useState, useEffect } from 'react';
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
import { useAuditLogs, useMarkAuditLogsViewed, AuditLog } from '@/hooks/useAuditLogs';

const PAGE_SIZE = 20;

const targetTypeOptions = [
  { value: 'all', label: 'Todos os tipos' },
  { value: 'multitrack', label: 'Multitracks' },
  { value: 'sale', label: 'Vendas' },
  { value: 'admin_user', label: 'Administradores' },
];

// Field name -> human label. Anything not listed falls back to a prettified key.
const fieldLabels: Record<string, string> = {
  artist_name: 'Artista',
  song_name: 'Música',
  price: 'Preço',
  cover_url: 'Capa',
  file_url: 'Arquivo (Drive)',
  preview_url: 'Preview de áudio',
  is_active: 'Status',
  user_id: 'ID do usuário',
  email: 'E-mail',
  payment_status: 'Status do pagamento',
  asaas_status: 'Status na Asaas',
  asaas_event: 'Evento da Asaas',
  resent_to: 'Reenviado para',
};

const paymentStatusLabels: Record<string, string> = {
  pending: 'Pendente',
  paid: 'Pago',
  failed: 'Falhou',
};

// Fields whose raw value (a Drive file ID or a long URL) means nothing to a
// human - show that it changed without dumping the raw value.
const opaqueFields = new Set(['file_url', 'cover_url', 'preview_url']);

function prettifyKey(key: string): string {
  return fieldLabels[key] ?? key.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
}

function formatFieldValue(key: string, value: unknown): string {
  if (opaqueFields.has(key)) return value ? 'definido' : 'removido';
  if (key === 'is_active') return value ? 'Publicada' : 'Despublicada';
  if (key === 'price' && typeof value === 'number') return `R$ ${value.toFixed(2).replace('.', ',')}`;
  if (key === 'payment_status' && typeof value === 'string') return paymentStatusLabels[value] ?? value;
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

// A short, specific verb for the Ação column - falls back to a generic label
// when the change doesn't match one of the well-known single-field patterns.
function getActionLabel(log: AuditLog): string {
  if (log.action === 'multitrack.update' && log.changes) {
    const keys = Object.keys(log.changes.new ?? {});
    if (keys.length === 1 && keys[0] === 'is_active') {
      return log.changes.new?.is_active ? 'Publicou multitrack' : 'Despublicou multitrack';
    }
    if (keys.length === 1 && keys[0] === 'price') {
      return 'Alterou preço';
    }
  }

  const genericLabels: Record<string, string> = {
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
  return genericLabels[log.action] ?? log.action;
}

function ChangesSummary({ log }: { log: AuditLog }) {
  if (!log.changes) return <span className="text-muted-foreground text-xs">—</span>;

  const { old: oldVals, new: newVals } = log.changes;

  if (oldVals && newVals) {
    const keys = Object.keys(newVals).filter((k) => k !== 'id');
    if (keys.length === 0) return <span className="text-muted-foreground text-xs">—</span>;
    return (
      <div className="space-y-1 text-xs">
        {keys.map((key) => (
          <div key={key}>
            <span className="font-medium">{prettifyKey(key)}:</span>{' '}
            <span className="text-muted-foreground line-through">{formatFieldValue(key, oldVals[key])}</span>
            {' → '}
            <span>{formatFieldValue(key, newVals[key])}</span>
          </div>
        ))}
      </div>
    );
  }

  const only = newVals ?? oldVals;
  if (!only) return <span className="text-muted-foreground text-xs">—</span>;
  const keys = Object.keys(only).filter((k) => k !== 'id');
  return (
    <div className="space-y-1 text-xs">
      {keys.map((key) => (
        <div key={key}>
          <span className="font-medium">{prettifyKey(key)}:</span> {formatFieldValue(key, only[key])}
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

  const markViewed = useMarkAuditLogsViewed();
  // Opening this page is the "read" action - same idea as the notifications
  // page marking itself as read on mount.
  useEffect(() => {
    markViewed.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
                  <TableHead>Item</TableHead>
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
                      <Badge variant="outline">{getActionLabel(log)}</Badge>
                    </TableCell>
                    <TableCell className="max-w-[220px] truncate" title={log.target_label ?? undefined}>
                      {log.target_label ?? <span className="text-muted-foreground">—</span>}
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
