// app/api/jobs/[id]/route.ts
import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/access";
import { createClient } from "@supabase/supabase-js";

const admin = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

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

  const auth = await requireRole(["admin", "dispatcher"]);
  if ("response" in auth) return auth.response;
  const { companyId } = auth.context;

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

  const auth = await requireRole(["admin", "dispatcher"]);
  if ("response" in auth) return auth.response;
  const { companyId, userId } = auth.context;

  const body = await req.json().catch(() => null);

  // 🔒 Hard rule: status cannot be changed via this route.
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

  // Fetch current job for diff + activity log
  const { data: before, error: beforeErr } = await admin
    .from("jobs")
    .select("id,pickup,dropoff,notes,scheduled_date,window_start,window_end,job_number")
    .eq("company_id", companyId)
    .eq("job_number", jobNumber)
    .maybeSingle();

  if (beforeErr) return NextResponse.json({ error: beforeErr.message }, { status: 500 });
  if (!before) return NextResponse.json({ error: "Job not found" }, { status: 404 });

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

  // ✅ Activity log: job.updated (non-blocking)
  try {
    const changed: Array<{ field: string; from: any; to: any }> = [];
    for (const key of Object.keys(patch)) {
      const from = (before as any)[key];
      const to = (job as any)[key]; // ✅ compare against saved value
      if (JSON.stringify(from) !== JSON.stringify(to)) {
        changed.push({ field: key, from, to });
      }
    }

    if (changed.length > 0) {
      const { error: actErr } = await admin.from("activity").insert({
        company_id: companyId,
        job_id: before.id, // UUID for activity route
        action: "job.updated",
        actor_user_id: userId,
        meta: {
          job_number: jobNumber,
          changed,
        },
      });

      if (actErr) console.error("activity insert failed:", actErr.message);
    }
  } catch (e) {
    console.error("activity insert failed:", e);
  }

  return NextResponse.json({ job });
}

