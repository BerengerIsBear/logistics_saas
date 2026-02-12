// app/api/jobs/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

const admin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function getAuthedUser() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll() {} } }
  );
  const { data } = await supabase.auth.getUser();
  return data.user ?? null;
}

async function getCompanyId(userId: string) {
  const { data, error } = await admin
    .from("profiles")
    .select("company_id")
    .eq("id", userId)
    .single();

  if (error || !data?.company_id) return null;
  return data.company_id as string;
}

function nextJobNumberFromLatest(latest?: string | null) {
  const n = latest ? Number(String(latest).replace("JOB-", "")) : NaN;
  const base = Number.isFinite(n) ? n : 1000;
  return `JOB-${base + 1}`;
}

// ✅ GET jobs with filters + joins (customers/drivers/vehicles)
export async function GET(req: Request) {
  const user = await getAuthedUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const companyId = await getCompanyId(user.id);
  if (!companyId) return NextResponse.json({ error: "No company profile" }, { status: 403 });

  const url = new URL(req.url);
  const q = String(url.searchParams.get("q") ?? "").trim();
  const status = String(url.searchParams.get("status") ?? "").trim();
  const dateFrom = String(url.searchParams.get("dateFrom") ?? "").trim();
  const dateTo = String(url.searchParams.get("dateTo") ?? "").trim();

  let query = admin
    .from("jobs")
    .select(
      `
        *,
        customers(name),
        drivers(name),
        vehicles(plate_no)
      `
    )
    .eq("company_id", companyId);

  if (q) {
    const safe = q.replace(/[,]/g, " ").trim();
    query = query.or(
      `job_number.ilike.%${safe}%,customer.ilike.%${safe}%,customers.name.ilike.%${safe}%`
    );
  }

  if (status) query = query.eq("status", status);
  if (dateFrom) query = query.gte("scheduled_date", dateFrom);
  if (dateTo) query = query.lte("scheduled_date", dateTo);

  const { data, error } = await query.order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ jobs: data ?? [] });
}

// ✅ POST create job (customer_id required, no more free-text customer creation)
export async function POST(req: Request) {
  const user = await getAuthedUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const companyId = await getCompanyId(user.id);
  if (!companyId) return NextResponse.json({ error: "No company profile" }, { status: 403 });

  const body = await req.json().catch(() => null);

  const customerId = String(body?.customer_id ?? "").trim();
  const pickup = String(body?.pickup ?? "").trim();
  const dropoff = String(body?.dropoff ?? "").trim();
  const notes = String(body?.notes ?? "").trim();

  if (!customerId) return NextResponse.json({ error: "customer_id is required" }, { status: 400 });
  if (!pickup) return NextResponse.json({ error: "Pickup is required" }, { status: 400 });
  if (!dropoff) return NextResponse.json({ error: "Drop-off is required" }, { status: 400 });

  // Server safety
  const scheduledDate =
    String(body?.scheduled_date ?? "").trim() || new Date().toISOString().slice(0, 10);
  const windowStart = String(body?.window_start ?? "").trim();
  const windowEnd = String(body?.window_end ?? "").trim();

  // Validate customer belongs to same company
  const { data: cust, error: custErr } = await admin
    .from("customers")
    .select("id,name")
    .eq("company_id", companyId)
    .eq("id", customerId)
    .maybeSingle();

  if (custErr) return NextResponse.json({ error: custErr.message }, { status: 500 });
  if (!cust) return NextResponse.json({ error: "Invalid customer_id" }, { status: 400 });

  const { data: latest, error: latestErr } = await admin
    .from("jobs")
    .select("job_number")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (latestErr) return NextResponse.json({ error: latestErr.message }, { status: 500 });

  const jobNumber = nextJobNumberFromLatest(latest?.job_number);

  // Keep customer snapshot for readability + historical correctness
  const { data: row, error } = await admin
    .from("jobs")
    .insert({
      company_id: companyId,
      job_number: jobNumber,

      customer_id: cust.id,
      customer: cust.name, // snapshot

      pickup,
      dropoff,
      status: "pending",
      notes: notes || null,

      scheduled_date: scheduledDate,
      window_start: windowStart || null,
      window_end: windowEnd || null,
    })
    .select(
      `
        *,
        customers(name),
        drivers(name),
        vehicles(plate_no)
      `
    )
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ job: row });
}
