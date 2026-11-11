import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/access";
import { supabaseAdmin } from "@/lib/supabase/server";
import {
  buildCustomerProfitability,
  type CustomerRecord,
  type JobRecord,
  type FinancialRecord,
} from "@/lib/jobs/customerProfitability";

// Supabase returns at most 1,000 rows per request by default. Fetch in small
// ordered batches so the dashboard never silently drops old jobs.
async function getAll<T>(
  table: "customers" | "jobs" | "job_financials",
  columns: string,
  companyId: string,
  orderColumn: string
): Promise<T[]> {
  const pageSize = 500;
  const rows: T[] = [];
  const admin = supabaseAdmin();

  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await admin
      .from(table)
      .select(columns)
      .eq("company_id", companyId)
      .order(orderColumn, { ascending: true })
      .range(offset, offset + pageSize - 1);

    if (error) throw new Error(error.message);
    const batch = (data ?? []) as T[];
    rows.push(...batch);
    if (batch.length < pageSize) break;
  }
  return rows;
}

// GET /api/analytics/customer-profitability — confidential, ADMIN ONLY.
export async function GET() {
  const auth = await requireRole(["admin"]);
  if ("response" in auth) return auth.response;

  try {
    const { companyId } = auth.context;
    const [customers, jobs, financials] = await Promise.all([
      getAll<CustomerRecord>("customers", "id,name", companyId, "id"),
      getAll<JobRecord>("jobs", "id,customer_id,customer", companyId, "id"),
      getAll<FinancialRecord>(
        "job_financials",
        "job_id,revenue,driver_cost,fuel_cost,vehicle_cost,other_cost",
        companyId,
        "job_id"
      ),
    ]);

    return NextResponse.json(buildCustomerProfitability(customers, jobs, financials), {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    console.error("Customer profitability report failed", error);
    return NextResponse.json({ error: "Could not load customer profitability" }, { status: 500 });
  }
}
