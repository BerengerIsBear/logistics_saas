// app/api/jobs/[id]/assign/route.ts

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { logActivity } from "@/lib/activity/logActivity";

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
        getAll: () => cookieStore.getAll(),
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
    .maybeSingle();

  if (error || !data?.company_id) {
    return null;
  }

  return data.company_id as string;
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const jobNumber = decodeURIComponent(id);

  const user = await getAuthedUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const companyId = await getCompanyId(user.id);

  if (!companyId) {
    return NextResponse.json({ error: "No company profile" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);

  const driverId = String(body?.driverId ?? "").trim();
  const vehicleId = String(body?.vehicleId ?? "").trim();

  if (!driverId || !vehicleId) {
    return NextResponse.json(
      { error: "driverId and vehicleId required" },
      { status: 400 }
    );
  }

  const { data: currentJob, error: readErr } = await admin
    .from("jobs")
    .select("id, status, driver_id, vehicle_id, assigned_at")
    .eq("company_id", companyId)
    .eq("job_number", jobNumber)
    .maybeSingle();

  if (readErr) {
    return NextResponse.json({ error: readErr.message }, { status: 500 });
  }

  if (!currentJob) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  if (currentJob.status === "in_transit" || currentJob.status === "delivered") {
    return NextResponse.json(
      { error: "Cannot assign/re-assign after the job has started" },
      { status: 400 }
    );
  }

  const { data: driverRow, error: driverErr } = await admin
    .from("drivers")
    .select("id")
    .eq("company_id", companyId)
    .eq("id", driverId)
    .maybeSingle();

  if (driverErr) {
    return NextResponse.json({ error: driverErr.message }, { status: 500 });
  }

  if (!driverRow) {
    return NextResponse.json({ error: "Invalid driver" }, { status: 400 });
  }

  const { data: vehicleRow, error: vehicleErr } = await admin
    .from("vehicles")
    .select("id")
    .eq("company_id", companyId)
    .eq("id", vehicleId)
    .maybeSingle();

  if (vehicleErr) {
    return NextResponse.json({ error: vehicleErr.message }, { status: 500 });
  }

  if (!vehicleRow) {
    return NextResponse.json({ error: "Invalid vehicle" }, { status: 400 });
  }

  const prevDriverId = currentJob.driver_id ?? null;
  const prevVehicleId = currentJob.vehicle_id ?? null;

  const isReassign =
    Boolean(prevDriverId && prevDriverId !== driverId) ||
    Boolean(prevVehicleId && prevVehicleId !== vehicleId);

  const now = new Date().toISOString();

  const { data: job, error } = await admin
    .from("jobs")
    .update({
      driver_id: driverId,
      vehicle_id: vehicleId,
      assigned_at: now,
      status: "assigned",
    })
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

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  await logActivity({
    admin,
    companyId,
    jobId: currentJob.id,
    action: isReassign ? "job.reassigned" : "job.assigned",
    actorUserId: user.id,
    meta: {
      job_number: jobNumber,
      driver_id: driverId,
      vehicle_id: vehicleId,
      prev_driver_id: prevDriverId,
      prev_vehicle_id: prevVehicleId,
      assigned_at: now,
    },
  });

  return NextResponse.json({ job });
}