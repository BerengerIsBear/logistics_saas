// app/jobs/[id]/page.tsx
"use client";

import { use, useMemo, useState } from "react";
import Link from "next/link";
import {
  getJobById,
  updateJobStatus,
  type JobStatus,
} from "@/lib/mockStore";

function labelStatus(s: JobStatus) {
  switch (s) {
    case "pending":
      return "Pending";
    case "assigned":
      return "Assigned";
    case "in_transit":
      return "In Transit";
    case "delivered":
      return "Delivered";
  }
}

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
      <main className="p-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Job not found</h1>
          <Link className="text-sm underline" href="/jobs">
            Back to Jobs
          </Link>
        </div>
        <p className="mt-2 text-gray-600">
          No job found for ID: <span className="font-medium">{id}</span>
        </p>
      </main>
    );
  }

  function onSave() {
    if (!job) return;

    updateJobStatus(job.id, status);
    setSavedMsg("Saved!");
    setTimeout(() => setSavedMsg(""), 1200);
  }

  const labelClass = "text-xs text-gray-500";
  const valueClass = "mt-1 font-medium text-gray-900";

  return (
    <main className="p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{job.id}</h1>
          <p className="mt-1 text-sm text-gray-600">{job.customer}</p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/jobs"
            className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-gray-50"
          >
            Back
          </Link>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        {/* Job Info */}
        <section className="lg:col-span-2 rounded-lg border bg-white p-5 text-gray-800">
          <h2 className="text-sm font-semibold text-gray-900">Job Info</h2>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <div className={labelClass}>Pickup</div>
              <div className={valueClass}>{job.pickup}</div>
            </div>

            <div>
              <div className={labelClass}>Drop-off</div>
              <div className={valueClass}>{job.dropoff}</div>
            </div>

            <div>
              <div className={labelClass}>Driver</div>
              <div className={valueClass}>{job.driver ?? "-"}</div>
            </div>

            <div>
              <div className={labelClass}>Status</div>
              <div className={valueClass}>{labelStatus(status)}</div>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <label className="text-sm font-medium text-gray-700">
              Update status
            </label>

            <select
              className="rounded-md border px-3 py-2 text-sm text-gray-900"
              value={status}
              onChange={(e) => setStatus(e.target.value as JobStatus)}
            >
              <option value="pending">Pending</option>
              <option value="assigned">Assigned</option>
              <option value="in_transit">In Transit</option>
              <option value="delivered">Delivered</option>
            </select>

            <button
              onClick={onSave}
              className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white hover:opacity-90"
            >
              Save
            </button>

            {savedMsg && <span className="text-sm text-gray-700">{savedMsg}</span>}
          </div>

          <p className="mt-2 text-xs text-gray-500">
            (MVP: Save updates the mock store only. Later we’ll save to Supabase.)
          </p>
        </section>

        {/* POD Upload placeholder */}
        <section className="rounded-lg border bg-white p-5 text-gray-800">
          <h2 className="text-sm font-semibold text-gray-900">
            Proof of Delivery
          </h2>

          <div className="mt-4 rounded-lg border-2 border-dashed border-gray-200 p-6 text-center">
            <div className="text-sm font-medium text-gray-900">Upload POD</div>
            <p className="mt-1 text-xs text-gray-600">
              Photo / signature will go here.
            </p>

            <button
              onClick={() => alert("POD upload coming next")}
              className="mt-4 rounded-md border px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50"
            >
              Choose File
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}
