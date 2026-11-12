import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/access";
import { supabaseAdmin } from "@/lib/supabase/server";
import { parseDriverId, parseRole } from "@/lib/employees/validation";
import { isSameOrigin, validateDriverLink } from "@/lib/employees/server";

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireRole(["admin"]);
  if ("response" in auth) return auth.response;
  if (!isSameOrigin(req)) return NextResponse.json({ error: "Invalid request origin" }, { status: 403 });
  const { id } = await ctx.params;
  if (id === auth.context.userId) {
    return NextResponse.json({ error: "You cannot change your own access" }, { status: 400 });
  }
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Invalid employee" }, { status: 400 });

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const admin = supabaseAdmin();
  const { data: target, error: targetError } = await admin.from("profiles")
    .select("id, role, driver_id, is_active").eq("id", id).eq("company_id", auth.context.companyId).maybeSingle();
  if (targetError) return NextResponse.json({ error: "Could not load employee" }, { status: 500 });
  if (!target) return NextResponse.json({ error: "Employee not found" }, { status: 404 });

  const role = "role" in body ? parseRole(body.role) : parseRole(target.role);
  const driverId = "driver_id" in body ? parseDriverId(body.driver_id) : target.driver_id;
  const isActive = "is_active" in body ? body.is_active : target.is_active;
  if (!role || driverId === undefined || typeof isActive !== "boolean") {
    return NextResponse.json({ error: "Invalid employee details" }, { status: 400 });
  }
  const finalDriver = role === "driver" ? driverId : null;
  const linkError = await validateDriverLink(auth.context.companyId, role, finalDriver, id, isActive);
  if (linkError) return NextResponse.json({ error: linkError }, { status: 400 });

  if (target.role === "admin" && (role !== "admin" || !isActive)) {
    const { count, error } = await admin.from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("company_id", auth.context.companyId).eq("role", "admin").eq("is_active", true);
    if (error) return NextResponse.json({ error: "Could not verify administrator count" }, { status: 500 });
    if ((count ?? 0) <= 1) {
      return NextResponse.json({ error: "The company must keep an active Admin" }, { status: 400 });
    }
  }

  const { data, error } = await admin.from("profiles")
    .update({ role, driver_id: finalDriver, is_active: isActive })
    .eq("id", id).eq("company_id", auth.context.companyId)
    .select("id, email, role, driver_id, is_active").maybeSingle();
  if (error) return NextResponse.json({ error: "Could not update employee. Check driver link uniqueness." }, { status: 400 });
  if (!data) return NextResponse.json({ error: "Employee not found" }, { status: 404 });
  return NextResponse.json({ employee: data });
}
