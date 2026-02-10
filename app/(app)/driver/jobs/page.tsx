// app/(app)/driver/jobs/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { PageShell } from "@/components/PageShell";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import type { JobStatus } from "@/lib/mockStore";

type Driver = { id: string; name: string };
type JobRow = any;

function toUiJob(j: JobRow) {
  const driverName = j?.drivers?.name ?? undefined;
  const vehiclePlate = j?.vehicles?.plate_no ?? undefined;

  return {
    id: j.job_number ?? String(j.id),
    customer: j.customer,
    pickup: j.pickup,
    dropoff: j.dropoff,
    driver: driverName,
    vehicle: vehiclePlate,
    status: (j.status as JobStatus) ?? "pending",
    createdAt: j.created_at ? new Date(j.created_at).getTime() : Date.now(),
  };
}

export default function DriverJobsPage() {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [driverId, setDriverId] = useState("");
  const [scope, setScope] = useState<"today" | "upcoming">("today");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [rows, setRows] = useState<JobRow[]>([]);

  const jobs = useMemo(() => rows.map(toUiJob), [rows]);

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/drivers");
      const json = await res.json();
      if (res.ok) {
        const list = (json.drivers ?? []) as Driver[];
        setDrivers(list);
        if (list[0]?.id) setDriverId(list[0].id);
      }
    })();
  }, []);

  useEffect(() => {
    if (!driverId) return;

    (async () => {
      setError("");
      setLoading(true);
      try {
        const res = await fetch(
          `/api/driver-jobs?driverId=${encodeURIComponent(driverId)}&scope=${scope}`,
          { cache: "no-store" }
        );
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error || "Failed to load jobs");
        setRows(json.jobs ?? []);
      } catch (e: any) {
        setError(e?.message || "Failed to load jobs");
        setRows([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [driverId, scope]);

  return (
    <PageShell>
      <PageHeader
        title="Driver Jobs"
        subtitle="View jobs assigned to a driver (today / upcoming)"
        action={
          <Link href="/jobs">
            <Button variant="outlineDark">Back to Jobs</Button>
          </Link>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <div className="text-sm font-medium text-neutral-900">Filters</div>
            <div className="mt-1 text-sm text-neutral-500">Pick a driver and scope.</div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3">
              <label className="text-xs text-neutral-500">Driver</label>
              <select
                className="w-full rounded-md border bg-white px-3 py-2 text-sm text-black"
                value={driverId}
                onChange={(e) => setDriverId(e.target.value)}
              >
                {drivers.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>

              <label className="mt-3 text-xs text-neutral-500">Scope</label>
              <div className="flex gap-2">
                <Button
                  variant={scope === "today" ? "primary" : "outline"}
                  type="button"
                  onClick={() => setScope("today")}
                >
                  Today
                </Button>
                <Button
                  variant={scope === "upcoming" ? "primary" : "outline"}
                  type="button"
                  onClick={() => setScope("upcoming")}
                >
                  Upcoming
                </Button>
              </div>
            </div>

            {error ? <div className="mt-4 text-sm text-red-600">{error}</div> : null}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="text-sm font-medium text-neutral-900">Assigned jobs</div>
            <div className="mt-1 text-sm text-neutral-500">
              {loading ? "Loading..." : `${jobs.length} job(s)`}
            </div>
          </CardHeader>

          <CardContent>
            {loading ? (
              <div className="text-sm text-neutral-500">Loading jobs…</div>
            ) : jobs.length === 0 ? (
              <div className="text-sm text-neutral-500">No jobs found.</div>
            ) : (
              <div className="space-y-3">
                {jobs.map((j) => (
                  <Link key={j.id} href={`/jobs/${j.id}`} className="block">
                    <div className="rounded-xl border border-neutral-200 bg-white p-4 hover:bg-neutral-50">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-neutral-900">{j.id}</div>
                          <div className="mt-1 text-sm text-neutral-600">{j.customer}</div>
                          <div className="mt-2 text-xs text-neutral-500">
                            {j.pickup} → {j.dropoff}
                          </div>
                          <div className="mt-2 text-xs text-neutral-500">
                            {j.vehicle ? `Vehicle: ${j.vehicle}` : "Vehicle: -"}
                          </div>
                        </div>
                        <StatusBadge status={j.status} />
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </PageShell>
  );
}
