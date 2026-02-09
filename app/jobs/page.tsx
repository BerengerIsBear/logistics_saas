// app/jobs/page.tsx
"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { getJobs, subscribe, type JobStatus } from "@/lib/mockStore";

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
  const jobs = useSyncExternalStore(subscribe, getJobs, getJobs);

  return (
    <main className="p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Jobs</h1>
          <p className="mt-1 text-sm text-gray-600">
            Track deliveries, assign drivers, and update status.
          </p>
        </div>

        {/* Create Job – white primary button */}
        <Link
          href="/jobs/new"
          className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-gray-50"
        >
          + Create Job
        </Link>
      </div>

      <div className="mt-6 overflow-hidden rounded-lg border bg-white text-gray-700">
        <table className="w-full text-sm">
          <thead className="bg-gray-100 text-left text-xs font-semibold uppercase tracking-wide text-gray-600 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3">Job ID</th>
              <th className="px-4 py-3">Customer</th>
              <th className="px-4 py-3">Pickup</th>
              <th className="px-4 py-3">Drop-off</th>
              <th className="px-4 py-3">Driver</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>

          <tbody className="divide-y text-gray-600">
            {jobs.map((job) => (
              <tr key={job.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium">
                  <Link
                    href={`/jobs/${job.id}`}
                    className="text-gray-700 hover:text-gray-900 hover:underline"
                  >
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

            {jobs.length === 0 && (
              <tr>
                <td className="px-4 py-6 text-sm text-gray-500" colSpan={6}>
                  No jobs yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
