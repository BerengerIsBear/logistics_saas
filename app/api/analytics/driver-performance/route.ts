import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/access";
import { supabaseAdmin } from "@/lib/supabase/server";
import {
  buildDriverPerformance,
  type PerformanceDriver,
  type PerformanceJob,
} from "@/lib/jobs/driverPerformance";

// Include inactive drivers and old jobs. Fetch past Supabase's 1,000-row limit.
async function readAll<T>(
  table: "drivers" | "jobs",
  columns: string,
  companyId: string
): Promise<T[]> {
  const admin = supabaseAdmin();
  const rows: T[] = [];
  const pageSize = 500;
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await admin
      .from(table)
      .select(columns)
      .eq("company_id", companyId)
      .order("id", { ascending: true })
      .range(offset, offset + pageSize - 1);
    if (error) throw new Error(error.message);
    const batch = (data ?? []) as T[];
    rows.push(...batch);
    if (batch.length < pageSize) break;
  }
  return rows;
}

// GET /api/analytics/driver-performance — operational data only.
export async function GET() {
  const auth = await requireRole(["admin", "dispatcher"]);
  if ("response" in auth) return auth.response;

  try {
    const { companyId } = auth.context;
    const [drivers, jobs] = await Promise.all([
      readAll<PerformanceDriver>("drivers", "id,name,is_active", companyId),
      readAll<PerformanceJob>(
        "jobs",
        "id,driver_id,status,scheduled_date,window_end,delivered_at",
        companyId
      ),
    ]);
    return NextResponse.json(buildDriverPerformance(drivers, jobs), {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    console.error("Driver performance report failed", error);
    return NextResponse.json({ error: "Could not load driver performance" }, { status: 500 });
  }
}
