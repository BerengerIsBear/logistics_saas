// app/(app)/jobs/page.tsx
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import {
  getJobs,
  subscribe,
  hydrateJobsFromSupabase,
  type JobStatus,
} from "@/lib/mockStore";

import { PageShell } from "@/components/PageShell";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";

type StatusFilter = "all" | JobStatus;
type SortMode = "newest" | "oldest";

export default function JobsPage() {
  const jobs = useSyncExternalStore(subscribe, getJobs, getJobs);

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sort, setSort] = useState<SortMode>("newest");

  const [loading, setLoading] = useState(false);
  const [loadErr, setLoadErr] = useState("");

  async function loadJobs() {
    setLoading(true);
    setLoadErr("");

    try {
      const meRes = await fetch("/api/me/company", { cache: "no-store" });
      const meJson = await meRes.json();

      if (!meRes.ok) {
        throw new Error(meJson?.error || "Failed to load company");
      }

      const companyId = meJson.companyId as string;
      if (!companyId) throw new Error("Missing companyId");

      await hydrateJobsFromSupabase();
    } catch (e: any) {
      setLoadErr(e?.message || "Failed to load jobs");
    } finally {
      setLoading(false);
    }
  }

  // Hydrate from Supabase once (Option A bridge)
  useEffect(() => {
    let alive = true;

    (async () => {
      if (!alive) return;
      await loadJobs();
    })();

    return () => {
      alive = false;
    };
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();

    let rows = jobs;

    if (q) {
      rows = rows.filter((j) => {
        const id = String(j.id ?? "").toLowerCase();
        const customer = String(j.customer ?? "").toLowerCase();
        return id.includes(q) || customer.includes(q);
      });
    }

    if (statusFilter !== "all") {
      rows = rows.filter((j) => j.status === statusFilter);
    }

    const getTime = (j: any) =>
      typeof j.createdAt === "number"
        ? j.createdAt
        : j.createdAt
        ? new Date(j.createdAt).getTime()
        : 0;

    rows = [...rows].sort((a: any, b: any) => {
      const ta = getTime(a);
      const tb = getTime(b);
      return sort === "newest" ? tb - ta : ta - tb;
    });

    return rows;
  }, [jobs, query, statusFilter, sort]);

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

      {/* Toolbar */}
      <Card className="mb-4">
        <CardContent className="bg-white">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="flex-1">
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by Job ID or Customer..."
              />
            </div>

            <div className="flex gap-3">
              <Select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              >
                <option value="all">All Status</option>
                <option value="pending">Pending</option>
                <option value="assigned">Assigned</option>
                <option value="in_transit">In Transit</option>
                <option value="delivered">Delivered</option>
              </Select>

              <Select value={sort} onChange={(e) => setSort(e.target.value as SortMode)}>
                <option value="newest">Newest</option>
                <option value="oldest">Oldest</option>
              </Select>
            </div>
          </div>

          <div className="mt-2 flex items-center justify-between gap-3 text-xs text-neutral-500">
            <div>
              Showing{" "}
              <span className="font-medium text-neutral-800">{filtered.length}</span> of{" "}
              <span className="font-medium text-neutral-800">{jobs.length}</span>
            </div>

            <div className="flex items-center gap-2">
              {loading ? <span>Loading...</span> : null}
              {loadErr ? <span className="text-red-600">{loadErr}</span> : null}

              <Button variant="outlineDark" type="button" onClick={loadJobs}>
                Refresh
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

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
                {filtered.map((job) => (
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

                {jobs.length === 0 && !loading && !loadErr && (
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

                {jobs.length > 0 && filtered.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-6 py-10 text-center">
                      <div className="text-sm text-neutral-500">
                        No results. Try clearing search / filters.
                      </div>

                      <div className="mt-3 flex justify-center gap-2">
                        <Button
                          variant="outlineDark"
                          type="button"
                          onClick={() => {
                            setQuery("");
                            setStatusFilter("all");
                            setSort("newest");
                          }}
                        >
                          Reset
                        </Button>

                        <Link href="/jobs/new">
                          <Button variant="primary">Create job</Button>
                        </Link>
                      </div>
                    </td>
                  </tr>
                )}

                {loadErr && (
                  <tr>
                    <td colSpan={6} className="px-6 py-10 text-center">
                      <div className="text-sm text-red-600">{loadErr}</div>
                      <div className="mt-3">
                        <Button variant="outlineDark" type="button" onClick={loadJobs}>
                          Retry
                        </Button>
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
