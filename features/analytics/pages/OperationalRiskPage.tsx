"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { PageShell } from "@/components/PageShell";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import type { OperationalRiskReport, RiskLevel } from "@/lib/jobs/operationalRisk";

type Filter = "all" | RiskLevel;
const badgeStyle: Record<RiskLevel, string> = {
  high: "bg-red-100 text-red-700",
  medium: "bg-amber-100 text-amber-700",
  low: "bg-green-100 text-green-700",
  unknown: "bg-neutral-100 text-neutral-600",
};

function Metric({ label, value, detail, danger }: {
  label: string;
  value: number;
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

export default function OperationalRiskPage() {
  const [report, setReport] = useState<OperationalRiskReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/analytics/operational-risk", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to load operational risk");
      setReport(data as OperationalRiskReport);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load operational risk");
      setReport(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  const rows = useMemo(() => (report?.rows ?? []).filter(row => {
    if (filter !== "all" && row.level !== filter) return false;
    const q = search.trim().toLowerCase();
    return row.job_number.toLowerCase().includes(q) || row.customer.toLowerCase().includes(q);
  }), [report, search, filter]);

  return (
    <PageShell>
      <PageHeader
        title="Operational Risk"
        subtitle="Prioritise unfinished deliveries · Admin and Dispatcher"
        action={<Button variant="outline" onClick={load} disabled={loading}>{loading ? "Loading..." : "Refresh"}</Button>}
      />
      {error && <Card className="mb-4"><CardContent><p role="alert" className="text-sm text-red-700">{error}</p></CardContent></Card>}
      {report && (
        <>
          <div className="mb-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <Metric label="Open jobs" value={report.summary.open_jobs} />
            <Metric label="High risk" value={report.summary.high} detail="Immediate attention" danger={report.summary.high > 0} />
            <Metric label="Medium risk" value={report.summary.medium} detail="Review soon" />
            <Metric label="Low risk" value={report.summary.low} detail="On track" />
            <Metric label="Unknown" value={report.summary.unknown} detail="Missing deadline" />
          </div>
          <p className="mb-4 text-sm text-white/70">
            Priority score is an explainable 0–100 rule-based index, not a prediction or failure probability.
            Delivered jobs are excluded. Unknown means there is not enough information to score the job.
          </p>
          <Card>
            <CardContent>
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="max-w-sm flex-1">
                  <Input placeholder="Search job or customer..." aria-label="Search jobs" value={search} onChange={event => setSearch(event.target.value)} />
                </div>
                <select
                  aria-label="Filter risk level"
                  className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900"
                  value={filter}
                  onChange={event => setFilter(event.target.value as Filter)}
                >
                  <option value="all">All risk levels</option>
                  <option value="high">High risk</option>
                  <option value="medium">Medium risk</option>
                  <option value="unknown">Unknown</option>
                  <option value="low">Low risk</option>
                </select>
              </div>
              <p className="mb-3 text-xs text-neutral-500">{rows.length} open job(s) shown · Highest priority first</p>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[880px] text-left text-sm">
                  <thead className="border-b border-neutral-200 bg-neutral-50 text-xs uppercase text-neutral-600">
                    <tr>
                      <th className="px-3 py-3">Job</th>
                      <th className="px-3 py-3">Customer</th>
                      <th className="px-3 py-3">Status</th>
                      <th className="px-3 py-3">Risk</th>
                      <th className="px-3 py-3 text-right">Score</th>
                      <th className="px-3 py-3">Why</th>
                      <th className="px-3 py-3">SLA</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-200 text-neutral-700">
                    {rows.map(row => (
                      <tr key={row.job_number} className="hover:bg-neutral-50">
                        <td className="px-3 py-3 font-medium">
                          <Link href={`/jobs/${encodeURIComponent(row.job_number)}`} className="text-blue-700 hover:underline">{row.job_number}</Link>
                        </td>
                        <td className="px-3 py-3">{row.customer}</td>
                        <td className="px-3 py-3 capitalize">{row.status.replaceAll("_", " ")}</td>
                        <td className="px-3 py-3"><span className={`rounded-full px-2 py-1 text-xs font-medium ${badgeStyle[row.level]}`}>{row.level.toUpperCase()}</span></td>
                        <td className="px-3 py-3 text-right font-semibold">{row.score ?? "—"}</td>
                        <td className="px-3 py-3">{row.reasons.join(" · ")}</td>
                        <td className="px-3 py-3">{row.sla_detail}</td>
                      </tr>
                    ))}
                    {!rows.length && <tr><td colSpan={7} className="px-4 py-8 text-center text-neutral-500">No matching open jobs.</td></tr>}
                  </tbody>
                </table>
              </div>
              <p className="mt-4 text-xs text-neutral-500">
                Rules: missed deadline = 100; assigned/in-transit without a driver or vehicle = at least 85;
                within 30 minutes = 70; pending with under 24 hours left = at least 55;
                on track = 10. Missing deadlines are Unknown unless another issue is detected.
              </p>
            </CardContent>
          </Card>
        </>
      )}
      {loading && !report && <p className="text-sm text-white/70">Loading operational risk...</p>}
    </PageShell>
  );
}
