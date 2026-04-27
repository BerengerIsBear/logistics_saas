// app/api/activity/route.ts
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
    .maybeSingle();

  if (error || !data?.company_id) return null;
  return data.company_id as string;
}

function isUuid(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    v
  );
}

// GET /api/activity?jobId=<uuid OR JOB-xxxx>
export async function GET(req: Request) {
  const user = await getAuthedUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const companyId = await getCompanyId(user.id);
  if (!companyId) return NextResponse.json({ error: "No company profile" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const raw = String(searchParams.get("jobId") ?? "").trim();
  if (!raw) return NextResponse.json({ error: "jobId required" }, { status: 400 });

  let jobUuid = raw;

  // If caller passed JOB-xxxx, resolve to UUID (scoped to company)
  if (!isUuid(raw)) {
    const jobNumber = raw;

    const { data: job, error: jErr } = await admin
      .from("jobs")
      .select("id")
      .eq("company_id", companyId)
      .eq("job_number", jobNumber)
      .maybeSingle();

    if (jErr) return NextResponse.json({ error: jErr.message }, { status: 500 });
    if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

    jobUuid = job.id as string;
  }

  // Pull activity by UUID
  const { data, error } = await admin
    .from("activity")
    .select("*")
    .eq("company_id", companyId)
    .eq("job_id", jobUuid)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ items: data ?? [] });
}

