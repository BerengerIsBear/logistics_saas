"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { PageShell } from "@/components/PageShell";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import type { EnterpriseReport, ReportColumn, ReportKind, ReportValue } from "@/lib/reports/enterpriseReports";

type Props = { isAdmin: boolean };
const currency = new Intl.NumberFormat("en-SG", { style: "currency", currency: "SGD" });

function show(value: ReportValue, format?: ReportColumn["format"]) {
  if (value === null) return "—";
  if (typeof value === "number") {
    if (format === "currency") return currency.format(value);
    if (format === "percent") return `${value.toFixed(1)}%`;
    return value.toLocaleString("en-SG");
  }
  return value;
}

export default function ReportsPage({ isAdmin }: Props) {
  const [kind, setKind] = useState<ReportKind>("operations");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [report, setReport] = useState<EnterpriseReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState("");
  const [lastQuery, setLastQuery] = useState("");

  const buildQuery = () => {
    const query = new URLSearchParams({ report: kind });
    if (from) query.set("from", from);
    if (to) query.set("to", to);
    return query.toString();
  };

  const load = useCallback(async (query: string) => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/reports?${query}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not load report");
      setReport(data as EnterpriseReport);
      setLastQuery(query);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load report");
      setReport(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load("report=operations"); }, [load]);

  function apply() {
    if (from && to && from > to) {
      setError("Start date must be on or before end date.");
      return;
    }
    void load(buildQuery());
  }

  async function downloadCsv() {
    if (!lastQuery) return;
    setDownloading(true);
    setError("");
    try {
      const response = await fetch(`/api/reports?${lastQuery}&format=csv`, { cache: "no-store" });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || "Could not export report");
      }
      const blob = await response.blob();
      const link = document.createElement("a");
      const downloadUrl = URL.createObjectURL(blob);
      link.href = downloadUrl;
      const params = new URLSearchParams(lastQuery);
      link.download = `${params.get("report")}-report.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(downloadUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not export report");
    } finally {
      setDownloading(false);
    }
  }

  const currentQuery = buildQuery();

  return (
    <PageShell>
      <PageHeader title="Reports" subtitle="Operational and financial reports · Export to CSV" />
      <Card className="mb-5"><CardContent>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="text-sm font-medium text-neutral-700">Report
            <select value={kind} onChange={e => setKind(e.target.value as ReportKind)}
              className="mt-2 block w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900">
              <option value="operations">Operational Summary</option>
              <option value="drivers">Driver Performance</option>
              {isAdmin && <option value="financial">Financial Summary</option>}
              {isAdmin && <option value="customers">Customer Profitability</option>}
            </select>
          </label>
          <label className="text-sm font-medium text-neutral-700">Scheduled from
            <Input className="mt-2" type="date" value={from} onChange={e => setFrom(e.target.value)} />
          </label>
          <label className="text-sm font-medium text-neutral-700">Scheduled to
            <Input className="mt-2" type="date" value={to} onChange={e => setTo(e.target.value)} />
          </label>
          <div className="flex items-end gap-2">
            <Button variant="primary" disabled={loading} onClick={apply}>{loading ? "Loading..." : "Apply"}</Button>
            <Button onClick={() => { setFrom(""); setTo(""); }}>Clear dates</Button>
          </div>
        </div>
        <p className="mt-3 text-xs text-neutral-500">Date filters use each job&apos;s scheduled date (inclusive). Leave blank for all jobs. Changing filters requires Apply.</p>
      </CardContent></Card>
      {error && <Card className="mb-4"><CardContent><p role="alert" className="text-sm text-red-700">{error}</p></CardContent></Card>}
      {report && (
        <>
          <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold text-white">{report.title}</h2>
              <p className="mt-1 text-sm text-white/60">
                {report.date_from ?? "All dates"} → {report.date_to ?? "All dates"} · {report.rows.length} row(s)
              </p>
              {currentQuery !== lastQuery && <p className="text-sm text-amber-300">Filters changed. Click Apply to update the report.</p>}
            </div>
            <Button disabled={downloading || loading} onClick={() => void downloadCsv()}>
              {downloading ? "Exporting..." : "Export CSV"}
            </Button>
          </div>
          <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {report.metrics.map(m => (
              <Card key={m.label}><CardContent>
                <div className="text-xs text-neutral-500">{m.label}</div>
                <div className="mt-1 text-xl font-semibold text-neutral-900">{show(m.value, m.format)}</div>
              </CardContent></Card>
            ))}
          </div>
          <p className="mb-4 text-sm text-white/70">{report.note}</p>
          <Card><CardContent>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="bg-neutral-50 text-xs uppercase text-neutral-600">
                  <tr>{report.columns.map(c => <th key={c.key} className="px-3 py-3">{c.label}</th>)}</tr>
                </thead>
                <tbody className="divide-y divide-neutral-200 text-neutral-800">
                  {report.rows.map((row, i) => (
                    <tr key={i} className="hover:bg-neutral-50">
                      {report.columns.map(c => <td key={c.key} className="px-3 py-3">{show(row[c.key] ?? null, c.format)}</td>)}
                    </tr>
                  ))}
                  {report.rows.length === 0 && <tr><td colSpan={report.columns.length} className="px-4 py-8 text-center text-neutral-500">No records for the selected date range.</td></tr>}
                </tbody>
              </table>
            </div>
          </CardContent></Card>
        </>
      )}
      {loading && !report && <p className="text-sm text-white/70">Loading report...</p>}
    </PageShell>
  );
}
