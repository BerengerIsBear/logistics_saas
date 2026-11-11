"use client";

import { useEffect, useMemo, useState } from "react";
import { PageShell } from "@/components/PageShell";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import type { DriverPerformanceReport, DriverPerformanceRow } from "@/lib/jobs/driverPerformance";

type Sort = "name" | "most" | "lowest";
const pct = (value: number | null) => value === null ? "—" : `${value.toFixed(1)}%`;

function Metric({ label, value, detail }: { label: string; value: string | number; detail?: string }) {
  return (
    <Card><CardContent>
      <div className="text-xs text-neutral-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
      {detail && <div className="mt-1 text-xs text-neutral-500">{detail}</div>}
    </CardContent></Card>
  );
}

function score(row: DriverPerformanceRow) {
  return row.measured_deliveries === 0 ? "Not enough data" : pct(row.on_time_rate);
}

export default function DriverPerformancePage() {
  const [report, setReport] = useState<DriverPerformanceReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<Sort>("most");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/analytics/driver-performance", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to load driver performance");
      setReport(data as DriverPerformanceReport);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load driver performance");
      setReport(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  const rows = useMemo(() => {
    const filtered = (report?.rows ?? []).filter(row => row.name.toLowerCase().includes(search.toLowerCase().trim()));
    return filtered.sort((a, b) => {
      if (sort === "name") return a.name.localeCompare(b.name);
      if (sort === "most") return b.completed_jobs - a.completed_jobs || a.name.localeCompare(b.name);
      // Don't rank drivers with zero measurable deliveries as worst performers.
      if (a.on_time_rate === null) return b.on_time_rate === null ? a.name.localeCompare(b.name) : 1;
      if (b.on_time_rate === null) return -1;
      return a.on_time_rate - b.on_time_rate || a.name.localeCompare(b.name);
    });
  }, [report, search, sort]);

  return (
    <PageShell>
      <PageHeader
        title="Driver Performance"
        subtitle="Delivery reliability by driver · Admin and Dispatcher"
        action={<Button variant="outline" onClick={load} disabled={loading}>{loading ? "Loading..." : "Refresh"}</Button>}
      />
      {error && <Card className="mb-4"><CardContent><p role="alert" className="text-sm text-red-700">{error}</p></CardContent></Card>}
      {report && (
        <>
          <div className="mb-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Metric label="Drivers" value={report.summary.drivers} />
            <Metric label="Completed jobs" value={report.summary.completed_jobs} detail={`${report.summary.assigned_jobs} total assigned jobs`} />
            <Metric label="On-time delivery" value={pct(report.summary.on_time_rate)} detail={`${report.summary.on_time} / ${report.summary.measured_deliveries} measurable deliveries`} />
            <Metric label="Open SLA breaches" value={report.summary.open_sla_breaches} detail={`${report.summary.late} previously delivered late`} />
          </div>
          <p className="mb-4 text-sm text-white/70">
            On-time rate = on-time deliveries ÷ completed deliveries with a deadline and valid delivery timestamp.
            Jobs without SLA targets or completion timestamps are excluded. Figures cover all recorded jobs.
          </p>
          <Card>
            <CardContent>
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="max-w-sm flex-1">
                  <Input placeholder="Search driver..." aria-label="Search drivers" value={search} onChange={event => setSearch(event.target.value)} />
                </div>
                <select
                  aria-label="Sort drivers"
                  className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900"
                  value={sort} onChange={event => setSort(event.target.value as Sort)}
                >
                  <option value="most">Most completed first</option>
                  <option value="lowest">Lowest on-time rate first</option>
                  <option value="name">Driver name</option>
                </select>
              </div>
              <p className="mb-3 text-xs text-neutral-500">{rows.length} driver(s) · Inactive drivers remain visible for historical performance</p>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1020px] text-left text-sm">
                  <thead className="border-b border-neutral-200 bg-neutral-50 text-xs uppercase text-neutral-600">
                    <tr>
                      <th className="px-3 py-3">Driver</th>
                      <th className="px-3 py-3 text-right">Assigned</th>
                      <th className="px-3 py-3 text-right">Completed</th>
                      <th className="px-3 py-3 text-right">Measured</th>
                      <th className="px-3 py-3 text-right">On time</th>
                      <th className="px-3 py-3 text-right">Late</th>
                      <th className="px-3 py-3 text-right">On-time rate</th>
                      <th className="px-3 py-3 text-right">Open breaches</th>
                      <th className="px-3 py-3 text-right">Unmeasured</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-200 text-neutral-700">
                    {rows.map(row => (
                      <tr key={row.id} className="hover:bg-neutral-50">
                        <td className="px-3 py-3 font-medium text-neutral-900">
                          {row.name}
                          {!row.is_active && <span className="ml-2 rounded-full bg-neutral-100 px-2 py-1 text-xs text-neutral-600">Inactive</span>}
                        </td>
                        <td className="px-3 py-3 text-right">{row.assigned_jobs}</td>
                        <td className="px-3 py-3 text-right">{row.completed_jobs}</td>
                        <td className="px-3 py-3 text-right">{row.measured_deliveries}</td>
                        <td className="px-3 py-3 text-right">{row.on_time}</td>
                        <td className="px-3 py-3 text-right">{row.late}</td>
                        <td className={`px-3 py-3 text-right font-semibold ${row.late > 0 ? "text-amber-700" : ""}`}>{score(row)}</td>
                        <td className={`px-3 py-3 text-right ${row.open_sla_breaches > 0 ? "font-semibold text-red-700" : ""}`}>{row.open_sla_breaches}</td>
                        <td className="px-3 py-3 text-right" title="Delivered without SLA or completion timestamp">
                          {row.no_sla_completed + row.missing_completion_time}
                        </td>
                      </tr>
                    ))}
                    {!rows.length && <tr><td colSpan={9} className="px-4 py-8 text-center text-neutral-500">No matching drivers found.</td></tr>}
                  </tbody>
                </table>
              </div>
              <p className="mt-4 text-xs text-neutral-500">
                Rates describe measured deliveries, not a formal employee rating. Small sample sizes can be misleading.
                Unmeasured = completed jobs without a target or a valid completion time. Open breaches are tracked separately.
              </p>
            </CardContent>
          </Card>
        </>
      )}
      {loading && !report && <p className="text-sm text-white/70">Loading driver performance...</p>}
    </PageShell>
  );
}
