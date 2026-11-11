import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/access";
import { supabaseAdmin } from "@/lib/supabase/server";
import { buildOperationalRisk, type OperationalJob } from "@/lib/jobs/operationalRisk";

// GET /api/analytics/operational-risk — Admin + Dispatcher, no financial data.
export async function GET() {
  const auth = await requireRole(["admin", "dispatcher"]);
  if ("response" in auth) return auth.response;

  try {
    const { companyId } = auth.context;
    const admin = supabaseAdmin();
    const jobs: OperationalJob[] = [];
    const pageSize = 500;

    // Read every OPEN job, including companies with >1,000 records.
    for (let offset = 0; ; offset += pageSize) {
      const { data, error } = await admin
        .from("jobs")
        .select("job_number,customer,status,scheduled_date,window_end,delivered_at,driver_id,vehicle_id")
        .eq("company_id", companyId)
        .neq("status", "delivered")
        .order("id", { ascending: true })
        .range(offset, offset + pageSize - 1);

      if (error) throw new Error(error.message);
      const batch = (data ?? []) as OperationalJob[];
      jobs.push(...batch);
      if (batch.length < pageSize) break;
    }

    return NextResponse.json(buildOperationalRisk(jobs), {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    console.error("Operational risk report failed", error);
    return NextResponse.json({ error: "Could not load operational risk" }, { status: 500 });
  }
}
