"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { PageShell } from "@/components/PageShell";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

type AuditEvent = {
  id: string;
  actor_user_id: string;
  actor_email: string | null;
  action: string;
  target_type: string;
  target_id: string;
  details: Record<string, unknown>;
  created_at: string;
};

const actionLabels: Record<string, string> = {
  "employee.invited": "Employee invited",
  "employee.updated": "Employee access updated",
  "workflow.created": "Workflow created",
  "finance.updated": "Job financials changed",
};

export default function AdminAuditPage() {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin-audit", { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Could not load audit logs");
      setEvents(body.events ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load audit logs");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  return (
    <PageShell>
      <PageHeader title="Admin Audit Log" subtitle="Who changed employee access, workflows and job financials · Admin only"
        action={<Button disabled={loading} onClick={() => void load()}>{loading ? "Loading..." : "Refresh"}</Button>} />
      {error && <p role="alert" className="mb-4 rounded bg-white p-3 text-sm text-red-700">{error}</p>}
      <Card><CardContent>
        <p className="mb-3 text-xs text-neutral-500">Latest 100 actions · Newest first · Read-only</p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px] text-left text-sm">
            <thead className="border-b border-neutral-200 bg-neutral-50 text-xs uppercase text-neutral-600">
              <tr><th className="px-3 py-3">When</th><th className="px-3 py-3">Action</th><th className="px-3 py-3">By</th><th className="px-3 py-3">Target</th><th className="px-3 py-3">Details</th></tr>
            </thead>
            <tbody className="divide-y divide-neutral-200 text-neutral-800">
              {events.map(event => (
                <tr key={event.id} className="align-top">
                  <td className="whitespace-nowrap px-3 py-3">{new Date(event.created_at).toLocaleString("en-SG")}</td>
                  <td className="px-3 py-3">{actionLabels[event.action] ?? event.action}</td>
                  <td className="px-3 py-3 break-all">{event.actor_email ?? event.actor_user_id.slice(0, 8)}</td>
                  <td className="px-3 py-3 break-all">{event.target_type}: {event.target_id}</td>
                  <td className="px-3 py-3">
                    <details><summary className="cursor-pointer text-blue-700">View</summary>
                      <pre className="mt-2 max-w-sm whitespace-pre-wrap break-all text-xs">{JSON.stringify(event.details, null, 2)}</pre>
                    </details>
                  </td>
                </tr>
              ))}
              {!loading && events.length === 0 && !error && (
                <tr><td colSpan={5} className="px-3 py-8 text-center text-neutral-500">No admin actions recorded yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </CardContent></Card>
    </PageShell>
  );
}
