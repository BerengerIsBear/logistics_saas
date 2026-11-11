// app/api/drivers/route.ts
import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/access";
import { supabaseAdmin } from "@/lib/supabase/server";

export async function GET(req: Request) {
  const auth = await requireRole(["admin", "dispatcher"]);
  if ("response" in auth) return auth.response;

  const all = new URL(req.url).searchParams.get("all") === "1";
  let query = supabaseAdmin()
    .from("drivers")
    .select("id, name, phone, is_active, created_at")
    .eq("company_id", auth.context.companyId);

  // Assignment dropdowns only need active drivers. Management sees everyone.
  if (!all) query = query.eq("is_active", true);

  const { data, error } = await query.order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ drivers: data ?? [] });
}

export async function POST(req: Request) {
  const auth = await requireRole(["admin"]);
  if ("response" in auth) return auth.response;

  const body = await req.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const phone = typeof body?.phone === "string" ? body.phone.trim() : "";

  if (!name || name.length > 120) {
    return NextResponse.json({ error: "Driver name must be 1–120 characters" }, { status: 400 });
  }
  if (phone.length > 40) {
    return NextResponse.json({ error: "Phone must be at most 40 characters" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin()
    .from("drivers")
    .insert({ company_id: auth.context.companyId, name, phone: phone || null, is_active: true })
    .select("id, name, phone, is_active, created_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ driver: data }, { status: 201 });
}
