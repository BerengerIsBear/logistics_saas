import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/access";
import { supabaseAdmin } from "@/lib/supabase/server";

type Context = { params: Promise<{ id: string }> };

// Acknowledgement means a staff member has seen the alert; it does not resolve the delay.
export async function PATCH(_request: Request, context: Context) {
  const auth = await requireRole(["admin", "dispatcher"]);
  if ("response" in auth) return auth.response;

  const { id } = await context.params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return NextResponse.json({ error: "Invalid alert ID" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin()
    .from("workflow_escalations")
    .update({ status: "acknowledged", acknowledged_at: new Date().toISOString(), acknowledged_by: auth.context.userId })
    .eq("company_id", auth.context.companyId)
    .eq("id", id)
    .eq("status", "open")
    .select("id")
    .maybeSingle();

  if (error) return NextResponse.json({ error: "Unable to acknowledge alert" }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Alert no longer open; refresh the page" }, { status: 409 });
  return NextResponse.json({ success: true });
}
