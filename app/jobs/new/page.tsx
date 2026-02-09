"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type JobStatus = "pending" | "assigned" | "in_transit" | "delivered";

type NewJob = {
  customer: string;
  pickup: string;
  dropoff: string;
  driver: string;
  status: JobStatus;
  notes: string;
};

export default function NewJobPage() {
  const router = useRouter();

  const [form, setForm] = useState<NewJob>({
    customer: "",
    pickup: "",
    dropoff: "",
    driver: "",
    status: "pending",
    notes: "",
  });

  function update<K extends keyof NewJob>(key: K, value: NewJob[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();

    // MVP: just simulate "saved" and redirect back to jobs list.
    // Later: replace with Supabase insert.
    console.log("CREATE JOB:", form);

    router.push("/jobs");
  }

  return (
    <main className="p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Create Job</h1>
          <p className="mt-1 text-sm text-gray-600">
            Add a new delivery job (MVP form).
          </p>
        </div>

        <button
          type="button"
          onClick={() => router.push("/jobs")}
          className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-gray-50"
        >
          Back
        </button>
      </div>

      <form
        onSubmit={onSubmit}
        className="mt-6 max-w-2xl space-y-5 rounded-lg border bg-white p-5"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="text-sm font-medium">Customer</label>
            <input
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
              value={form.customer}
              onChange={(e) => update("customer", e.target.value)}
              placeholder="ABC Trading"
              required
            />
          </div>

          <div>
            <label className="text-sm font-medium">Driver (optional)</label>
            <input
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
              value={form.driver}
              onChange={(e) => update("driver", e.target.value)}
              placeholder="Ahmad"
            />
          </div>
        </div>

        <div>
          <label className="text-sm font-medium">Pickup</label>
          <input
            className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
            value={form.pickup}
            onChange={(e) => update("pickup", e.target.value)}
            placeholder="Tuas Warehouse A"
            required
          />
        </div>

        <div>
          <label className="text-sm font-medium">Drop-off</label>
          <input
            className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
            value={form.dropoff}
            onChange={(e) => update("dropoff", e.target.value)}
            placeholder="Changi Cargo Complex"
            required
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="text-sm font-medium">Status</label>
            <select
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
              value={form.status}
              onChange={(e) => update("status", e.target.value as JobStatus)}
            >
              <option value="pending">Pending</option>
              <option value="assigned">Assigned</option>
              <option value="in_transit">In Transit</option>
              <option value="delivered">Delivered</option>
            </select>
          </div>

          <div>
            <label className="text-sm font-medium">Notes (optional)</label>
            <input
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
              value={form.notes}
              onChange={(e) => update("notes", e.target.value)}
              placeholder="Fragile / call before arrival"
            />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white hover:opacity-90"
          >
            Save Job
          </button>

          <span className="text-xs text-gray-500">
            (For now it logs to console and redirects. We’ll connect Supabase
            later.)
          </span>
        </div>
      </form>
    </main>
  );
}
