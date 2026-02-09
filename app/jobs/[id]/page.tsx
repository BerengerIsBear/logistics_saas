// app/jobs/[id]/page.tsx
"use client";

import { use, useMemo, useState } from "react";
import Link from "next/link";
import { getJobById, updateJobStatus, type JobStatus } from "@/lib/mockStore";

import { PageShell } from "@/components/PageShell";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { StatusBadge } from "@/components/ui/StatusBadge";

export default function JobDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  const job = useMemo(() => getJobById(id), [id]);

  const [status, setStatus] = useState<JobStatus>(job?.status ?? "pending");
  const [savedMsg, setSavedMsg] = useState("");

  if (!job) {
    return (
      <PageShell>
        <PageHeader
          title="Job not found"
          subtitle={`No job found for ID: ${id}`}
          action={
            <Link href="/jobs">
              <Button variant="outlineDark">Back to Jobs</Button>
            </Link>
          }
        />
      </PageShell>
    );
  }

  function onSave() {
    updateJobStatus(id, status);
    setSavedMsg("Saved!");
    setTimeout(() => setSavedMsg(""), 1200);
  }

  return (
    <PageShell>
      <PageHeader
        title={job.id}
        subtitle={job.customer}
        action={
          <Link href="/jobs">
            <Button variant="outlineDark">Back</Button>
          </Link>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Job Info */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-medium text-neutral-900">Job Info</div>
                <div className="mt-1 text-sm text-neutral-500">
                  View details and update the job status.
                </div>
              </div>
              <StatusBadge status={status} />
            </div>
          </CardHeader>

          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <div className="text-xs text-neutral-500">Pickup</div>
                <div className="mt-1 font-medium text-neutral-900">{job.pickup}</div>
              </div>

              <div>
                <div className="text-xs text-neutral-500">Drop-off</div>
                <div className="mt-1 font-medium text-neutral-900">{job.dropoff}</div>
              </div>

              <div>
                <div className="text-xs text-neutral-500">Driver</div>
                <div className="mt-1 font-medium text-neutral-900">{job.driver ?? "-"}</div>
              </div>

              <div>
                <div className="text-xs text-neutral-500">Status</div>
                <div className="mt-1 font-medium text-neutral-900">
                  {status === "in_transit"
                    ? "In Transit"
                    : status.charAt(0).toUpperCase() + status.slice(1)}
                </div>
              </div>
            </div>

            {job.notes ? (
              <div className="mt-6">
                <div className="text-xs text-neutral-500">Notes</div>
                <div className="mt-1 font-medium text-neutral-900">{job.notes}</div>
              </div>
            ) : null}

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <div className="text-sm font-medium text-neutral-700">Update status</div>

              <div className="min-w-[220px]">
                <Select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as JobStatus)}
                >
                  <option value="pending">Pending</option>
                  <option value="assigned">Assigned</option>
                  <option value="in_transit">In Transit</option>
                  <option value="delivered">Delivered</option>
                </Select>
              </div>

              <Button variant="primary" type="button" onClick={onSave}>
                Save
              </Button>

              {savedMsg ? (
                <span className="text-sm text-neutral-700">{savedMsg}</span>
              ) : null}
            </div>

            <p className="mt-3 text-xs text-neutral-500">
              (MVP: Save updates the mock store only. Later we’ll save to Supabase.)
            </p>
          </CardContent>
        </Card>

        {/* POD Upload placeholder */}
        <Card>
          <CardHeader>
            <div className="text-sm font-medium text-neutral-900">Proof of Delivery</div>
            <div className="mt-1 text-sm text-neutral-500">
              Photo / signature will go here.
            </div>
          </CardHeader>

          <CardContent>
            <div className="rounded-xl border-2 border-dashed border-neutral-200 p-6 text-center">
              <div className="text-sm font-medium text-neutral-900">Upload POD</div>
              <p className="mt-1 text-xs text-neutral-500">
                Attach a photo, signature, or document.
              </p>

              <div className="mt-4">
                <Button
                  variant="outline"
                  type="button"
                  onClick={() => alert("POD upload coming next")}
                >
                  Choose File
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </PageShell>
  );
}
