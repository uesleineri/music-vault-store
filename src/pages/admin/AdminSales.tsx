import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Music, ShoppingCart, Loader2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useSales } from '@/hooks/useSales';

const statusLabels: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  pending: { label: 'Pendente', variant: 'secondary' },
  paid: { label: 'Pago', variant: 'default' },
  failed: { label: 'Falhou', variant: 'destructive' },
};

export default function AdminSales() {
  const { data: sales, isLoading } = useSales();

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h2 className="text-2xl font-bold">Vendas</h2>
        <p className="text-muted-foreground">
          Histórico de todas as vendas realizadas
        </p>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center">
              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">Carregando...</p>
            </div>
          ) : sales && sales.length > 0 ? (
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
                {sales.map((sale) => {
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
                As vendas aparecerão aqui quando forem realizadas.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
