import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/access";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getFinancialTotals, type JobFinancials } from "@/lib/jobs/finance";
import { logActivity } from "@/lib/activity/logActivity";

type Context = { params: Promise<{ id: string }> };
const fields = ["revenue", "driver_cost", "fuel_cost", "vehicle_cost", "other_cost"] as const;

// Returns null for an intentionally empty revenue, "invalid" for bad numbers.
function parseAmount(value: unknown, nullable = false): number | null | "invalid" {
  if (nullable && (value === null || value === "")) return null;
  if (typeof value !== "number" && typeof value !== "string") return "invalid";
  const stringValue = String(value).trim();
  if (!/^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/.test(stringValue)) return "invalid";
  const amount = Number(stringValue);
  return Number.isFinite(amount) && amount <= 9999999999.99 ? amount : "invalid";
}

function toFinancials(row: Record<string, unknown>): JobFinancials {
  return {
    revenue: row.revenue === null || row.revenue === undefined ? null : Number(row.revenue),
    driver_cost: Number(row.driver_cost ?? 0),
    fuel_cost: Number(row.fuel_cost ?? 0),
    vehicle_cost: Number(row.vehicle_cost ?? 0),
    other_cost: Number(row.other_cost ?? 0),
  };
}

async function findJob(companyId: string, jobNumber: string) {
  return supabaseAdmin()
    .from("jobs")
    .select("id, job_number")
    .eq("company_id", companyId)
    .eq("job_number", jobNumber)
    .maybeSingle();
}

// GET /api/jobs/JOB-1001/financials — admin only
export async function GET(_req: Request, ctx: Context) {
  const auth = await requireRole(["admin"]);
  if ("response" in auth) return auth.response;

  const jobNumber = decodeURIComponent((await ctx.params).id);
  const { companyId } = auth.context;
  const { data: job, error: jobError } = await findJob(companyId, jobNumber);
  if (jobError) return NextResponse.json({ error: jobError.message }, { status: 500 });
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

  const { data, error } = await supabaseAdmin()
    .from("job_financials")
    .select("revenue,driver_cost,fuel_cost,vehicle_cost,other_cost")
    .eq("company_id", companyId)
    .eq("job_id", job.id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const financials = data ? toFinancials(data) : null;
  return NextResponse.json({
    financials,
    totals: financials ? getFinancialTotals(financials) : null,
  }, { headers: { "Cache-Control": "private, no-store" } });
}

// PUT replaces all five financial fields at once. Only admins can edit.
export async function PUT(req: Request, ctx: Context) {
  const auth = await requireRole(["admin"]);
  if ("response" in auth) return auth.response;

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const values: Record<string, number | null> = {};
  for (const field of fields) {
    const amount = parseAmount(body[field], field === "revenue");
    if (amount === "invalid") {
      return NextResponse.json(
        { error: `${field.replaceAll("_", " ")} must be a non-negative amount with up to 2 decimal places` },
        { status: 400 }
      );
    }
    values[field] = amount;
  }

  const jobNumber = decodeURIComponent((await ctx.params).id);
  const { companyId, userId } = auth.context;
  const { data: job, error: jobError } = await findJob(companyId, jobNumber);
  if (jobError) return NextResponse.json({ error: jobError.message }, { status: 500 });
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

  const admin = supabaseAdmin();
  const { data: previous, error: previousError } = await admin
    .from("job_financials")
    .select("revenue,driver_cost,fuel_cost,vehicle_cost,other_cost")
    .eq("company_id", companyId)
    .eq("job_id", job.id)
    .maybeSingle();
  if (previousError) return NextResponse.json({ error: previousError.message }, { status: 500 });

  const { data, error } = await admin
    .from("job_financials")
    .upsert({
      job_id: job.id,
      company_id: companyId,
      ...values,
      updated_at: new Date().toISOString(),
      updated_by: userId,
    }, { onConflict: "job_id" })
    .select("revenue,driver_cost,fuel_cost,vehicle_cost,other_cost")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const financials = toFinancials(data);
  const previousValues = previous ? toFinancials(previous) : null;
  const changedFields = fields.filter(field => previousValues?.[field] !== financials[field]);
  if (changedFields.length > 0) {
    // Do not put revenue/cost values in the general activity feed — dispatchers
    // can see that feed. Record only what fields were changed, and by whom.
    await logActivity({
      admin, companyId, jobId: job.id, actorUserId: userId,
      action: "finance.updated",
      meta: { job_number: jobNumber, fields_changed: changedFields },
    });
  }

  return NextResponse.json({ financials, totals: getFinancialTotals(financials) },
    { headers: { "Cache-Control": "private, no-store" } });
}
