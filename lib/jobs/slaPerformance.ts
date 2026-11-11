import { getJobSla, type JobSlaInput } from "@/lib/jobs/sla";

export type SlaAnalyticsJob = JobSlaInput & {
  id: string;
  customer_id: string | null;
  customer: string | null;
};

export type SlaMetrics = {
  jobs: number;
  completed: number;
  open: number;
  with_target: number;
  missing_target: number;
  measured: number;
  on_time: number;
  delivered_late: number;
  missing_completion_time: number;
  open_breached: number;
  open_at_risk: number;
  open_on_track: number;
  on_time_rate: number | null;
  target_coverage: number | null;
};

export type CustomerSlaRow = SlaMetrics & {
  key: string;
  customer: string;
};

export type SlaPerformanceReport = {
  summary: SlaMetrics;
  customers: CustomerSlaRow[];
};

function percentage(part: number, total: number): number | null {
  return total === 0 ? null : Math.round((part / total) * 1000) / 10;
}

function emptyMetrics(): SlaMetrics {
  return {
    jobs: 0,
    completed: 0,
    open: 0,
    with_target: 0,
    missing_target: 0,
    measured: 0,
    on_time: 0,
    delivered_late: 0,
    missing_completion_time: 0,
    open_breached: 0,
    open_at_risk: 0,
    open_on_track: 0,
    on_time_rate: null,
    target_coverage: null,
  };
}

function countJob(metrics: SlaMetrics, job: SlaAnalyticsJob) {
  metrics.jobs++;
  const sla = getJobSla(job); // Same SLA rules as Jobs and Profit & Risk.

  if (!sla.targetAt) {
    metrics.missing_target++;
  } else {
    metrics.with_target++;
  }

  if (job.status !== "delivered") {
    metrics.open++;
    if (sla.status === "breached") metrics.open_breached++;
    if (sla.status === "at_risk") metrics.open_at_risk++;
    if (sla.status === "on_track") metrics.open_on_track++;
    return;
  }

  metrics.completed++;
  if (!sla.targetAt) return; // No deadline means punctuality is unknown.

  // Important: getJobSla() labels missing delivered_at as 'Completed';
  // never count that as on-time delivery in analytics.
  if (!job.delivered_at || !Number.isFinite(Date.parse(job.delivered_at))) {
    metrics.missing_completion_time++;
    return;
  }

  if (sla.status === "completed_on_time") {
    metrics.on_time++;
    metrics.measured++;
  } else if (sla.status === "completed_late") {
    metrics.delivered_late++;
    metrics.measured++;
  }
}

function addRates(metrics: SlaMetrics) {
  metrics.on_time_rate = percentage(metrics.on_time, metrics.measured);
  metrics.target_coverage = percentage(metrics.with_target, metrics.jobs);
}

export function buildSlaPerformance(jobs: SlaAnalyticsJob[]): SlaPerformanceReport {
  const summary = emptyMetrics();
  const byCustomer = new Map<string, CustomerSlaRow>();

  for (const job of jobs) {
    countJob(summary, job);
    // Customer ID when present; otherwise group by the job's name snapshot.
    const name = job.customer?.trim() || "Unknown customer";
    const key = job.customer_id ? `id:${job.customer_id}` : `name:${name}`;
    let row = byCustomer.get(key);
    if (!row) {
      row = {
        ...emptyMetrics(),
        key,
        customer: job.customer_id ? name : `Unlinked: ${name}`,
      };
      byCustomer.set(key, row);
    }
    countJob(row, job);
  }

  addRates(summary);
  const customers = Array.from(byCustomer.values());
  for (const row of customers) addRates(row);
  customers.sort((a, b) => a.customer.localeCompare(b.customer));
  return { summary, customers };
}
