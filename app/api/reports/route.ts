import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/access";
import { supabaseAdmin } from "@/lib/supabase/server";
import {
  buildEnterpriseReport,
  enterpriseReportCsv,
  type EnterpriseReport,
  type ReportJob,
  type ReportKind,
} from "@/lib/reports/enterpriseReports";
import type { PerformanceDriver } from "@/lib/jobs/driverPerformance";
import type { CustomerRecord, FinancialRecord } from "@/lib/jobs/customerProfitability";

const reportKinds: ReportKind[] = ["operations", "financial", "drivers", "customers"];

function parseDate(date: string | null): string | null | undefined {
  if (!date) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return undefined;
  const parsed = new Date(`${date}T00:00:00Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) return undefined;
  return date;
}

async function fetchAll<T>(
  table: "jobs" | "drivers" | "customers" | "job_financials",
  select: string,
  companyId: string,
  orderedBy: string,
  from: string | null = null,
  to: string | null = null
): Promise<T[]> {
  const admin = supabaseAdmin();
  const all: T[] = [];
  const pageSize = 500;
  for (let offset = 0; ; offset += pageSize) {
    let query = admin
      .from(table)
      .select(select)
      .eq("company_id", companyId);
    if (table === "jobs" && from) query = query.gte("scheduled_date", from);
    if (table === "jobs" && to) query = query.lte("scheduled_date", to);
    const { data, error } = await query
      .order(orderedBy, { ascending: true })
      .range(offset, offset + pageSize - 1);
    if (error) throw new Error(error.message);
    const batch = (data ?? []) as T[];
    all.push(...batch);
    if (batch.length < pageSize) break;
  }
  return all;
}

// GET /api/reports?report=operations|drivers|financial|customers&from=YYYY-MM-DD&to=YYYY-MM-DD&format=csv
// All filters are enforced at the server. Financial reports are admin-only.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const kind = url.searchParams.get("report") ?? "operations";
  const format = url.searchParams.get("format") ?? "json";
  const from = parseDate(url.searchParams.get("from"));
  const to = parseDate(url.searchParams.get("to"));
  if (!reportKinds.includes(kind as ReportKind) || !["json", "csv"].includes(format)) {
    return NextResponse.json({ error: "Invalid report or export format" }, { status: 400 });
  }
  if (from === undefined || to === undefined || (from && to && from > to)) {
    return NextResponse.json({ error: "Invalid date range" }, { status: 400 });
  }

  const financial = kind === "financial" || kind === "customers";
  const auth = await requireRole(financial ? ["admin"] : ["admin", "dispatcher"]);
  if ("response" in auth) return auth.response;

  try {
    const { companyId } = auth.context;
    const jobs = await fetchAll<ReportJob>(
      "jobs",
      "id,job_number,customer,customer_id,driver_id,pickup,dropoff,status,scheduled_date,window_end,delivered_at",
      companyId,
      "id", from, to
    );
    const [drivers, customers, financials] = await Promise.all([
      kind === "operations" || kind === "drivers"
        ? fetchAll<PerformanceDriver>("drivers", "id,name,is_active", companyId, "id")
        : Promise.resolve([]),
      kind === "customers"
        ? fetchAll<CustomerRecord>("customers", "id,name", companyId, "id")
        : Promise.resolve([]),
      financial
        ? fetchAll<FinancialRecord>(
            "job_financials", "job_id,revenue,driver_cost,fuel_cost,vehicle_cost,other_cost", companyId, "job_id"
          )
        : Promise.resolve([]),
    ]);

    const report: EnterpriseReport = {
      ...buildEnterpriseReport(kind as ReportKind, { jobs, drivers, customers, financials }),
      date_from: from,
      date_to: to,
    };

    if (format === "csv") {
      const filename = `${kind}-report-${from ?? "all"}-${to ?? "all"}.csv`;
      return new Response(enterpriseReportCsv(report), {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${filename}"`,
          "Cache-Control": "private, no-store",
          "X-Content-Type-Options": "nosniff",
        },
      });
    }
    return NextResponse.json(report, { headers: { "Cache-Control": "private, no-store" } });
  } catch (err) {
    console.error("Enterprise reporting failed", err);
    return NextResponse.json({ error: "Could not generate report" }, { status: 500 });
  }
}
