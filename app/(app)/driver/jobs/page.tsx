// app/(app)/driver/jobs/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { PageShell } from "@/components/PageShell";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";

type JobStatus = "pending" | "assigned" | "in_transit" | "delivered";

// what API returns (minimal fields we use)
type JobRow = {
  id: string; // db uuid
  job_number: string;

  customer?: string | null; // snapshot fallback
  customers?: { name: string } | null;

  pickup: string;
  dropoff: string;

  status: JobStatus;

  created_at: string;

  scheduled_date?: string | null;
  window_start?: string | null;
  window_end?: string | null;

  drivers?: { name: string } | null;
  vehicles?: { plate_no: string } | null;
};

type UiJob = {
  id: string; // job_number for routing
  customer: string;
  pickup: string;
  dropoff: string;
  vehicle?: string;
  status: JobStatus;
  createdAt: number;

  scheduled_date?: string | null;
  window_start?: string | null;
  window_end?: string | null;
};

function toUiJob(j: JobRow): UiJob {
  const vehiclePlate = j?.vehicles?.plate_no ?? undefined;

  return {
    id: j.job_number, // ✅ always use job_number for /jobs/[id]
    customer: j?.customers?.name ?? j?.customer ?? "-",
    pickup: j.pickup,
    dropoff: j.dropoff,
    vehicle: vehiclePlate,
    status: j.status ?? "pending",
    createdAt: j.created_at ? new Date(j.created_at).getTime() : Date.now(),

    scheduled_date: j.scheduled_date ?? null,
    window_start: j.window_start ?? null,
    window_end: j.window_end ?? null,
  };
}

function formatWindow(start?: string | null, end?: string | null) {
  const s = (start ?? "").trim();
  const e = (end ?? "").trim();
  if (!s && !e) return "";
  if (s && e) return `${s}-${e}`;
  return s || e;
}

export default function DriverJobsPage() {
  const [scope, setScope] = useState<"today" | "upcoming">("today");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [rows, setRows] = useState<JobRow[]>([]);

  const jobs = useMemo(() => rows.map(toUiJob), [rows]);

  async function load() {
    setError("");
    setLoading(true);

    try {
      const res = await fetch(`/api/driver-jobs?scope=${scope}`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to load jobs");
      setRows((json.jobs ?? []) as JobRow[]);
    } catch (e: any) {
      setError(e?.message || "Failed to load jobs");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope]);

  return (
    <PageShell>
      <PageHeader
        title="My Jobs"
        subtitle="Jobs assigned to you (today / upcoming)"
        action={
          <Link href="/jobs">
            <Button variant="outline">Back to Jobs</Button>
          </Link>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <div className="text-sm font-medium text-neutral-900">Scope</div>
            <div className="mt-1 text-sm text-neutral-500">Switch between today and upcoming.</div>
          </CardHeader>

          <CardContent>
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

            <div className="mt-3">
              <Button variant="outline" type="button" onClick={load} disabled={loading}>
                {loading ? "Refreshing..." : "Refresh"}
              </Button>
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
              <div className="text-sm text-neutral-500">
                No jobs found. (If this is wrong, check profiles.driver_id is set.)
              </div>
            ) : (
              <div className="space-y-3">
                {jobs.map((j) => {
                  const win = formatWindow(j.window_start, j.window_end);

                  return (
                    <Link key={j.id} href={`/jobs/${j.id}`} className="block">
                      <div className="rounded-xl border border-neutral-200 p-4 hover:bg-neutral-50">
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

                            <div className="mt-2 text-xs text-neutral-500">
                              Schedule: {j.scheduled_date ?? "-"}
                              {win ? ` (${win})` : ""}
                            </div>
                          </div>

                          <StatusBadge status={j.status} />
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </PageShell>
  );
}
