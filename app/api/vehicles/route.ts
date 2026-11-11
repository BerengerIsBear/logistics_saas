// app/api/vehicles/route.ts
import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/access";
import { supabaseAdmin } from "@/lib/supabase/server";

export async function GET(req: Request) {
  const auth = await requireRole(["admin", "dispatcher"]);
  if ("response" in auth) return auth.response;

  const all = new URL(req.url).searchParams.get("all") === "1";
  let query = supabaseAdmin()
    .from("vehicles")
    .select("id, plate_no, type, is_active, created_at")
    .eq("company_id", auth.context.companyId);

  if (!all) query = query.eq("is_active", true);

  const { data, error } = await query.order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ vehicles: data ?? [] });
}

export async function POST(req: Request) {
  const auth = await requireRole(["admin"]);
  if ("response" in auth) return auth.response;

  const body = await req.json().catch(() => null);
  const plateNo = typeof body?.plateNo === "string" ? body.plateNo.trim() : "";
  const type = typeof body?.type === "string" ? body.type.trim() : "";

  if (!plateNo || plateNo.length > 30) {
    return NextResponse.json({ error: "Plate number must be 1–30 characters" }, { status: 400 });
  }
  if (type.length > 80) {
    return NextResponse.json({ error: "Vehicle type must be at most 80 characters" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin()
    .from("vehicles")
    .insert({ company_id: auth.context.companyId, plate_no: plateNo, type: type || null, is_active: true })
    .select("id, plate_no, type, is_active, created_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ vehicle: data }, { status: 201 });
}
