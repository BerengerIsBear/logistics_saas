"use client";

import { useEffect, useMemo, useState } from "react";
import { PageShell } from "@/components/PageShell";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import type { CustomerProfitRow, buildCustomerProfitability } from "@/lib/jobs/customerProfitability";

type Report = ReturnType<typeof buildCustomerProfitability>;
type Sort = "lowest" | "highest" | "name";
const currency = new Intl.NumberFormat("en-SG", { style: "currency", currency: "SGD" });

function money(value: number | null) {
  return value === null ? "—" : currency.format(value);
}
function percent(value: number | null) {
  return value === null ? "—" : `${value.toFixed(2)}%`;
}
function profitStyle(value: number | null) {
  return value !== null && value < 0 ? "font-semibold text-red-700" : "font-medium text-neutral-900";
}
function profitStatus(row: CustomerProfitRow) {
  if (row.priced_jobs === 0) return "Not priced";
  if (row.profit !== null && row.profit < 0) return "Loss-making";
  if (row.missing_revenue_jobs > 0) return "Partial";
  return "Tracked";
}

export default function CustomerProfitabilityPage() {
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<Sort>("lowest");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/analytics/customer-profitability", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to load profitability report");
      setReport(data as Report);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load profitability report");
      setReport(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const rows = useMemo(() => {
    const filtered = (report?.rows ?? []).filter(row => row.name.toLowerCase().includes(search.toLowerCase().trim()));
    return filtered.sort((a, b) => {
      if (sort === "name") return a.name.localeCompare(b.name);
      if (a.profit === null) return b.profit === null ? a.name.localeCompare(b.name) : 1;
      if (b.profit === null) return -1;
      return (sort === "lowest" ? a.profit - b.profit : b.profit - a.profit) || a.name.localeCompare(b.name);
    });
  }, [report, search, sort]);

  const summary = report?.summary;

  return (
    <PageShell>
      <PageHeader
        title="Customer Profitability"
        subtitle="See which customers earn or lose money. Admin only · SGD."
        action={<Button variant="outline" onClick={load} disabled={loading}>{loading ? "Loading..." : "Refresh"}</Button>}
      />

      {error && (
        <Card className="mb-4"><CardContent><p className="text-sm text-red-700">{error}</p></CardContent></Card>
      )}

      {summary && (
        <>
          <div className="mb-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card><CardContent><div className="text-xs text-neutral-500">Revenue (priced jobs)</div><div className="mt-1 text-xl font-semibold">{money(summary.revenue)}</div></CardContent></Card>
            <Card><CardContent><div className="text-xs text-neutral-500">Cost (priced jobs)</div><div className="mt-1 text-xl font-semibold">{money(summary.cost)}</div></CardContent></Card>
            <Card><CardContent><div className="text-xs text-neutral-500">Profit (priced jobs)</div><div className={`mt-1 text-xl font-semibold ${summary.profit !== null && summary.profit < 0 ? "text-red-700" : ""}`}>{money(summary.profit)}</div><div className="text-xs text-neutral-500">Margin: {percent(summary.margin)}</div></CardContent></Card>
            <Card><CardContent><div className="text-xs text-neutral-500">Jobs missing revenue</div><div className="mt-1 text-xl font-semibold">{summary.missing_revenue_jobs} / {summary.jobs}</div><div className="text-xs text-neutral-500">{summary.priced_jobs} priced · {summary.loss_jobs} loss-making</div></CardContent></Card>
          </div>
          <p className="mb-4 text-sm text-white/70">
            Totals include only jobs with recorded revenue. Costs for unpriced jobs are excluded, so results are incomplete until all jobs are priced.
          </p>

          <Card>
            <CardContent>
              <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="max-w-sm flex-1"><Input placeholder="Search customer name..." value={search} onChange={event => setSearch(event.target.value)} aria-label="Search customer" /></div>
                <select
                  className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900"
                  value={sort} onChange={event => setSort(event.target.value as Sort)} aria-label="Sort customers"
                >
                  <option value="lowest">Lowest profit first</option>
                  <option value="highest">Highest profit first</option>
                  <option value="name">Customer name</option>
                </select>
              </div>
              <div className="mb-3 text-xs text-neutral-500">Showing {rows.length} customer(s) with jobs</div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[980px] text-left text-sm">
                  <thead className="border-b border-neutral-200 bg-neutral-50 text-xs uppercase text-neutral-600">
                    <tr>
                      <th className="px-3 py-3">Customer</th>
                      <th className="px-3 py-3 text-right">Jobs</th>
                      <th className="px-3 py-3 text-right">Priced</th>
                      <th className="px-3 py-3 text-right">Missing</th>
                      <th className="px-3 py-3 text-right">Revenue</th>
                      <th className="px-3 py-3 text-right">Cost</th>
                      <th className="px-3 py-3 text-right">Profit</th>
                      <th className="px-3 py-3 text-right">Margin</th>
                      <th className="px-3 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-200 text-neutral-700">
                    {rows.map(row => (
                      <tr key={row.customer_id} className="hover:bg-neutral-50">
                        <td className="px-3 py-3 font-medium text-neutral-900">{row.name}</td>
                        <td className="px-3 py-3 text-right">{row.job_count}</td>
                        <td className="px-3 py-3 text-right">{row.priced_jobs}</td>
                        <td className={`px-3 py-3 text-right ${row.missing_revenue_jobs ? "text-amber-700" : ""}`}>{row.missing_revenue_jobs}</td>
                        <td className="px-3 py-3 text-right">{money(row.revenue)}</td>
                        <td className="px-3 py-3 text-right">{money(row.cost)}</td>
                        <td className={`px-3 py-3 text-right ${profitStyle(row.profit)}`}>{money(row.profit)}</td>
                        <td className="px-3 py-3 text-right">{percent(row.margin)}</td>
                        <td className="px-3 py-3">{profitStatus(row)}{row.loss_jobs ? ` (${row.loss_jobs} loss job${row.loss_jobs === 1 ? "" : "s"})` : ""}</td>
                      </tr>
                    ))}
                    {!rows.length && (
                      <tr><td colSpan={9} className="px-4 py-8 text-center text-neutral-500">{loading ? "Loading..." : "No customers with jobs found."}</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
      {loading && !report && <p className="text-sm text-white/70">Loading customer profitability...</p>}
    </PageShell>
  );
}
