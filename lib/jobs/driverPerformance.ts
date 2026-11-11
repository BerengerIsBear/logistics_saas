import { getJobSla, type JobSlaInput } from "@/lib/jobs/sla";

// Only completed jobs with a target AND a valid completion timestamp count
// towards punctuality. Missing information must never be treated as on time.
export type PerformanceDriver = {
  id: string;
  name: string;
  is_active: boolean;
};

export type PerformanceJob = JobSlaInput & {
  id: string;
  driver_id: string | null;
};

export type DriverPerformanceRow = {
  id: string;
  name: string;
  is_active: boolean;
  assigned_jobs: number;
  completed_jobs: number;
  open_jobs: number;
  open_sla_breaches: number;
  measured_deliveries: number;
  on_time: number;
  late: number;
  no_sla_completed: number;
  missing_completion_time: number;
  on_time_rate: number | null;
  late_rate: number | null;
};

export type DriverPerformanceReport = {
  summary: {
    drivers: number;
    assigned_jobs: number;
    completed_jobs: number;
    measured_deliveries: number;
    on_time: number;
    late: number;
    open_sla_breaches: number;
    no_sla_completed: number;
    missing_completion_time: number;
    on_time_rate: number | null;
  };
  rows: DriverPerformanceRow[];
};

function rate(numerator: number, denominator: number): number | null {
  return denominator ? Math.round((numerator / denominator) * 1000) / 10 : null;
}

export function buildDriverPerformance(
  drivers: PerformanceDriver[],
  jobs: PerformanceJob[]
): DriverPerformanceReport {
  const rows: DriverPerformanceRow[] = drivers.map(driver => ({
    id: driver.id,
    name: driver.name,
    is_active: driver.is_active,
    assigned_jobs: 0,
    completed_jobs: 0,
    open_jobs: 0,
    open_sla_breaches: 0,
    measured_deliveries: 0,
    on_time: 0,
    late: 0,
    no_sla_completed: 0,
    missing_completion_time: 0,
    on_time_rate: null,
    late_rate: null,
  }));
  const byId = new Map(rows.map(row => [row.id, row]));

  for (const job of jobs) {
    // Unassigned jobs are not attributed to any driver.
    const row = job.driver_id ? byId.get(job.driver_id) : undefined;
    if (!row) continue;
    row.assigned_jobs++;

    if (job.status !== "delivered") {
      row.open_jobs++;
      if (getJobSla(job).status === "breached") row.open_sla_breaches++;
      continue;
    }

    row.completed_jobs++;
    // getJobSla() treats a missing delivered_at as completed; exclude those
    // from measured performance rather than recording them as on-time.
    const sla = getJobSla(job);
    if (sla.status === "no_target") {
      row.no_sla_completed++;
      continue;
    }
    if (!job.delivered_at || !Number.isFinite(Date.parse(job.delivered_at))) {
      row.missing_completion_time++;
      continue;
    }

    if (sla.status === "completed_on_time") {
      row.on_time++;
      row.measured_deliveries++;
    } else if (sla.status === "completed_late") {
      row.late++;
      row.measured_deliveries++;
    }
  }

  for (const row of rows) {
    row.on_time_rate = rate(row.on_time, row.measured_deliveries);
    row.late_rate = rate(row.late, row.measured_deliveries);
  }
  rows.sort((a, b) => a.name.localeCompare(b.name));

  const summary = {
    drivers: rows.length,
    assigned_jobs: rows.reduce((sum, row) => sum + row.assigned_jobs, 0),
    completed_jobs: rows.reduce((sum, row) => sum + row.completed_jobs, 0),
    measured_deliveries: rows.reduce((sum, row) => sum + row.measured_deliveries, 0),
    on_time: rows.reduce((sum, row) => sum + row.on_time, 0),
    late: rows.reduce((sum, row) => sum + row.late, 0),
    open_sla_breaches: rows.reduce((sum, row) => sum + row.open_sla_breaches, 0),
    no_sla_completed: rows.reduce((sum, row) => sum + row.no_sla_completed, 0),
    missing_completion_time: rows.reduce((sum, row) => sum + row.missing_completion_time, 0),
    on_time_rate: null as number | null,
  };
  summary.on_time_rate = rate(summary.on_time, summary.measured_deliveries);
  return { summary, rows };
}
