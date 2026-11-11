import { formatSlaDetail, getJobSla, type JobSlaInput } from "@/lib/jobs/sla";

// Operational-only: no revenue or other confidential financial fields.
export type OperationalJob = JobSlaInput & {
  job_number: string;
  customer: string | null;
  driver_id: string | null;
  vehicle_id: string | null;
};

export type RiskLevel = "high" | "medium" | "low" | "unknown";

export type OperationalRiskRow = {
  job_number: string;
  customer: string;
  status: OperationalJob["status"];
  level: RiskLevel;
  score: number | null;
  reasons: string[];
  sla_detail: string;
};

export type OperationalRiskReport = {
  summary: {
    open_jobs: number;
    high: number;
    medium: number;
    low: number;
    unknown: number;
  };
  rows: OperationalRiskRow[];
};

// A simple PRIORITY index (0-100), not the probability of a delivery failure.
// The highest applicable rule wins. Delivered jobs are excluded from the live queue.
export function scoreOperationalJob(job: OperationalJob): OperationalRiskRow | null {
  if (job.status === "delivered") return null;

  const sla = getJobSla(job); // Reuse the app's existing SLA deadline rules.
  let score: number | null = null;
  const reasons: string[] = [];

  if (sla.status === "breached") {
    score = 100;
    reasons.push("Delivery deadline breached");
  } else if (sla.status === "at_risk") {
    score = 70;
    reasons.push("Deadline within 30 minutes");
  } else if (sla.status === "on_track") {
    score = 10;
  } else {
    reasons.push("Delivery deadline not set");
  }

  // Assigned or in-transit jobs should have both resources linked.
  // A missing resource is actionable even if no deadline was entered.
  if (job.status === "assigned" || job.status === "in_transit") {
    if (!job.driver_id) {
      score = Math.max(score ?? 0, 85);
      reasons.push("Driver not assigned");
    }
    if (!job.vehicle_id) {
      score = Math.max(score ?? 0, 85);
      reasons.push("Vehicle not assigned");
    }
  }

  // Pending jobs due within 24h need dispatch attention.
  if (
    job.status === "pending" &&
    sla.minutesToTarget !== null &&
    sla.minutesToTarget >= 0 &&
    sla.minutesToTarget <= 24 * 60
  ) {
    score = Math.max(score ?? 0, 55);
    reasons.push("Pending assignment, due within 24 hours");
  }

  const level: RiskLevel = score === null ? "unknown"
    : score >= 80 ? "high"
    : score >= 50 ? "medium"
    : "low";

  if (!reasons.length) reasons.push("No immediate issue detected");

  return {
    job_number: job.job_number,
    customer: job.customer?.trim() || "Unknown customer",
    status: job.status,
    level,
    score,
    reasons,
    sla_detail: formatSlaDetail(sla),
  };
}

const priority: Record<RiskLevel, number> = {
  high: 0,
  medium: 1,
  unknown: 2,
  low: 3,
};

export function buildOperationalRisk(jobs: OperationalJob[]): OperationalRiskReport {
  const rows: OperationalRiskRow[] = [];
  const summary = { open_jobs: 0, high: 0, medium: 0, low: 0, unknown: 0 };

  for (const job of jobs) {
    const result = scoreOperationalJob(job);
    if (!result) continue;
    summary.open_jobs++;
    summary[result.level]++;
    rows.push(result);
  }

  rows.sort((a, b) => priority[a.level] - priority[b.level] ||
    (b.score ?? -1) - (a.score ?? -1) ||
    a.job_number.localeCompare(b.job_number));

  return { summary, rows };
}
