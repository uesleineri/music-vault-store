// Manual audit logging for Edge Functions that write via service_role (bypassing
// the RLS-aware trigger on `multitracks`, which only sees the acting admin when
// the write comes straight from the client's own session).
export async function logAudit(
  supabase: any,
  req: Request,
  params: {
    actorId: string | null;
    actorEmail: string | null;
    action: string;
    targetType: string;
    targetId?: string | null;
    changes?: Record<string, unknown> | null;
  }
) {
  try {
    await supabase.from("audit_logs").insert({
      actor_id: params.actorId,
      actor_email: params.actorEmail,
      action: params.action,
      target_type: params.targetType,
      target_id: params.targetId ?? null,
      changes: params.changes ?? null,
      ip_address: req.headers.get("x-forwarded-for"),
      user_agent: req.headers.get("user-agent"),
    });
  } catch (error) {
    // Never let audit logging break the actual operation.
    console.error("Failed to write audit log:", error);
  }
}
