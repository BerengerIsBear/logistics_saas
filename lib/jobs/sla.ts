// lib/jobs/sla.ts

export type JobSlaStatus =
  | "no_target"
  | "on_track"
  | "at_risk"
  | "breached"
  | "completed_on_time"
  | "completed_late";

export type JobSlaInput = {
  status: "pending" | "assigned" | "in_transit" | "delivered";
  scheduled_date: string | null;
  window_end: string | null;
  delivered_at: string | null;
};

export type JobSlaResult = {
  status: JobSlaStatus;
  label: string;
  targetAt: Date | null;
  minutesToTarget: number | null;
  minutesLate: number | null;
};

const AT_RISK_MINUTES = 30;

export function getJobSla(job: JobSlaInput): JobSlaResult {
  const targetAt = getTargetDateTime(job.scheduled_date, job.window_end);

  if (!targetAt) {
    return {
      status: "no_target",
      label: "No SLA",
      targetAt: null,
      minutesToTarget: null,
      minutesLate: null,
    };
  }

  if (job.status === "delivered") {
    if (!job.delivered_at) {
      return {
        status: "completed_on_time",
        label: "Completed",
        targetAt,
        minutesToTarget: null,
        minutesLate: null,
      };
    }

    const deliveredAt = new Date(job.delivered_at);
    const diffMinutes = Math.round(
      (deliveredAt.getTime() - targetAt.getTime()) / 60000
    );

    if (diffMinutes <= 0) {
      return {
        status: "completed_on_time",
        label: "On Time",
        targetAt,
        minutesToTarget: null,
        minutesLate: null,
      };
    }

    return {
      status: "completed_late",
      label: "Late",
      targetAt,
      minutesToTarget: null,
      minutesLate: diffMinutes,
    };
  }

  const now = new Date();
  const minutesToTarget = Math.round(
    (targetAt.getTime() - now.getTime()) / 60000
  );

  if (minutesToTarget < 0) {
    return {
      status: "breached",
      label: "Breached",
      targetAt,
      minutesToTarget,
      minutesLate: Math.abs(minutesToTarget),
    };
  }

  if (minutesToTarget <= AT_RISK_MINUTES) {
    return {
      status: "at_risk",
      label: "At Risk",
      targetAt,
      minutesToTarget,
      minutesLate: null,
    };
  }

  return {
    status: "on_track",
    label: "On Track",
    targetAt,
    minutesToTarget,
    minutesLate: null,
  };
}

export function formatSlaTarget(value: Date | null) {
  if (!value) {
    return "-";
  }

  return value.toLocaleString();
}

export function formatSlaDetail(sla: JobSlaResult) {
  if (sla.status === "no_target") {
    return "No delivery target set.";
  }

  if (sla.status === "completed_on_time") {
    return "Delivered within target.";
  }

  if (sla.status === "completed_late") {
    return sla.minutesLate
      ? `Delivered ${formatDuration(sla.minutesLate)} late.`
      : "Delivered late.";
  }

  if (sla.status === "breached") {
    return sla.minutesLate
      ? `${formatDuration(sla.minutesLate)} late.`
      : "Target missed.";
  }

  if (sla.status === "at_risk") {
    return sla.minutesToTarget
      ? `${formatDuration(sla.minutesToTarget)} left.`
      : "Close to deadline.";
  }

  if (sla.status === "on_track") {
    return sla.minutesToTarget
      ? `${formatDuration(sla.minutesToTarget)} left.`
      : "Within delivery window.";
  }

  return "-";
}

function getTargetDateTime(date: string | null, time: string | null) {
  if (!date || !time) {
    return null;
  }

  const cleanTime = time.length === 5 ? `${time}:00` : time;
  const parsed = new Date(`${date}T${cleanTime}`);

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed;
}

function formatDuration(totalMinutes: number) {
  const minutes = Math.abs(Math.round(totalMinutes));

  if (minutes < 60) {
    return `${minutes} min`;
  }

  const hours = Math.round(minutes / 60);

  if (hours < 24) {
    return `${hours} hr`;
  }

  const days = Math.round(hours / 24);

  if (days < 30) {
    return `${days} day${days === 1 ? "" : "s"}`;
  }

  const months = Math.round(days / 30);

  return `${months} month${months === 1 ? "" : "s"}`;
}