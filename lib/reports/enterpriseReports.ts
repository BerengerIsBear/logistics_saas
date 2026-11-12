import { buildCustomerProfitability, type CustomerRecord, type FinancialRecord } from "@/lib/jobs/customerProfitability";
import { buildDriverPerformance, type PerformanceDriver } from "@/lib/jobs/driverPerformance";
import { buildProfitRiskReport } from "@/lib/jobs/profitRisk";
import { buildSlaPerformance } from "@/lib/jobs/slaPerformance";
import { getJobSla, type JobSlaInput } from "@/lib/jobs/sla";
import { getFinancialTotals } from "@/lib/jobs/finance";

export type ReportKind = "operations" | "financial" | "drivers" | "customers";
export type ReportValue = string | number | null;
export type ReportColumn = {
  key: string;
  label: string;
  format?: "currency" | "percent" | "number";
};
export type ReportRow = Record<string, ReportValue>;
export type ReportMetric = { label: string; value: number | null; format?: ReportColumn["format"] };
export type EnterpriseReport = {
  title: string;
  note: string;
  columns: ReportColumn[];
  rows: ReportRow[];
  metrics: ReportMetric[];
  date_from: string | null;
  date_to: string | null;
};

// Rows must be company-scoped and date-filtered by the API before calling this builder.
export type ReportJob = JobSlaInput & {
  id: string;
  job_number: string;
  customer: string | null;
  customer_id: string | null;
  driver_id: string | null;
  pickup: string | null;
  dropoff: string | null;
};

type Data = {
  jobs: ReportJob[];
  drivers?: PerformanceDriver[];
  customers?: CustomerRecord[];
  financials?: FinancialRecord[];
};

export function buildEnterpriseReport(kind: ReportKind, data: Data): Omit<EnterpriseReport, "date_from" | "date_to"> {
  const { jobs } = data;
  if (kind === "operations") {
    const sla = buildSlaPerformance(jobs);
    const driverNames = new Map((data.drivers ?? []).map(d => [d.id, d.name]));
    return {
      title: "Operational Summary",
      note: "Jobs are filtered by scheduled date. SLA status for unfinished jobs is evaluated now, not historically. Missing SLA targets are not considered on time.",
      metrics: [
        { label: "Jobs", value: sla.summary.jobs },
        { label: "Delivered", value: sla.summary.completed },
        { label: "Open jobs", value: sla.summary.open },
        { label: "On-time deliveries", value: sla.summary.on_time_rate, format: "percent" },
        { label: "Open SLA breaches", value: sla.summary.open_breached },
        { label: "SLA target coverage", value: sla.summary.target_coverage, format: "percent" },
      ],
      columns: [
        { key: "job_number", label: "Job" },
        { key: "customer", label: "Customer" },
        { key: "scheduled_date", label: "Scheduled date" },
        { key: "status", label: "Status" },
        { key: "driver", label: "Driver" },
        { key: "sla", label: "Delivery SLA" },
      ],
      rows: jobs.map(j => ({
        job_number: j.job_number,
        customer: j.customer ?? "Unknown",
        scheduled_date: j.scheduled_date ?? "—",
        status: j.status.replace(/_/g, " "),
        driver: j.driver_id ? driverNames.get(j.driver_id) ?? "Unknown" : "Unassigned",
        sla: j.status === "delivered" && !j.delivered_at ? "Unmeasured" : getJobSla(j).label,
      })),
    };
  }
  if (kind === "drivers") {
    const report = buildDriverPerformance(data.drivers ?? [], jobs);
    return {
      title: "Driver Performance Report",
      note: "On-time rate uses only delivered jobs with a deadline and a valid completion time. Unassigned jobs are excluded from driver totals.",
      metrics: [
        { label: "Drivers", value: report.summary.drivers },
        { label: "Completed deliveries", value: report.summary.completed_jobs },
        { label: "Measurable deliveries", value: report.summary.measured_deliveries },
        { label: "On-time rate", value: report.summary.on_time_rate, format: "percent" },
        { label: "Late deliveries", value: report.summary.late },
        { label: "Open SLA breaches", value: report.summary.open_sla_breaches },
      ],
      columns: [
        { key: "driver", label: "Driver" },
        { key: "assigned", label: "Assigned", format: "number" },
        { key: "completed", label: "Completed", format: "number" },
        { key: "measured", label: "Measured", format: "number" },
        { key: "on_time", label: "On time", format: "number" },
        { key: "late", label: "Late", format: "number" },
        { key: "rate", label: "On-time rate (%)", format: "percent" },
        { key: "breaches", label: "Open breaches", format: "number" },
      ],
      rows: report.rows.map(r => ({
        driver: r.name,
        assigned: r.assigned_jobs,
        completed: r.completed_jobs,
        measured: r.measured_deliveries,
        on_time: r.on_time,
        late: r.late,
        rate: r.on_time_rate,
        breaches: r.open_sla_breaches,
      })),
    };
  }
  if (kind === "customers") {
    const report = buildCustomerProfitability(data.customers ?? [], jobs, data.financials ?? []);
    return {
      title: "Customer Profitability Report",
      note: "Only jobs with recorded revenue contribute to financial totals. Unpriced jobs are counted as missing rather than assigned zero revenue.",
      metrics: [
        { label: "Customers with jobs", value: report.summary.customers },
        { label: "Priced jobs", value: report.summary.priced_jobs },
        { label: "Missing revenue", value: report.summary.missing_revenue_jobs },
        { label: "Revenue (SGD)", value: report.summary.revenue, format: "currency" },
        { label: "Profit (SGD)", value: report.summary.profit, format: "currency" },
        { label: "Profit margin", value: report.summary.margin, format: "percent" },
      ],
      columns: [
        { key: "customer", label: "Customer" },
        { key: "jobs", label: "Jobs", format: "number" },
        { key: "priced", label: "Priced", format: "number" },
        { key: "missing", label: "Missing revenue", format: "number" },
        { key: "revenue", label: "Revenue (SGD)", format: "currency" },
        { key: "cost", label: "Cost (SGD)", format: "currency" },
        { key: "profit", label: "Profit (SGD)", format: "currency" },
        { key: "margin", label: "Margin (%)", format: "percent" },
      ],
      rows: report.rows.map(r => ({
        customer: r.name,
        jobs: r.job_count,
        priced: r.priced_jobs,
        missing: r.missing_revenue_jobs,
        revenue: r.revenue,
        cost: r.cost,
        profit: r.profit,
        margin: r.margin,
      })),
    };
  }

  const report = buildProfitRiskReport(jobs, data.financials ?? []);
  const finances = new Map((data.financials ?? []).map(f => [f.job_id, f]));
  return {
    title: "Financial Summary",
    note: "Financial totals cover jobs with entered revenue only. Costs from jobs without revenue are excluded until priced. Currency: SGD.",
    metrics: [
      { label: "Priced jobs", value: report.summary.priced_jobs },
      { label: "Missing revenue", value: report.summary.missing_revenue_jobs },
      { label: "Revenue (SGD)", value: report.summary.revenue, format: "currency" },
      { label: "Cost (SGD)", value: report.summary.cost, format: "currency" },
      { label: "Profit (SGD)", value: report.summary.profit, format: "currency" },
      { label: "Margin", value: report.summary.margin, format: "percent" },
      { label: "Loss-making jobs", value: report.summary.loss_jobs },
    ],
    columns: [
      { key: "job_number", label: "Job" },
      { key: "customer", label: "Customer" },
      { key: "scheduled_date", label: "Scheduled date" },
      { key: "revenue", label: "Revenue (SGD)", format: "currency" },
      { key: "cost", label: "Cost (SGD)", format: "currency" },
      { key: "profit", label: "Profit (SGD)", format: "currency" },
      { key: "margin", label: "Margin (%)", format: "percent" },
    ],
    rows: jobs.map(j => {
      const f = finances.get(j.id);
      const priced = Boolean(f && f.revenue !== null);
      const totals = priced && f ? getFinancialTotals({
        revenue: Number(f.revenue),
        driver_cost: Number(f.driver_cost),
        fuel_cost: Number(f.fuel_cost),
        vehicle_cost: Number(f.vehicle_cost),
        other_cost: Number(f.other_cost),
      }) : null;
      return {
        job_number: j.job_number,
        customer: j.customer ?? "Unknown",
        scheduled_date: j.scheduled_date ?? "—",
        revenue: priced && f ? Number(f.revenue) : null,
        cost: totals?.total_cost ?? null,
        profit: totals?.profit ?? null,
        margin: totals?.margin ?? null,
      };
    }),
  };
}

// Escape spreadsheet formulas from user-controlled strings (names, job labels).
// Numeric values stay numbers for spreadsheet calculations.
function csvCell(value: ReportValue): string {
  if (value === null) return "";
  if (typeof value === "number") return String(value);
  const safe = /^[\s\uFEFF]*[=+\-@]/.test(value) ? `'${value}` : value;
  return `"${safe.replace(/"/g, '""')}"`;
}

export function enterpriseReportCsv(report: EnterpriseReport): string {
  const headers = report.columns.map(c => csvCell(c.label)).join(",");
  const rows = report.rows.map(row => report.columns.map(c => csvCell(row[c.key] ?? null)).join(","));
  // UTF-8 BOM improves Excel compatibility for customer names with non-ASCII characters.
  return `\uFEFF${[headers, ...rows].join("\r\n")}\r\n`;
}
