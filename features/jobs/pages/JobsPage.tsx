// features/jobs/pages/JobsPage.tsx

"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { PageShell } from "@/components/PageShell";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { SlaBadge } from "@/components/ui/SlaBadge";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { formatSlaDetail, getJobSla } from "@/lib/jobs/sla";

type JobStatus = "pending" | "assigned" | "in_transit" | "delivered";

type JobRow = {
  job_number: string;
  pickup: string;
  dropoff: string;
  scheduled_date: string | null;
  window_end: string | null;
  delivered_at: string | null;
  status: JobStatus;
  customers?: { name: string } | null;
  customer?: string | null;
  drivers?: { name: string } | null;
  vehicles?: { plate_no: string } | null;
  created_at: string;
};

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
  const [rows, setRows] = useState<JobRow[]>([]);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sort, setSort] = useState<SortMode>("newest");

  const [datePreset, setDatePreset] = useState<DatePreset>("all");
  const [rangeFrom, setRangeFrom] = useState("");
  const [rangeTo, setRangeTo] = useState("");

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  function buildQueryString() {
    const params = new URLSearchParams();
    const q = query.trim();

    if (q) {
      params.set("q", q);
    }

    if (statusFilter !== "all") {
      params.set("status", statusFilter);
    }

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

      if (from) {
        params.set("dateFrom", from);
      }

      if (to) {
        params.set("dateTo", to);
      }
    }

    const s = params.toString();

    return s ? `?${s}` : "";
  }

  async function load() {
    setLoading(true);
    setErr("");

    try {
      const qs = buildQueryString();
      const res = await fetch(`/api/jobs${qs}`, { cache: "no-store" });
      const json = await res.json();

      if (!res.ok) {
        throw new Error(json?.error || "Failed to load jobs");
      }

      setRows(json.jobs || []);
    } catch (e: unknown) {
      if (e instanceof Error) {
        setErr(e.message);
      } else {
        setErr("Failed to load jobs");
      }
    } finally {
      setLoading(false);
    }
  }

  function resetFilters() {
    setQuery("");
    setStatusFilter("all");
    setDatePreset("all");
    setRangeFrom("");
    setRangeTo("");
    setSort("newest");
    setTimeout(load, 0);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sorted = useMemo(() => {
    const copy = [...rows];

    copy.sort((a, b) => {
      const ta = new Date(a.created_at).getTime();
      const tb = new Date(b.created_at).getTime();

      return sort === "newest" ? tb - ta : ta - tb;
    });

    return copy;
  }, [rows, sort]);

  return (
    <PageShell>
      <PageHeader
        title="Jobs"
        subtitle="Create, dispatch, and track job lifecycle."
        action={
          <Link href="/jobs/create">
            <Button variant="outline">+ Create Job</Button>
          </Link>
        }
      />

      <Card className="mb-4">
        <CardContent>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="flex-1">
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search job ID or customer..."
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

              <Select
                value={sort}
                onChange={(e) => setSort(e.target.value as SortMode)}
              >
                <option value="newest">Newest</option>
                <option value="oldest">Oldest</option>
              </Select>

              <Button variant="outline" type="button" onClick={resetFilters}>
                Reset
              </Button>

              <Button variant="outline" type="button" onClick={load}>
                Search
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
            </div>
          ) : null}

          <div className="mt-2 flex items-center justify-between gap-3 text-xs text-neutral-500">
            <div>
              Showing{" "}
              <span className="font-medium text-neutral-900">
                {sorted.length}
              </span>{" "}
              job(s)
            </div>

            <div className="flex items-center gap-2">
              {loading ? <span>Loading...</span> : null}
              {err ? <span className="text-red-600">{err}</span> : null}
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
                  <th className="px-6 py-3">SLA</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-neutral-200 text-neutral-700">
                {sorted.map((j) => {
                  const sla = getJobSla({
                    status: j.status,
                    scheduled_date: j.scheduled_date,
                    window_end: j.window_end,
                    delivered_at: j.delivered_at,
                  });

                  return (
                    <tr key={j.job_number} className="hover:bg-neutral-50/70">
                      <td className="px-6 py-3 font-medium">
                        <Link
                          href={`/jobs/${j.job_number}`}
                          className="text-neutral-900 hover:underline"
                        >
                          {j.job_number}
                        </Link>
                      </td>

                      <td className="px-6 py-3">
                        {j.customers?.name ?? j.customer ?? "-"}
                      </td>

                      <td className="px-6 py-3">
                        <div>{j.scheduled_date ?? "-"}</div>
                        {j.window_end ? (
                          <div className="text-xs text-neutral-500">
                            Target: {j.window_end}
                          </div>
                        ) : null}
                      </td>

                      <td className="px-6 py-3">{j.pickup}</td>
                      <td className="px-6 py-3">{j.dropoff}</td>
                      <td className="px-6 py-3">{j.drivers?.name ?? "-"}</td>

                      <td className="px-6 py-3">
                        <StatusBadge status={j.status} />
                      </td>

                      <td className="px-6 py-3">
                        <div className="flex flex-col gap-1">
                          <SlaBadge status={sla.status} />
                          <span className="text-xs text-neutral-500">
                            {formatSlaDetail(sla)}
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {!loading && sorted.length === 0 && !err && (
                  <tr>
                    <td colSpan={8} className="px-6 py-10 text-center">
                      <div className="text-sm text-neutral-500">
                        No jobs found.
                      </div>

                      <div className="mt-3">
                        <Link href="/jobs/create">
                          <Button variant="primary">Create job</Button>
                        </Link>
                      </div>
                    </td>
                  </tr>
                )}

                {err && (
                  <tr>
                    <td colSpan={8} className="px-6 py-10 text-center">
                      <div className="text-sm text-red-600">{err}</div>

                      <div className="mt-3">
                        <Button variant="outline" type="button" onClick={load}>
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