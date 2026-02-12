// app/(app)/driver/jobs/page.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { PageShell } from "@/components/PageShell";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";

type JobStatus = "pending" | "assigned" | "in_transit" | "delivered";

type JobRow = {
  id: string;
  job_number: string;

  customer?: string | null;
  customers?: { name: string } | null;

  pickup: string;
  dropoff: string;

  status: JobStatus;

  created_at: string;

  scheduled_date?: string | null;
  window_start?: string | null;
  window_end?: string | null;

  vehicles?: { plate_no: string } | null;
};

type UiJob = {
  id: string;
  customer: string;
  pickup: string;
  dropoff: string;
  vehicle?: string;
  status: JobStatus;
  scheduled_date?: string | null;
  window_start?: string | null;
  window_end?: string | null;
};

function toUiJob(j: JobRow): UiJob {
  return {
    id: j.job_number,
    customer: j?.customers?.name ?? j?.customer ?? "-",
    pickup: j.pickup,
    dropoff: j.dropoff,
    vehicle: j?.vehicles?.plate_no ?? undefined,
    status: j.status ?? "pending",
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
  const [actingId, setActingId] = useState<string | null>(null);

  const jobs = useMemo(() => rows.map(toUiJob), [rows]);

  const loadInFlightRef = useRef(false);
  const pollRef = useRef<number | null>(null);

  async function load() {
    if (loadInFlightRef.current) return;
    loadInFlightRef.current = true;

    setError("");
    setLoading(true);

    try {
      const res = await fetch(`/api/driver-jobs?scope=${scope}`, {
        cache: "no-store",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to load jobs");
      setRows((json.jobs ?? []) as JobRow[]);
    } catch (e: any) {
      setError(e?.message || "Failed to load jobs");
      setRows([]);
    } finally {
      setLoading(false);
      loadInFlightRef.current = false;
    }
  }

  async function progress(jobNumber: string, action: "start" | "complete") {
    setActingId(jobNumber);
    setError("");

    try {
      const res = await fetch(`/api/jobs/${encodeURIComponent(jobNumber)}/progress`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Action failed");

      await load();
    } catch (e: any) {
      setError(e?.message || "Action failed");
    } finally {
      setActingId(null);
    }
  }

  // initial + scope change load
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope]);

  // auto refresh polling (so driver sees new assignments)
  useEffect(() => {
    // clear existing
    if (pollRef.current) window.clearInterval(pollRef.current);

    pollRef.current = window.setInterval(() => {
      // don’t poll while doing an action
      if (!actingId) load();
    }, 20000); // 20s

    return () => {
      if (pollRef.current) window.clearInterval(pollRef.current);
      pollRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope, actingId]);

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
          </CardHeader>

          <CardContent>
            <div className="flex gap-2">
              <Button
                variant={scope === "today" ? "primary" : "outline"}
                onClick={() => setScope("today")}
              >
                Today
              </Button>

              <Button
                variant={scope === "upcoming" ? "primary" : "outline"}
                onClick={() => setScope("upcoming")}
              >
                Upcoming
              </Button>
            </div>

            <div className="mt-3">
              <Button variant="outline" onClick={load} disabled={loading}>
                {loading ? "Refreshing..." : "Refresh"}
              </Button>
            </div>

            {error ? <div className="mt-4 text-sm text-red-600">{error}</div> : null}
            <div className="mt-3 text-xs text-neutral-500">Auto refresh every 20s</div>
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
                {jobs.map((j) => {
                  const win = formatWindow(j.window_start, j.window_end);

                  const isActing = actingId === j.id;

                  return (
                    <div
                      key={j.id}
                      className="rounded-xl border border-neutral-200 p-4 hover:bg-neutral-50"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <Link href={`/jobs/${j.id}`} className="block min-w-0 flex-1">
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
                        </Link>

                        <div className="flex flex-col items-end gap-2">
                          <StatusBadge status={j.status} />

                          {j.status === "assigned" ? (
                            <Button
                              variant="primary"
                              disabled={isActing}
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                progress(j.id, "start");
                              }}
                            >
                              {isActing ? "Starting..." : "Start"}
                            </Button>
                          ) : null}

                          {j.status === "in_transit" ? (
                            <Button
                              variant="primary"
                              disabled={isActing}
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                progress(j.id, "complete");
                              }}
                            >
                              {isActing ? "Completing..." : "Complete"}
                            </Button>
                          ) : null}
                        </div>
                      </div>
                    </div>
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
