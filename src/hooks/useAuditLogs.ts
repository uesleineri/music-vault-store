import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

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
