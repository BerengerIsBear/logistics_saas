// app/api/jobs/[id]/progress/route.ts

import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/access";
import { createClient } from "@supabase/supabase-js";
import { logActivity } from "@/lib/activity/logActivity";

const admin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const jobNumber = decodeURIComponent(id);

  const auth = await requireRole(["driver"]);
  if ("response" in auth) return auth.response;
  const { companyId, driverId, userId } = auth.context;
  if (!driverId) {
    return NextResponse.json({ error: "User not linked to driver" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const action = String(body?.action ?? "").trim();

  if (!["start", "complete"].includes(action)) {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  const { data: job, error: jobError } = await admin
    .from("jobs")
    .select("id, company_id, driver_id, status")
    .eq("company_id", companyId)
    .eq("job_number", jobNumber)
    .maybeSingle();

  if (jobError) {
    return NextResponse.json({ error: jobError.message }, { status: 500 });
  }

  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  if (job.driver_id !== driverId) {
    return NextResponse.json(
      { error: "This job is not assigned to you" },
      { status: 403 }
    );
  }

  const now = new Date().toISOString();

  let updates: Record<string, unknown> = {};
  let activityAction: "job.started" | "job.completed";

  if (action === "start") {
    if (job.status !== "assigned") {
      return NextResponse.json(
        { error: "Only assigned jobs can be started" },
        { status: 400 }
      );
    }

    updates = {
      status: "in_transit",
      in_transit_at: now,
    };

    activityAction = "job.started";
  } else {
    if (job.status !== "in_transit") {
      return NextResponse.json(
        { error: "Only in_transit jobs can be completed" },
        { status: 400 }
      );
    }

    updates = {
      status: "delivered",
      delivered_at: now,
    };

    activityAction = "job.completed";
  }

  const { data: updated, error: updateError } = await admin
    .from("jobs")
    .update(updates)
    .eq("id", job.id)
    .eq("company_id", companyId)
    .eq("status", job.status)
    .select("id")
    .maybeSingle();

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  if (!updated) {
    return NextResponse.json({ error: "Job status changed, please refresh" }, { status: 409 });
  }

  await logActivity({
    admin,
    companyId: companyId,
    jobId: job.id,
    action: activityAction,
    actorUserId: userId,
    meta: {
      job_number: jobNumber,
      previous_status: job.status,
      new_status: updates.status,
      action,
      at: now,
    },
  });

  return NextResponse.json({ success: true });
}