"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PageShell } from "@/components/PageShell";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import type { ProfitRiskReport, RiskAlert } from "@/lib/jobs/profitRisk";

const currency = new Intl.NumberFormat("en-SG", {
  style: "currency", currency: "SGD",
});
const money = (value: number | null) => value === null ? "—" : currency.format(value);
const percentage = (value: number | null) => value === null ? "—" : `${value.toFixed(2)}%`;

function Metric({ label, value, detail, danger }: {
  label: string;
  value: string | number;
  detail?: string;
  danger?: boolean;
}) {
  return (
    <Card>
      <CardContent>
        <div className="text-xs text-neutral-500">{label}</div>
        <div className={`mt-1 text-2xl font-semibold ${danger ? "text-red-700" : ""}`}>{value}</div>
        {detail && <div className="mt-1 text-xs text-neutral-500">{detail}</div>}
      </CardContent>
    </Card>
  );
}

function RiskBadges({ alert }: { alert: RiskAlert }) {
  return (
    <div className="flex flex-wrap gap-1">
      {alert.signals.map(signal => (
        <span
          key={signal}
          className={`rounded-full px-2 py-1 text-xs font-medium ${
            signal === "SLA breached" || signal === "Loss-making"
              ? "bg-red-100 text-red-800"
              : signal === "SLA at risk" || signal === "Delivered late"
                ? "bg-amber-100 text-amber-800"
                : "bg-neutral-100 text-neutral-600"
          }`}
        >
          {signal}
        </span>
      ))}
    </div>
  );
}

export default function ProfitRiskPage() {
  const [report, setReport] = useState<ProfitRiskReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/analytics/profit-risk", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to load dashboard");
      setReport(data as ProfitRiskReport);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load dashboard");
      setReport(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  const summary = report?.summary;
  return (
    <PageShell>
      <PageHeader
        title="Profit & Risk"
        subtitle="Financial visibility and delivery risks · Admin only · SGD"
        action={<Button variant="outline" onClick={load} disabled={loading}>
          {loading ? "Loading..." : "Refresh"}
        </Button>}
      />

      {error && <Card className="mb-4"><CardContent>
        <p role="alert" className="text-sm text-red-700">{error}</p>
      </CardContent></Card>}

      {summary && (
        <>
          <div className="mb-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Metric label="Revenue (priced jobs)" value={money(summary.revenue)} />
            <Metric label="Cost (priced jobs)" value={money(summary.cost)} />
            <Metric label="Profit (priced jobs)" value={money(summary.profit)}
              detail={`Margin: ${percentage(summary.margin)}`}
              danger={summary.profit !== null && summary.profit < 0} />
            <Metric label="Missing revenue" value={`${summary.missing_revenue_jobs} / ${summary.jobs}`}
              detail={`${summary.priced_jobs} priced jobs`} danger={summary.missing_revenue_jobs > 0} />
          </div>
          <div className="mb-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Metric label="Open SLA breaches" value={summary.sla_breached} danger={summary.sla_breached > 0} />
            <Metric label="SLA at risk" value={summary.sla_at_risk} detail="Within 30 minutes" danger={summary.sla_at_risk > 0} />
            <Metric label="Delivered late" value={summary.delivered_late} />
            <Metric label="Loss-making jobs" value={summary.loss_jobs}
              detail={`${summary.no_sla} job(s) without SLA`} danger={summary.loss_jobs > 0} />
          </div>
          <p className="mb-5 text-sm text-white/70">
            Financial totals include only jobs with entered revenue. Costs on unpriced jobs are excluded.
            Results are incomplete until all jobs are priced.
          </p>

          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-white">Priority alerts</h2>
              <p className="text-sm text-white/70">{report.alert_count} job(s) need attention · showing up to 30</p>
            </div>
            <Link href="/customer-profitability" className="rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm text-neutral-900 hover:bg-neutral-50">
              Customer Profitability →
            </Link>
          </div>

          <Card>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[800px] text-left text-sm">
                  <thead className="border-b border-neutral-200 bg-neutral-50 text-xs uppercase text-neutral-600">
                    <tr>
                      <th className="px-3 py-3">Job</th>
                      <th className="px-3 py-3">Customer</th>
                      <th className="px-3 py-3">Status</th>
                      <th className="px-3 py-3">Alerts</th>
                      <th className="px-3 py-3">SLA detail</th>
                      <th className="px-3 py-3 text-right">Profit</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-200 text-neutral-700">
                    {report.alerts.map(alert => (
                      <tr key={alert.job_number} className="hover:bg-neutral-50">
                        <td className="px-3 py-3 font-medium">
                          <Link className="text-blue-700 hover:underline" href={`/jobs/${encodeURIComponent(alert.job_number)}`}>
                            {alert.job_number}
                          </Link>
                        </td>
                        <td className="px-3 py-3">{alert.customer}</td>
                        <td className="px-3 py-3 capitalize">{alert.job_status.replace("_", " ")}</td>
                        <td className="px-3 py-3"><RiskBadges alert={alert} /></td>
                        <td className="px-3 py-3 text-xs">{alert.sla_detail}</td>
                        <td className={`px-3 py-3 text-right font-medium ${alert.profit !== null && alert.profit < 0 ? "text-red-700" : ""}`}>
                          {money(alert.profit)}
                        </td>
                      </tr>
                    ))}
                    {!report.alerts.length && <tr><td colSpan={6} className="px-4 py-8 text-center text-neutral-500">
                      No current alerts. Great!
                    </td></tr>}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
      {loading && !report && <p className="text-sm text-white/70">Loading profit and risk data...</p>}
    </PageShell>
  );
}
