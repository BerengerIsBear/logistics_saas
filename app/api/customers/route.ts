// app/api/customers/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

const admin = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function getAuthedUser() {
  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll() {},
      },
    }
  );

  const { data } = await supabase.auth.getUser();
  return data.user ?? null;
}

async function getCompanyId(userId: string) {
  const { data, error } = await admin.from("profiles").select("company_id").eq("id", userId).single();
  if (error || !data?.company_id) return null;
  return data.company_id as string;
}

function sanitizeIlike(input: string) {
  // prevent wildcard abuse and commas breaking PostgREST OR syntax
  return input.replace(/[%_]/g, " ").replace(/[,]/g, " ").trim();
}

function looksLikeEmail(v: string) {
  // simple sanity check
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

export async function GET(req: Request) {
  const user = await getAuthedUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const companyId = await getCompanyId(user.id);
  if (!companyId) return NextResponse.json({ error: "No company profile" }, { status: 403 });

  const url = new URL(req.url);
  const qRaw = String(url.searchParams.get("q") ?? "").trim();
  const q = sanitizeIlike(qRaw);

  let query = admin
    .from("customers")
    .select("*")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });

  if (q) {
    query = query.or(`name.ilike.%${q}%,phone.ilike.%${q}%,email.ilike.%${q}%`);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ customers: data ?? [] });
}

export async function POST(req: Request) {
  const user = await getAuthedUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const companyId = await getCompanyId(user.id);
  if (!companyId) return NextResponse.json({ error: "No company profile" }, { status: 403 });

  const body = await req.json().catch(() => null);

  const name = String(body?.name ?? "").trim();
  const phone = String(body?.phone ?? "").trim();
  const email = String(body?.email ?? "").trim();

  if (!name) return NextResponse.json({ error: "Customer name is required" }, { status: 400 });
  if (email && !looksLikeEmail(email)) {
    return NextResponse.json({ error: "Invalid email format" }, { status: 400 });
  }

  // Soft duplicate check (fast, not perfect). Add DB unique index later if you want.
  const { data: existing, error: exErr } = await admin
    .from("customers")
    .select("id")
    .eq("company_id", companyId)
    .ilike("name", name)
    .limit(1)
    .maybeSingle();

  if (exErr) return NextResponse.json({ error: exErr.message }, { status: 500 });
  if (existing) {
    return NextResponse.json({ error: "Customer already exists (same name)" }, { status: 400 });
  }

  const { data, error } = await admin
    .from("customers")
    .insert({
      company_id: companyId,
      name,
      phone: phone || null,
      email: email || null,
    })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ customer: data });
}

