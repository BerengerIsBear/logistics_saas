// Server-only helper. Never accept actor/company/action data from the browser.
import type { SupabaseClient } from "@supabase/supabase-js";

type AdminAuditEvent = {
  admin: SupabaseClient;
  companyId: string;
  actorUserId: string;
  action: string;
  targetType: string;
  targetId: string;
  details?: Record<string, unknown>;
};

// Returns false if the business operation succeeded but audit recording failed.
// Do not log secrets or tokens in `details`.
export async function logAdminEvent({
  admin, companyId, actorUserId, action, targetType, targetId, details = {},
}: AdminAuditEvent): Promise<boolean> {
  try {
    const { error } = await admin.from("admin_audit_logs").insert({
      company_id: companyId,
      actor_user_id: actorUserId,
      action,
      target_type: targetType,
      target_id: targetId,
      details,
    });
    if (error) throw error;
    return true;
  } catch (error) {
    console.error("Admin audit insert failed:", error);
    return false;
  }
}

export const auditWarning = "Change saved, but audit logging failed. Contact the administrator.";
