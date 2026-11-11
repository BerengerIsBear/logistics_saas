import { getFinancialTotals } from "@/lib/jobs/finance";
import { formatSlaDetail, getJobSla, type JobSlaInput } from "@/lib/jobs/sla";

// The dashboard uses the same financial and SLA rules as Job Details.
// Financial totals include ONLY jobs with recorded revenue.
export type DashboardJob = JobSlaInput & {
  id: string;
  job_number: string;
  customer: string | null;
};

export type DashboardFinancial = {
  job_id: string;
  revenue: number | string | null;
  driver_cost: number | string;
  fuel_cost: number | string;
  vehicle_cost: number | string;
  other_cost: number | string;
};

export type RiskAlert = {
  job_number: string;
  customer: string;
  job_status: DashboardJob["status"];
  signals: string[];
  sla_detail: string;
  profit: number | null;
  severity: "critical" | "warning" | "info";
};

export type ProfitRiskReport = {
  summary: {
    jobs: number;
    priced_jobs: number;
    missing_revenue_jobs: number;
    revenue: number | null;
    cost: number | null;
    profit: number | null;
    margin: number | null;
    loss_jobs: number;
    sla_breached: number; // Open jobs past their delivery deadline
    sla_at_risk: number; // Open jobs <= 30 minutes from deadline
    delivered_late: number;
    no_sla: number;
  };
  alert_count: number;
  alerts: RiskAlert[];
};

// Monetary values are accumulated in cents to avoid floating-point drift.
const toCents = (value: number) => Math.round(value * 100);

export function buildProfitRiskReport(
  jobs: DashboardJob[],
  financials: DashboardFinancial[]
): ProfitRiskReport {
  const byJob = new Map(financials.map(row => [row.job_id, row]));
  let priced = 0;
  let revenueCents = 0;
  let costCents = 0;
  let lossJobs = 0;
  let breached = 0;
  let atRisk = 0;
  let deliveredLate = 0;
  let noSla = 0;
  const rankedAlerts: Array<{ rank: number; alert: RiskAlert }> = [];

  for (const job of jobs) {
    const sla = getJobSla(job);
    if (sla.status === "breached") breached++;
    if (sla.status === "at_risk") atRisk++;
    if (sla.status === "completed_late") deliveredLate++;
    if (sla.status === "no_target") noSla++;

    const raw = byJob.get(job.id);
    const hasRevenue = Boolean(raw && raw.revenue !== null);
    let profit: number | null = null;
    if (hasRevenue && raw) {
      const revenue = Number(raw.revenue);
      const totals = getFinancialTotals({
        revenue,
        driver_cost: Number(raw.driver_cost),
        fuel_cost: Number(raw.fuel_cost),
        vehicle_cost: Number(raw.vehicle_cost),
        other_cost: Number(raw.other_cost),
      });
      priced++;
      revenueCents += toCents(revenue);
      costCents += toCents(totals.total_cost);
      profit = totals.profit;
      if (profit !== null && profit < 0) lossJobs++;
    }

    // One alert per job, with multiple signals when applicable.
    const signals: string[] = [];
    if (sla.status === "breached") signals.push("SLA breached");
    if (sla.status === "at_risk") signals.push("SLA at risk");
    if (sla.status === "completed_late") signals.push("Delivered late");
    if (profit !== null && profit < 0) signals.push("Loss-making");
    if (!hasRevenue) signals.push("Missing revenue");
    if (!signals.length) continue;

    const severity: RiskAlert["severity"] =
      sla.status === "breached" || (profit !== null && profit < 0)
        ? "critical"
        : sla.status === "at_risk" || sla.status === "completed_late"
          ? "warning"
          : "info";
    const rank = sla.status === "breached" ? 0
      : sla.status === "at_risk" ? 1
      : profit !== null && profit < 0 ? 2
      : sla.status === "completed_late" ? 3 : 4;

    rankedAlerts.push({
      rank,
      alert: {
        job_number: job.job_number,
        customer: job.customer ?? "Unknown customer",
        job_status: job.status,
        signals,
        sla_detail: formatSlaDetail(sla),
        profit,
        severity,
      },
    });
  }

  rankedAlerts.sort((a, b) => a.rank - b.rank ||
    a.alert.job_number.localeCompare(b.alert.job_number));
  const profitCents = revenueCents - costCents;
  return {
    summary: {
      jobs: jobs.length,
      priced_jobs: priced,
      missing_revenue_jobs: jobs.length - priced,
      revenue: priced ? revenueCents / 100 : null,
      cost: priced ? costCents / 100 : null,
      profit: priced ? profitCents / 100 : null,
      margin: priced && revenueCents !== 0
        ? Math.round((profitCents / revenueCents) * 10000) / 100
        : null,
      loss_jobs: lossJobs,
      sla_breached: breached,
      sla_at_risk: atRisk,
      delivered_late: deliveredLate,
      no_sla: noSla,
    },
    alert_count: rankedAlerts.length,
    alerts: rankedAlerts.slice(0, 30).map(item => item.alert),
  };
}
