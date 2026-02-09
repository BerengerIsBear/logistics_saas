"use client";

import { useMemo, useState } from "react";
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
  params: { id: string };
}) {
  const job = useMemo(
    () => mockJobs.find((j) => j.id === params.id),
    [params.id]
  );

  const [status, setStatus] = useState<JobStatus>(job?.status ?? "pending");

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
          No job found for ID: <span className="font-medium">{params.id}</span>
        </p>
      </main>
    );
  }

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
        <section className="lg:col-span-2 rounded-lg border bg-white p-5">
          <h2 className="text-sm font-semibold text-gray-700">Job Info</h2>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <div className="text-xs text-gray-500">Pickup</div>
              <div className="mt-1 font-medium">{job.pickup}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Drop-off</div>
              <div className="mt-1 font-medium">{job.dropoff}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Driver</div>
              <div className="mt-1 font-medium">{job.driver ?? "-"}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Status</div>
              <div className="mt-1 font-medium">{labelStatus(status)}</div>
            </div>
          </div>

          <div className="mt-6 flex items-center gap-3">
            <label className="text-sm font-medium">Update status</label>
            <select
              className="rounded-md border px-3 py-2 text-sm"
              value={status}
              onChange={(e) => setStatus(e.target.value as JobStatus)}
            >
              <option value="pending">Pending</option>
              <option value="assigned">Assigned</option>
              <option value="in_transit">In Transit</option>
              <option value="delivered">Delivered</option>
            </select>

            <button
              onClick={() => console.log("SAVE STATUS", job.id, status)}
              className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white hover:opacity-90"
            >
              Save
            </button>
          </div>

          <p className="mt-2 text-xs text-gray-500">
            (MVP: Save just logs to console. Later we’ll save to Supabase.)
          </p>
        </section>

        {/* POD Upload placeholder */}
        <section className="rounded-lg border bg-white p-5">
          <h2 className="text-sm font-semibold text-gray-700">Proof of Delivery</h2>

          <div className="mt-4 rounded-lg border-2 border-dashed p-6 text-center">
            <div className="text-sm font-medium">Upload POD</div>
            <p className="mt-1 text-xs text-gray-500">
              Photo / signature will go here.
            </p>

            <button
              onClick={() => alert("POD upload coming next")}
              className="mt-4 rounded-md border px-4 py-2 text-sm font-medium hover:bg-gray-50"
            >
              Choose File
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}
