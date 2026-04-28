// components/ui/SlaBadge.tsx

import { cn } from "@/lib/cn";
import type { JobSlaStatus } from "@/lib/jobs/sla";

const styles: Record<JobSlaStatus, string> = {
  no_target: "bg-neutral-100 text-neutral-600",
  on_track: "bg-green-100 text-green-700",
  at_risk: "bg-orange-100 text-orange-700",
  breached: "bg-red-100 text-red-700",
  completed_on_time: "bg-green-100 text-green-700",
  completed_late: "bg-red-100 text-red-700",
};

const labels: Record<JobSlaStatus, string> = {
  no_target: "No SLA",
  on_track: "On Track",
  at_risk: "At Risk",
  breached: "Breached",
  completed_on_time: "On Time",
  completed_late: "Late",
};

export function SlaBadge({ status }: { status: JobSlaStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-3 py-1 text-xs font-medium",
        styles[status]
      )}
    >
      {labels[status]}
    </span>
  );
}