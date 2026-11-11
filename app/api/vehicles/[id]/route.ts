// app/api/vehicles/[id]/route.ts
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

  const changes: { plate_no?: string; type?: string | null; is_active?: boolean } = {};
  if ("plateNo" in body) {
    if (typeof body.plateNo !== "string" || !body.plateNo.trim() || body.plateNo.trim().length > 30) {
      return NextResponse.json({ error: "Plate number must be 1–30 characters" }, { status: 400 });
    }
    changes.plate_no = body.plateNo.trim();
  }
  if ("type" in body) {
    if (body.type !== null && typeof body.type !== "string") {
      return NextResponse.json({ error: "Invalid vehicle type" }, { status: 400 });
    }
    if ((body.type ?? "").trim().length > 80) {
      return NextResponse.json({ error: "Vehicle type must be at most 80 characters" }, { status: 400 });
    }
    changes.type = body.type?.trim() || null;
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
    .from("vehicles")
    .update(changes)
    .eq("company_id", auth.context.companyId)
    .eq("id", id)
    .select("id, plate_no, type, is_active, created_at")
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Vehicle not found" }, { status: 404 });
  return NextResponse.json({ vehicle: data });
}
