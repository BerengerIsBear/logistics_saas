import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/access";
import { supabaseAdmin } from "@/lib/supabase/server";

// Admin-only. Logs are read through this API, never directly from the browser.
export async function GET() {
  const auth = await requireRole(["admin"]);
  if ("response" in auth) return auth.response;

  const admin = supabaseAdmin();
  const companyId = auth.context.companyId;
  const { data, error } = await admin.from("admin_audit_logs")
    .select("id, actor_user_id, action, target_type, target_id, details, created_at")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    return NextResponse.json({ error: "Could not load audit records" }, { status: 500 });
  }

  const events = data ?? [];
  const actorIds = [...new Set(events.map(e => e.actor_user_id))];
  let emails = new Map<string, string>();
  if (actorIds.length) {
    const { data: profiles, error: profileError } = await admin.from("profiles")
      .select("id, email").eq("company_id", companyId).in("id", actorIds);
    if (!profileError) {
      emails = new Map((profiles ?? []).filter(p => p.email).map(p => [p.id, p.email as string]));
    }
  }

  return NextResponse.json({ events: events.map(e => ({ ...e, actor_email: emails.get(e.actor_user_id) ?? null })) },
    { headers: { "Cache-Control": "private, no-store" } });
}
