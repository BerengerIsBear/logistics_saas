import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/access";
import { supabaseAdmin } from "@/lib/supabase/server";
import {
  buildProfitRiskReport,
  type DashboardFinancial,
  type DashboardJob,
} from "@/lib/jobs/profitRisk";

// Read ALL company rows, not just Supabase's default first 1,000.
async function readAll<T>(
  table: "jobs" | "job_financials",
  columns: string,
  companyId: string,
  orderBy: string
): Promise<T[]> {
  const size = 500;
  const result: T[] = [];
  const admin = supabaseAdmin();
  for (let offset = 0; ; offset += size) {
    const { data, error } = await admin
      .from(table)
      .select(columns)
      .eq("company_id", companyId)
      .order(orderBy, { ascending: true })
      .range(offset, offset + size - 1);
    if (error) throw new Error(error.message);
    const batch = (data ?? []) as T[];
    result.push(...batch);
    if (batch.length < size) break;
  }
  return result;
}

// GET /api/analytics/profit-risk — confidential, ADMIN ONLY.
export async function GET() {
  const auth = await requireRole(["admin"]);
  if ("response" in auth) return auth.response;

  try {
    const { companyId } = auth.context;
    const [jobs, financials] = await Promise.all([
      readAll<DashboardJob>(
        "jobs",
        "id,job_number,customer,status,scheduled_date,window_end,delivered_at",
        companyId,
        "id"
      ),
      readAll<DashboardFinancial>(
        "job_financials",
        "job_id,revenue,driver_cost,fuel_cost,vehicle_cost,other_cost",
        companyId,
        "job_id"
      ),
    ]);

    return NextResponse.json(buildProfitRiskReport(jobs, financials), {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    console.error("Profit and risk dashboard failed", error);
    return NextResponse.json(
      { error: "Could not load profit and risk dashboard" },
      { status: 500 }
    );
  }
}
