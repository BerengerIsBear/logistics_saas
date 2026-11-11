// app/api/activity/route.ts
import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/access";
import { createClient } from "@supabase/supabase-js";

const admin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function isUuid(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    v
  );
}

// GET /api/activity?jobId=<uuid OR JOB-xxxx>
export async function GET(req: Request) {
  const auth = await requireRole(["admin", "dispatcher"]);
  if ("response" in auth) return auth.response;
  const { companyId } = auth.context;

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

