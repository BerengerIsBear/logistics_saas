// app/api/drivers/[id]/route.ts
import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/access";
import { supabaseAdmin } from "@/lib/supabase/server";

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireRole(["admin"]);
  if ("response" in auth) return auth.response;
  const { id } = await ctx.params;

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const changes: { name?: string; phone?: string | null; is_active?: boolean } = {};
  if ("name" in body) {
    if (typeof body.name !== "string" || !body.name.trim() || body.name.trim().length > 120) {
      return NextResponse.json({ error: "Driver name must be 1–120 characters" }, { status: 400 });
    }
    changes.name = body.name.trim();
  }
  if ("phone" in body) {
    if (body.phone !== null && typeof body.phone !== "string") {
      return NextResponse.json({ error: "Invalid phone" }, { status: 400 });
    }
    if ((body.phone ?? "").trim().length > 40) {
      return NextResponse.json({ error: "Phone must be at most 40 characters" }, { status: 400 });
    }
    changes.phone = body.phone?.trim() || null;
  }
  if ("is_active" in body) {
    if (typeof body.is_active !== "boolean") {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }
    changes.is_active = body.is_active;
  }
  if (Object.keys(changes).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin()
    .from("drivers")
    .update(changes)
    .eq("company_id", auth.context.companyId)
    .eq("id", id)
    .select("id, name, phone, is_active, created_at")
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Driver not found" }, { status: 404 });
  return NextResponse.json({ driver: data });
}
