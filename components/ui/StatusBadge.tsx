// components/ui/StatusBadge.tsx
import { cn } from "@/lib/cn";

export type JobStatus =
  | "pending"
  | "assigned"
  | "in_transit"
  | "delivered";

const styles: Record<JobStatus, string> = {
  pending: "bg-yellow-100 text-yellow-700",
  assigned: "bg-blue-100 text-blue-700",
  in_transit: "bg-purple-100 text-purple-700",
  delivered: "bg-green-100 text-green-700",
};

const labels: Record<JobStatus, string> = {
  pending: "Pending",
  assigned: "Assigned",
  in_transit: "In Transit",
  delivered: "Delivered",
};

export function StatusBadge({ status }: { status: JobStatus }) {
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

