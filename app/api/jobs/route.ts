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

// ✅ GET: list jobs for current user company
export async function GET() {
  const user = await getAuthedUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const companyId = await getCompanyId(user.id);
  if (!companyId) {
    return NextResponse.json({ error: "No company profile" }, { status: 403 });
  }

  const { data: rows, error } = await admin
    .from("jobs")
    .select(
      `
        *,
        drivers(name),
        vehicles(plate_no)
      `
    )
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ jobs: rows ?? [] });
}

// ✅ POST: create job (A+B: UI requires, API defaults)
export async function POST(req: Request) {
  const user = await getAuthedUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const companyId = await getCompanyId(user.id);
  if (!companyId) {
    return NextResponse.json({ error: "No company profile" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);

  const customer = String(body?.customer ?? "").trim();
  const pickup = String(body?.pickup ?? "").trim();
  const dropoff = String(body?.dropoff ?? "").trim();
  const driver = String(body?.driver ?? "").trim();
  const status = String(body?.status ?? "pending").trim();
  const notes = String(body?.notes ?? "").trim();

  if (!customer) return NextResponse.json({ error: "Customer is required" }, { status: 400 });
  if (!pickup) return NextResponse.json({ error: "Pickup is required" }, { status: 400 });
  if (!dropoff) return NextResponse.json({ error: "Drop-off is required" }, { status: 400 });

  // B) Server safety: default scheduled_date to today if missing
  const scheduledDate =
    String(body?.scheduled_date ?? "").trim() || new Date().toISOString().slice(0, 10);

  const windowStart = String(body?.window_start ?? "").trim();
  const windowEnd = String(body?.window_end ?? "").trim();

  const { data: latest, error: latestErr } = await admin
    .from("jobs")
    .select("job_number")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (latestErr) return NextResponse.json({ error: latestErr.message }, { status: 500 });

  const jobNumber = nextJobNumberFromLatest(latest?.job_number);

  const { data: row, error } = await admin
    .from("jobs")
    .insert({
      company_id: companyId,
      job_number: jobNumber,
      customer,
      pickup,
      dropoff,
      driver: driver || null, // legacy field (ok for now)
      status,
      notes: notes || null,

      scheduled_date: scheduledDate,
      window_start: windowStart || null,
      window_end: windowEnd || null,
    })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ job: row });
}
