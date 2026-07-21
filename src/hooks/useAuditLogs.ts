import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export interface AuditLog {
  id: string;
  actor_id: string | null;
  actor_email: string | null;
  action: string;
  target_type: string;
  target_id: string | null;
  target_label: string | null;
  changes: { old?: Record<string, unknown>; new?: Record<string, unknown> } | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

interface AuditLogsParams {
  targetType?: string;
  page?: number;
  pageSize?: number;
}

export function useAuditLogs(params: AuditLogsParams = {}) {
  const { targetType, page = 1, pageSize = 20 } = params;

  return useQuery({
    queryKey: ['audit-logs', targetType, page, pageSize],
    queryFn: async () => {
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      let query = supabase
        .from('audit_logs')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(from, to);

      if (targetType) {
        query = query.eq('target_type', targetType);
      }

      const { data, error, count } = await query;
      if (error) throw error;

      return {
        data: data as AuditLog[],
        totalCount: count || 0,
        totalPages: Math.ceil((count || 0) / pageSize),
        currentPage: page,
      };
    },
  });
}

async function getOwnAdminUserId(): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from('admin_users').select('id').eq('user_id', user.id).maybeSingle();
  return data?.id ?? null;
}

// How many audit log entries were written since this admin last opened the
// page - same "unread since last visit" idea as the notifications badge,
// but backed by a per-admin timestamp instead of a persisted read flag per
// row (audit_logs itself stays write-only, see 20260719053004). Also
// subscribes live (Realtime) so a log written while the admin is already
// browsing the panel - a background job failure, another admin's action -
// bumps the badge and raises a toast immediately, instead of only showing up
// the next time this query happens to refetch.
export function useAuditLogUnreadCount() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['audit-logs-unread-count'],
    queryFn: async () => {
      const adminUserId = await getOwnAdminUserId();
      if (!adminUserId) return 0;

      const { data: readState } = await supabase
        .from('admin_log_reads')
        .select('last_viewed_at')
        .eq('admin_user_id', adminUserId)
        .maybeSingle();

      const since = readState?.last_viewed_at ?? '1970-01-01T00:00:00Z';
      const { count, error } = await supabase
        .from('audit_logs')
        .select('id', { count: 'exact', head: true })
        .gt('created_at', since);
      if (error) throw error;
      return count ?? 0;
    },
  });

  useEffect(() => {
    const channel = supabase
      .channel('audit-logs-live-alerts')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'audit_logs' },
        (payload) => {
          queryClient.setQueryData<number>(['audit-logs-unread-count'], (prev) => (prev ?? 0) + 1);
          const row = payload.new as { action: string; target_label: string | null; target_type: string };
          toast({
            title: 'Novo log de auditoria',
            description: `${row.action} - ${row.target_label ?? row.target_type}`,
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return query;
}

export function useMarkAuditLogsViewed() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const adminUserId = await getOwnAdminUserId();
      if (!adminUserId) return;
      const { error } = await supabase
        .from('admin_log_reads')
        .upsert({ admin_user_id: adminUserId, last_viewed_at: new Date().toISOString() });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['audit-logs-unread-count'] });
    },
  });
}
