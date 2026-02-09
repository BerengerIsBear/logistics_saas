import Link from "next/link";
type JobStatus = "pending" | "assigned" | "in_transit" | "delivered";

type Job = {
  id: string;
  customer: string;
  pickup: string;
  dropoff: string;
  driver?: string;
  status: JobStatus;
};

const STATUS_LABEL: Record<JobStatus, string> = {
  pending: "Pending",
  assigned: "Assigned",
  in_transit: "In Transit",
  delivered: "Delivered",
};

const STATUS_CLASS: Record<JobStatus, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  assigned: "bg-blue-100 text-blue-800",
  in_transit: "bg-purple-100 text-purple-800",
  delivered: "bg-green-100 text-green-800",
};

const mockJobs: Job[] = [
  {
    id: "JOB-1001",
    customer: "ABC Trading",
    pickup: "Tuas Warehouse A",
    dropoff: "Changi Cargo Complex",
    driver: "Ahmad",
    status: "assigned",
  },
  {
    id: "JOB-1002",
    customer: "Lion Logistics",
    pickup: "Jurong Port",
    dropoff: "Sengkang",
    driver: "Ben",
    status: "in_transit",
  },
  {
    id: "JOB-1003",
    customer: "Evergreen Supplies",
    pickup: "Woodlands",
    dropoff: "Tampines",
    status: "pending",
  },
  {
    id: "JOB-1004",
    customer: "Kopi Bean Co.",
    pickup: "Ubi",
    dropoff: "CBD",
    driver: "Siti",
    status: "delivered",
  },
];

function StatusBadge({ status }: { status: JobStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${STATUS_CLASS[status]}`}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}

export default function JobsPage() {
  return (
    <main className="p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Jobs</h1>
          <p className="mt-1 text-sm text-gray-600">
            Track deliveries, assign drivers, and update status.
          </p>
        </div>

        <a
        href="/jobs/new"
        className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white hover:opacity-90"
        >
        + Create Job
        </a>

      </div>

      <div className="mt-6 overflow-hidden rounded-lg border bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
            <tr>
              <th className="px-4 py-3">Job ID</th>
              <th className="px-4 py-3">Customer</th>
              <th className="px-4 py-3">Pickup</th>
              <th className="px-4 py-3">Drop-off</th>
              <th className="px-4 py-3">Driver</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {mockJobs.map((job) => (
              <tr key={job.id} className="hover:bg-gray-50">
                
                <td className="px-4 py-3 font-medium">
                <Link className="hover:underline" href={`/jobs/${job.id}`}>
                    {job.id}
                </Link>
                </td>

                <td className="px-4 py-3">{job.customer}</td>
                <td className="px-4 py-3">{job.pickup}</td>
                <td className="px-4 py-3">{job.dropoff}</td>
                <td className="px-4 py-3">{job.driver ?? "-"}</td>
                <td className="px-4 py-3">
                  <StatusBadge status={job.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
