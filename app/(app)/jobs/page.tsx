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
type DatePreset = "all" | "today" | "tomorrow" | "next7" | "range";

function toYmd(d: Date) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export default function JobsPage() {
  const jobs = useSyncExternalStore(subscribe, getJobs, getJobs);

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sort, setSort] = useState<SortMode>("newest");

  const [datePreset, setDatePreset] = useState<DatePreset>("all");
  const [rangeFrom, setRangeFrom] = useState("");
  const [rangeTo, setRangeTo] = useState("");

  const [loading, setLoading] = useState(false);
  const [loadErr, setLoadErr] = useState("");

  function buildQueryString() {
    const params = new URLSearchParams();

    const q = query.trim();
    if (q) params.set("q", q);

    if (statusFilter !== "all") params.set("status", statusFilter);

    const today = new Date();
    const todayYmd = toYmd(today);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowYmd = toYmd(tomorrow);

    if (datePreset === "today") {
      params.set("dateFrom", todayYmd);
      params.set("dateTo", todayYmd);
    } else if (datePreset === "tomorrow") {
      params.set("dateFrom", tomorrowYmd);
      params.set("dateTo", tomorrowYmd);
    } else if (datePreset === "next7") {
      const end = new Date(today);
      end.setDate(end.getDate() + 7);
      params.set("dateFrom", todayYmd);
      params.set("dateTo", toYmd(end));
    } else if (datePreset === "range") {
      const from = rangeFrom.trim();
      const to = rangeTo.trim();
      if (from) params.set("dateFrom", from);
      if (to) params.set("dateTo", to);
    }

    const s = params.toString();
    return s ? `?${s}` : "";
  }

  async function loadJobs() {
    setLoading(true);
    setLoadErr("");

    try {
      const qs = buildQueryString();
      await hydrateJobsFromSupabase(qs);
    } catch (e: any) {
      setLoadErr(e?.message || "Failed to load jobs");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let alive = true;

    (async () => {
      if (!alive) return;
      await loadJobs();
    })();

    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    // Server already filtered. Keep client-side sort only.
    const getTime = (j: any) =>
      typeof j.createdAt === "number"
        ? j.createdAt
        : j.createdAt
        ? new Date(j.createdAt).getTime()
        : 0;

    return [...jobs].sort((a: any, b: any) => {
      const ta = getTime(a);
      const tb = getTime(b);
      return sort === "newest" ? tb - ta : ta - tb;
    });
  }, [jobs, sort]);

  return (
    <PageShell>
      <PageHeader
        title="Jobs"
        subtitle="Track deliveries, assign drivers, and update status."
        action={
          <Link href="/jobs/new">
            <Button variant="outline">+ Create Job</Button>
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

            <div className="flex flex-wrap gap-3">
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

              <Select
                value={datePreset}
                onChange={(e) => setDatePreset(e.target.value as DatePreset)}
              >
                <option value="all">All Dates</option>
                <option value="today">Today</option>
                <option value="tomorrow">Tomorrow</option>
                <option value="next7">Next 7 days</option>
                <option value="range">Date range</option>
              </Select>

              <Select value={sort} onChange={(e) => setSort(e.target.value as SortMode)}>
                <option value="newest">Newest</option>
                <option value="oldest">Oldest</option>
              </Select>

              <Button variant="outline" type="button" onClick={loadJobs}>
                Apply
              </Button>
            </div>
          </div>

          {datePreset === "range" ? (
            <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="flex items-center gap-2 text-xs text-neutral-500">
                <span>From</span>
                <input
                  type="date"
                  value={rangeFrom}
                  onChange={(e) => setRangeFrom(e.target.value)}
                  className="rounded-md border bg-white px-3 py-2 text-sm text-black"
                />
              </div>

              <div className="flex items-center gap-2 text-xs text-neutral-500">
                <span>To</span>
                <input
                  type="date"
                  value={rangeTo}
                  onChange={(e) => setRangeTo(e.target.value)}
                  className="rounded-md border bg-white px-3 py-2 text-sm text-black"
                />
              </div>

              <div className="sm:ml-auto">
                <Button
                  variant="outline"
                  type="button"
                  onClick={() => {
                    setQuery("");
                    setStatusFilter("all");
                    setDatePreset("all");
                    setRangeFrom("");
                    setRangeTo("");
                    setSort("newest");
                    setTimeout(loadJobs, 0);
                  }}
                >
                  Reset
                </Button>
              </div>
            </div>
          ) : (
            <div className="mt-3 flex justify-end">
              <Button
                variant="outline"
                type="button"
                onClick={() => {
                  setQuery("");
                  setStatusFilter("all");
                  setDatePreset("all");
                  setRangeFrom("");
                  setRangeTo("");
                  setSort("newest");
                  setTimeout(loadJobs, 0);
                }}
              >
                Reset
              </Button>
            </div>
          )}

          <div className="mt-2 flex items-center justify-between gap-3 text-xs text-neutral-500">
            <div>
              Showing <span className="font-medium text-neutral-800">{filtered.length}</span>{" "}
              job(s)
            </div>

            <div className="flex items-center gap-2">
              {loading ? <span>Loading...</span> : null}
              {loadErr ? <span className="text-red-600">{loadErr}</span> : null}

              <Button variant="outline" type="button" onClick={loadJobs}>
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
                  <th className="px-6 py-3">Schedule</th>
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
                      <Link href={`/jobs/${job.id}`} className="text-neutral-900 hover:underline">
                        {job.id}
                      </Link>
                    </td>

                    <td className="px-6 py-3">{job.customer}</td>
                    <td className="px-6 py-3">{job.scheduled_date ?? "-"}</td>
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
                    <td colSpan={7} className="px-6 py-10 text-center">
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
                    <td colSpan={7} className="px-6 py-10 text-center">
                      <div className="text-sm text-neutral-500">
                        No results. Try clearing search / filters.
                      </div>

                      <div className="mt-3 flex justify-center gap-2">
                        <Button
                          variant="outline"
                          type="button"
                          onClick={() => {
                            setQuery("");
                            setStatusFilter("all");
                            setDatePreset("all");
                            setRangeFrom("");
                            setRangeTo("");
                            setSort("newest");
                            setTimeout(loadJobs, 0);
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
                    <td colSpan={7} className="px-6 py-10 text-center">
                      <div className="text-sm text-red-600">{loadErr}</div>
                      <div className="mt-3">
                        <Button variant="outline" type="button" onClick={loadJobs}>
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

