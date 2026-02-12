// app/api/jobs/[jobNumber]/progress/route.ts
// Driver Actions: Start Job / Complete Job
// Keeps service role key server-side (Bridge architecture)

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

function nowIso() {
  return new Date().toISOString();
}

type Action = "start" | "complete";

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ jobNumber: string }> }
) {
  const { jobNumber } = await ctx.params;

  const user = await getAuthedUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const companyId = await getCompanyId(user.id);
  if (!companyId) return NextResponse.json({ error: "No company profile" }, { status: 403 });

  const body = await req.json().catch(() => null);
  const action = String(body?.action ?? "").trim() as Action;

  if (action !== "start" && action !== "complete") {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  // Load current job state
  const { data: job, error: readErr } = await admin
    .from("jobs")
    .select("id,job_number,status,driver_id,vehicle_id,in_transit_at,delivered_at")
    .eq("company_id", companyId)
    .eq("job_number", jobNumber)
    .maybeSingle();

  if (readErr) return NextResponse.json({ error: readErr.message }, { status: 500 });
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

  // Enforce real transitions
  if (action === "start") {
    if (job.status !== "assigned") {
      return NextResponse.json(
        { error: "Job must be assigned before starting" },
        { status: 400 }
      );
    }
    if (!job.driver_id || !job.vehicle_id) {
      return NextResponse.json(
        { error: "Job must have driver and vehicle assigned" },
        { status: 400 }
      );
    }

    const { data: updated, error } = await admin
      .from("jobs")
      .update({
        status: "in_transit",
        in_transit_at: job.in_transit_at ?? nowIso(),
      })
      .eq("company_id", companyId)
      .eq("job_number", jobNumber)
      .select("*")
      .maybeSingle();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!updated) return NextResponse.json({ error: "Job not found" }, { status: 404 });

    return NextResponse.json({ job: updated });
  }

  // complete
  if (job.status !== "in_transit") {
    return NextResponse.json(
      { error: "Job must be in transit before completing" },
      { status: 400 }
    );
  }

  const { data: updated, error } = await admin
    .from("jobs")
    .update({
      status: "delivered",
      delivered_at: job.delivered_at ?? nowIso(),
    })
    .eq("company_id", companyId)
    .eq("job_number", jobNumber)
    .select("*")
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!updated) return NextResponse.json({ error: "Job not found" }, { status: 404 });

  return NextResponse.json({ job: updated });
}
