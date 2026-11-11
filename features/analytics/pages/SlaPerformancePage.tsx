"use client";

import { useEffect, useMemo, useState } from "react";
import { PageShell } from "@/components/PageShell";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import type { CustomerSlaRow, SlaPerformanceReport } from "@/lib/jobs/slaPerformance";

type Sort = "issues" | "worst" | "name";
const pct = (value: number | null) => value === null ? "—" : `${value.toFixed(1)}%`;

function Metric({ label, value, detail, danger }: {
  label: string;
  value: string | number;
  detail?: string;
  danger?: boolean;
}) {
  return (
    <Card><CardContent>
      <div className="text-xs text-neutral-500">{label}</div>
      <div className={`mt-1 text-2xl font-semibold ${danger ? "text-red-700" : ""}`}>{value}</div>
      {detail && <div className="mt-1 text-xs text-neutral-500">{detail}</div>}
    </CardContent></Card>
  );
}

function issues(row: CustomerSlaRow) {
  return row.open_breached + row.delivered_late;
}

export default function SlaPerformancePage() {
  const [report, setReport] = useState<SlaPerformanceReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<Sort>("issues");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/analytics/sla-performance", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to load SLA performance");
      setReport(data as SlaPerformanceReport);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load SLA performance");
      setReport(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  const rows = useMemo(() => {
    const filtered = (report?.customers ?? []).filter(row =>
      row.customer.toLowerCase().includes(search.trim().toLowerCase())
    );
    return filtered.sort((a, b) => {
      if (sort === "name") return a.customer.localeCompare(b.customer);
      if (sort === "issues") return issues(b) - issues(a) || a.customer.localeCompare(b.customer);
      // Customers with no measured deliveries must not be labelled worst.
      if (a.on_time_rate === null) return b.on_time_rate === null ? a.customer.localeCompare(b.customer) : 1;
      if (b.on_time_rate === null) return -1;
      return a.on_time_rate - b.on_time_rate || a.customer.localeCompare(b.customer);
    });
  }, [report, search, sort]);

  return (
    <PageShell>
      <PageHeader
        title="SLA Performance"
        subtitle="Delivery reliability across the company · Admin and Dispatcher"
        action={<Button variant="outline" onClick={load} disabled={loading}>{loading ? "Loading..." : "Refresh"}</Button>}
      />
      {error && <Card className="mb-4"><CardContent><p role="alert" className="text-sm text-red-700">{error}</p></CardContent></Card>}
      {report && (
        <>
          <div className="mb-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Metric label="On-time delivery rate" value={pct(report.summary.on_time_rate)} detail={`${report.summary.on_time} of ${report.summary.measured} measurable completed jobs`} />
            <Metric label="Delivered late" value={report.summary.delivered_late} detail="Completed after their SLA deadline" danger={report.summary.delivered_late > 0} />
            <Metric label="Open SLA breaches" value={report.summary.open_breached} detail="Unfinished jobs past their deadline" danger={report.summary.open_breached > 0} />
            <Metric label="Approaching deadline" value={report.summary.open_at_risk} detail="Unfinished jobs within 30 minutes of SLA" />
            <Metric label="SLA target coverage" value={pct(report.summary.target_coverage)} detail={`${report.summary.with_target} of ${report.summary.jobs} total jobs have a deadline`} />
            <Metric label="Incomplete SLA data" value={report.summary.missing_target + report.summary.missing_completion_time} detail={`${report.summary.missing_target} missing deadline · ${report.summary.missing_completion_time} completed with missing timestamp`} />
          </div>
          <p className="mb-4 text-sm text-white/70">
            Rates cover all recorded jobs. On-time rate uses only completed deliveries with both an SLA deadline
            and a valid completion timestamp. Open breaches are tracked separately from delivered-late jobs.
          </p>
          <Card>
            <CardContent>
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="max-w-sm flex-1">
                  <Input placeholder="Search customer..." aria-label="Search customers" value={search} onChange={event => setSearch(event.target.value)} />
                </div>
                <select
                  aria-label="Sort customers"
                  className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900"
                  value={sort}
                  onChange={event => setSort(event.target.value as Sort)}
                >
                  <option value="issues">Most SLA issues first</option>
                  <option value="worst">Lowest on-time rate first</option>
                  <option value="name">Customer name</option>
                </select>
              </div>
              <p className="mb-3 text-xs text-neutral-500">Delivery SLA breakdown by customer · {rows.length} customer(s)</p>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[950px] text-left text-sm">
                  <thead className="border-b border-neutral-200 bg-neutral-50 text-xs uppercase text-neutral-600">
                    <tr>
                      <th className="px-3 py-3">Customer</th>
                      <th className="px-3 py-3 text-right">Jobs</th>
                      <th className="px-3 py-3 text-right">Target coverage</th>
                      <th className="px-3 py-3 text-right">Measured</th>
                      <th className="px-3 py-3 text-right">On time</th>
                      <th className="px-3 py-3 text-right">Late</th>
                      <th className="px-3 py-3 text-right">Open breaches</th>
                      <th className="px-3 py-3 text-right">On-time rate</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-200 text-neutral-700">
                    {rows.map(row => (
                      <tr key={row.key} className="hover:bg-neutral-50">
                        <td className="px-3 py-3 font-medium text-neutral-900">{row.customer}</td>
                        <td className="px-3 py-3 text-right">{row.jobs}</td>
                        <td className="px-3 py-3 text-right">{row.with_target} / {row.jobs}</td>
                        <td className="px-3 py-3 text-right">{row.measured}</td>
                        <td className="px-3 py-3 text-right">{row.on_time}</td>
                        <td className={`px-3 py-3 text-right ${row.delivered_late > 0 ? "font-semibold text-amber-700" : ""}`}>{row.delivered_late}</td>
                        <td className={`px-3 py-3 text-right ${row.open_breached > 0 ? "font-semibold text-red-700" : ""}`}>{row.open_breached}</td>
                        <td className="px-3 py-3 text-right font-semibold">{pct(row.on_time_rate)}</td>
                      </tr>
                    ))}
                    {!rows.length && <tr><td colSpan={8} className="px-4 py-8 text-center text-neutral-500">No matching customers found.</td></tr>}
                  </tbody>
                </table>
              </div>
              <p className="mt-4 text-xs text-neutral-500">
                “—” means no measurable completed deliveries. Jobs with missing SLA targets or completion times
                do not affect on-time rates. Names marked “Unlinked” come from historical job records without a customer link.
              </p>
            </CardContent>
          </Card>
        </>
      )}
      {loading && !report && <p className="text-sm text-white/70">Loading SLA performance...</p>}
    </PageShell>
  );
}
