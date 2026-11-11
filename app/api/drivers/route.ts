// app/api/drivers/route.ts
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
    .from("drivers")
    .select("id, name, phone, is_active, created_at")
    .eq("company_id", companyId)
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ drivers: data ?? [] });
}

// Optional but useful: quick create drivers from UI later
export async function POST(req: Request) {
  const auth = await requireRole(["admin"]);
  if ("response" in auth) return auth.response;
  const { companyId } = auth.context;

  const body = await req.json().catch(() => null);
  const name = String(body?.name ?? "").trim();
  const phone = String(body?.phone ?? "").trim();

  if (!name) return NextResponse.json({ error: "Name required" }, { status: 400 });

  const { data, error } = await admin
    .from("drivers")
    .insert({ company_id: companyId, name, phone: phone || null })
    .select("id, name, phone, is_active, created_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ driver: data });
}


