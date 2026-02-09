// app/jobs/page.tsx
"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { getJobs, subscribe } from "@/lib/mockStore";

import { PageShell } from "@/components/PageShell";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";

export default function JobsPage() {
  const jobs = useSyncExternalStore(subscribe, getJobs, getJobs);

  return (
    <PageShell>
      <PageHeader
        title="Jobs"
        subtitle="Track deliveries, assign drivers, and update status."
        action={
          <Link href="/jobs/new">
            <Button variant="outlineDark">+ Create Job</Button>
          </Link>
        }
      />

      <Card>
        <CardContent className="!p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-neutral-200 bg-neutral-50 text-left text-xs font-semibold uppercase tracking-wide text-neutral-600">
                <tr>
                  <th className="px-6 py-3">Job ID</th>
                  <th className="px-6 py-3">Customer</th>
                  <th className="px-6 py-3">Pickup</th>
                  <th className="px-6 py-3">Drop-off</th>
                  <th className="px-6 py-3">Driver</th>
                  <th className="px-6 py-3">Status</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-neutral-200 text-neutral-700">
                {jobs.map((job) => (
                  <tr key={job.id} className="hover:bg-neutral-50/70">
                    <td className="px-6 py-3 font-medium">
                      <Link
                        href={`/jobs/${job.id}`}
                        className="text-neutral-900 hover:underline"
                      >
                        {job.id}
                      </Link>
                    </td>

                    <td className="px-6 py-3">{job.customer}</td>
                    <td className="px-6 py-3">{job.pickup}</td>
                    <td className="px-6 py-3">{job.dropoff}</td>
                    <td className="px-6 py-3">{job.driver ?? "-"}</td>
                    <td className="px-6 py-3">
                      <StatusBadge status={job.status} />
                    </td>
                  </tr>
                ))}

                {jobs.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-6 py-10 text-center">
                      <div className="text-sm text-neutral-500">No jobs yet.</div>
                      <div className="mt-3">
                        <Link href="/jobs/new">
                          <Button variant="primary">Create your first job</Button>
                        </Link>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </PageShell>
  );
}
