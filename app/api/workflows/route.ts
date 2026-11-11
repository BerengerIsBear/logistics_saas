import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/access";
import { supabaseAdmin } from "@/lib/supabase/server";
import { parseWorkflowInput } from "@/lib/workflows/types";

export async function GET() {
  const auth = await requireRole(["admin", "dispatcher"]);
  if ("response" in auth) return auth.response;

  const { data, error } = await supabaseAdmin()
    .from("workflow_templates")
    .select("id,name,stages,rules,created_at")
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
    .insert({ company_id: companyId, name: validation.name, stages: validation.stages, rules: validation.rules })
    .select("id,name,stages,rules,created_at")
    .single();

  if (error) {
    if (error.code === "23505") return NextResponse.json({ error: "A workflow with this name already exists" }, { status: 409 });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ template: data }, { status: 201 });
}
