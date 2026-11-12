"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { PageShell } from "@/components/PageShell";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";

type Alert = {
  id: string;
  job_number: string | null;
  customer: string | null;
  workflow_name: string;
  stage_name: string;
  deadline_at: string;
  status: "open" | "acknowledged";
  acknowledged_at: string | null;
};
type Report = { total: number; open_count: number; acknowledged_count: number; rows: Alert[] };

function overdueLabel(deadlineAt: string, nowMs: number) {
  const minutes = Math.max(1, Math.ceil((nowMs - Date.parse(deadlineAt)) / 60_000));
  if (!Number.isFinite(minutes)) return "—";
  return minutes >= 60 ? `${Math.floor(minutes / 60)}h ${minutes % 60}m` : `${minutes}m`;
}

export default function WorkflowEscalationsPage() {
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState("");
  const [search, setSearch] = useState("");
  const [nowMs, setNowMs] = useState(() => Date.now());

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/workflow-escalations", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not load escalations");
      setReport(data as Report);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load escalations");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 60_000);
    return () => window.clearInterval(timer);
  }, [load]);
  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  async function scanNow() {
    setWorking("scan");
    setError("");
    setNotice("");
    try {
      const res = await fetch("/api/workflow-escalations", { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Scan failed");
      setNotice(`Scan finished: ${json.result.created_count} new, ${json.result.resolved_count} resolved.`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Scan failed");
    } finally {
      setWorking("");
    }
  }

  async function acknowledge(id: string) {
    setWorking(id);
    setError("");
    setNotice("");
    try {
      const res = await fetch(`/api/workflow-escalations/${id}`, { method: "PATCH" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Could not acknowledge alert");
      setNotice("Alert acknowledged. It will resolve when the job moves to another stage.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not acknowledge alert");
    } finally {
      setWorking("");
    }
  }

  const rows = useMemo(() => (report?.rows ?? []).filter((row) => {
    const q = search.trim().toLowerCase();
    return [row.job_number, row.customer, row.workflow_name, row.stage_name]
      .some((text) => (text ?? "").toLowerCase().includes(q));
  }), [report, search]);
  const open = report?.open_count ?? 0;
  const acknowledged = report?.acknowledged_count ?? 0;

  return (
    <PageShell>
      <PageHeader
        title="Workflow Escalations"
        subtitle="Overdue workflow stages · Admin and Dispatcher"
        action={<div className="flex gap-2">
          <Button variant="outline" disabled={loading || Boolean(working)} onClick={() => void load()}>Refresh</Button>
          <Button variant="primary" disabled={loading || Boolean(working)} onClick={() => void scanNow()}>
            {working === "scan" ? "Scanning..." : "Scan Now"}
          </Button>
        </div>}
      />
      {error && <p role="alert" className="mb-3 rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {notice && <p role="status" className="mb-3 rounded-md bg-green-50 p-3 text-sm text-green-700">{notice}</p>}
      {report && <>
        <div className="mb-4 grid gap-4 sm:grid-cols-3">
          <Card><CardContent><div className="text-xs text-neutral-500">Active escalations</div><div className="mt-1 text-2xl font-semibold">{report.total}</div></CardContent></Card>
          <Card><CardContent><div className="text-xs text-neutral-500">New / unacknowledged</div><div className="mt-1 text-2xl font-semibold text-red-700">{open}</div></CardContent></Card>
          <Card><CardContent><div className="text-xs text-neutral-500">Acknowledged</div><div className="mt-1 text-2xl font-semibold">{acknowledged}</div></CardContent></Card>
        </div>
        <p className="mb-4 text-sm text-white/70">
          Supabase Cron scans for overdue stages every minute when scheduled, even when the website is closed.
          Acknowledging means someone has seen the delay; it does not remove it. The alert resolves after the stage changes.
        </p>
        <Card><CardContent>
          <div className="mb-4 max-w-sm">
            <Input aria-label="Search workflow escalations" placeholder="Search job, customer or stage..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <p className="mb-3 text-xs text-neutral-500">
            Showing {rows.length} of {report.total} active alert(s){report.total > report.rows.length ? " (latest 200 only)" : ""}.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[850px] text-left text-sm">
              <thead className="border-b border-neutral-200 bg-neutral-50 text-xs uppercase text-neutral-600">
                <tr><th className="px-3 py-3">Job</th><th className="px-3 py-3">Customer</th><th className="px-3 py-3">Workflow / stage</th><th className="px-3 py-3">Overdue</th><th className="px-3 py-3">Status</th><th className="px-3 py-3">Action</th></tr>
              </thead>
              <tbody className="divide-y divide-neutral-200 text-neutral-700">
                {rows.map((row) => (
                  <tr key={row.id} className="hover:bg-neutral-50">
                    <td className="px-3 py-3 font-medium">
                      {row.job_number ? <Link className="text-blue-700 hover:underline" href={`/jobs/${encodeURIComponent(row.job_number)}`}>{row.job_number}</Link> : "—"}
                    </td>
                    <td className="px-3 py-3">{row.customer ?? "—"}</td>
                    <td className="px-3 py-3">{row.workflow_name}<div className="text-xs text-neutral-500">{row.stage_name}</div></td>
                    <td className="px-3 py-3 font-medium text-red-700">{overdueLabel(row.deadline_at, nowMs)}</td>
                    <td className="px-3 py-3">
                      <span className={`rounded-full px-2 py-1 text-xs ${row.status === "open" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-800"}`}>
                        {row.status === "open" ? "Needs attention" : "Acknowledged"}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      {row.status === "open" ? <Button variant="outline" disabled={Boolean(working)} onClick={() => void acknowledge(row.id)}>
                        {working === row.id ? "Saving..." : "Acknowledge"}
                      </Button> : "—"}
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && <tr><td colSpan={6} className="px-3 py-8 text-center text-neutral-500">No active escalations found.</td></tr>}
              </tbody>
            </table>
          </div>
        </CardContent></Card>
      </>}
      {loading && !report && <p className="text-sm text-white/70">Loading escalations...</p>}
    </PageShell>
  );
}
