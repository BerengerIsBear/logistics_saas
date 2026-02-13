// app/api/jobs/[id]/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
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
    .maybeSingle();

  if (error || !data?.company_id) return null;
  return data.company_id as string;
}

// NOTE:
// We intentionally DO NOT allow direct status changes here.
// Status transitions are enforced via dedicated endpoints:
// - pending -> assigned: PATCH /api/jobs/[id]/assign
// - assigned -> in_transit: PATCH /api/jobs/[id]/progress { action: "start" }
// - in_transit -> delivered: PATCH /api/jobs/[id]/progress { action: "complete" }

// ✅ GET one job by job_number (id = job number in URL)
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const jobNumber = decodeURIComponent(id);

  const user = await getAuthedUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const companyId = await getCompanyId(user.id);
  if (!companyId) return NextResponse.json({ error: "No company profile" }, { status: 403 });

  const { data: job, error } = await admin
    .from("jobs")
    .select(
      `
        *,
        customers(name),
        drivers(name),
        vehicles(plate_no)
      `
    )
    .eq("company_id", companyId)
    .eq("job_number", jobNumber)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

  return NextResponse.json({ job });
}

// ✅ PATCH job fields (status changes are NOT allowed here)
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const jobNumber = decodeURIComponent(id);

  const user = await getAuthedUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const companyId = await getCompanyId(user.id);
  if (!companyId) return NextResponse.json({ error: "No company profile" }, { status: 403 });

  const body = await req.json().catch(() => null);

  // 🔒 Hard rule: status cannot be changed via this route.
  // Use /assign or /progress to move the job through its lifecycle.
  if (body && Object.prototype.hasOwnProperty.call(body, "status")) {
    return NextResponse.json(
      {
        error:
          'Direct status updates are disabled. Use /api/jobs/[id]/assign (pending→assigned) or /api/jobs/[id]/progress (assigned→in_transit→delivered).',
      },
      { status: 400 }
    );
  }

  const allowedKeys = new Set([
    "pickup",
    "dropoff",
    "notes",
    "scheduled_date",
    "window_start",
    "window_end",
  ]);

  const patch: Record<string, any> = {};

  if (body && typeof body === "object") {
    for (const [key, value] of Object.entries(body)) {
      if (!allowedKeys.has(key)) continue;
      patch[key] = value;
    }
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "No updatable fields provided" }, { status: 400 });
  }

  const { data: job, error } = await admin
    .from("jobs")
    .update(patch)
    .eq("company_id", companyId)
    .eq("job_number", jobNumber)
    .select(
      `
        *,
        customers(name),
        drivers(name),
        vehicles(plate_no)
      `
    )
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

  return NextResponse.json({ job });
}
