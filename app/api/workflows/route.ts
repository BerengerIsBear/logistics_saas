import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/access";
import { supabaseAdmin } from "@/lib/supabase/server";
import { parseWorkflowInput } from "@/lib/workflows/types";
import { logAdminEvent, auditWarning } from "@/lib/audit/logAdminEvent";

export async function GET() {
  const auth = await requireRole(["admin", "dispatcher"]);
  if ("response" in auth) return auth.response;

  const { data, error } = await supabaseAdmin()
    .from("workflow_templates")
    .select("id,name,stages,rules,stage_sla_minutes,created_at")
    .eq("company_id", auth.context.companyId)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ templates: data ?? [] });
}

export async function POST(request: Request) {
  const auth = await requireRole(["admin"]);
  if ("response" in auth) return auth.response;
  const { companyId } = auth.context;

  const validation = parseWorkflowInput(await request.json().catch(() => null));
  if (validation.error) return NextResponse.json({ error: validation.error }, { status: 400 });

  const admin = supabaseAdmin();
  const { data, error } = await admin
    .from("workflow_templates")
    .insert({ company_id: companyId, name: validation.name, stages: validation.stages, rules: validation.rules, stage_sla_minutes: validation.stage_sla_minutes })
    .select("id,name,stages,rules,stage_sla_minutes,created_at")
    .single();

  if (error) {
    if (error.code === "23505") return NextResponse.json({ error: "A workflow with this name already exists" }, { status: 409 });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const logged = await logAdminEvent({
    admin, companyId, actorUserId: auth.context.userId,
    action: "workflow.created", targetType: "workflow", targetId: data.id,
    details: { name: data.name, stages: data.stages, stage_sla_minutes: data.stage_sla_minutes },
  });
  return NextResponse.json({
    template: data, ...(!logged ? { audit_warning: auditWarning } : {}),
  }, { status: 201 });
}
