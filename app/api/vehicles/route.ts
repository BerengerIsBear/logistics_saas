// app/api/vehicles/route.ts
import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/access";
import { createClient } from "@supabase/supabase-js";

const admin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  const auth = await requireRole(["admin", "dispatcher"]);
  if ("response" in auth) return auth.response;
  const { companyId } = auth.context;

  const { data, error } = await admin
    .from("vehicles")
    .select("id, plate_no, type, is_active, created_at")
    .eq("company_id", companyId)
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ vehicles: data ?? [] });
}

export async function POST(req: Request) {
  const auth = await requireRole(["admin"]);
  if ("response" in auth) return auth.response;
  const { companyId } = auth.context;

  const body = await req.json().catch(() => null);
  const plateNo = String(body?.plateNo ?? "").trim();
  const type = String(body?.type ?? "").trim();

  if (!plateNo) return NextResponse.json({ error: "plateNo required" }, { status: 400 });

  const { data, error } = await admin
    .from("vehicles")
    .insert({ company_id: companyId, plate_no: plateNo, type: type || null })
    .select("id, plate_no, type, is_active, created_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ vehicle: data });
}


