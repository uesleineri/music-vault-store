import { supabase } from '@/integrations/supabase/client';

// Records something the admin's own browser observed (a background job that
// failed, etc.) into the audit trail via the log-client-event Edge Function -
// audit_logs itself has no direct-insert policy for authenticated sessions by
// design, so this is the one attributed door in. Best-effort: never let a
// logging failure mask the real error that triggered it.
export async function logClientEvent(
  action: string,
  targetType: string,
  targetLabel: string,
  changes?: Record<string, unknown>
) {
  try {
    const { error } = await supabase.functions.invoke('log-client-event', {
      body: { action, target_type: targetType, target_label: targetLabel, changes },
    });
    if (error) throw error;
  } catch (error) {
    console.error('Failed to log client event:', error);
  }
}
