"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import type { JobWorkflowState, WorkflowTemplate } from "@/lib/workflows/types";

export default function CustomWorkflowCard({ jobNumber, onChanged }: { jobNumber: string; onChanged: () => Promise<void> }) {
  const [templates, setTemplates] = useState<WorkflowTemplate[]>([]);
  const [current, setCurrent] = useState<JobWorkflowState | null>(null);
  const [chosen, setChosen] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const url = `/api/jobs/${encodeURIComponent(jobNumber)}/workflow`;

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(url, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to load job workflow");
      setTemplates(json.templates ?? []);
      setCurrent(json.current ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load job workflow");
    } finally {
      setLoading(false);
    }
  }, [url]);

  useEffect(() => { void load(); }, [load]);

  async function save(method: "POST" | "PATCH", body: object) {
    setSaving(true);
    setNotice("");
    setError("");
    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Could not update workflow");
      setNotice(method === "POST" ? "Workflow assigned." : "Moved to next stage.");
      await load();
      await onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update workflow");
    } finally {
      setSaving(false);
    }
  }

  const template = templates.find((item) => item.id === current?.workflow_id);
  const atFinal = Boolean(current && template && current.stage_index >= template.stages.length - 1);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div><div className="font-semibold">Custom Workflow</div><div className="mt-1 text-sm text-neutral-500">Company-defined operational stages · Admin and Dispatcher</div></div>
          <Button variant="outline" onClick={load} disabled={loading || saving}>Refresh</Button>
        </div>
      </CardHeader>
      <CardContent>
        {error && <p role="alert" className="mb-3 text-sm text-red-700">{error}</p>}
        {notice && <p role="status" className="mb-3 text-sm text-green-700">{notice}</p>}
        {loading && <p className="text-sm text-neutral-500">Loading...</p>}
        {!loading && !current && (
          templates.length === 0 ? <p className="text-sm text-neutral-600">No workflows available. Create one from the Workflows page first.</p> :
          <div className="flex flex-wrap items-center gap-3">
            <select aria-label="Select workflow" value={chosen} onChange={(event) => setChosen(event.target.value)} className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900">
              <option value="">Select workflow...</option>
              {templates.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}
            </select>
            <Button variant="primary" disabled={!chosen || saving} onClick={() => save("POST", { workflowId: chosen })}>{saving ? "Saving..." : "Assign Workflow"}</Button>
          </div>
        )}
        {!loading && current && template && (
          <>
            <p className="mb-3 text-sm font-medium">{template.name} · Stage {current.stage_index + 1} of {template.stages.length}</p>
            <div className="mb-4 flex flex-wrap gap-2">
              {template.stages.map((stage, index) => (
                <span key={`${template.id}-${index}`} className={`rounded-md px-3 py-2 text-xs font-medium ${index === current.stage_index ? "bg-blue-100 text-blue-800" : index < current.stage_index ? "bg-green-100 text-green-800" : "bg-neutral-100 text-neutral-600"}`}>
                  {index < current.stage_index ? "✓ " : ""}{index + 1}. {stage}
                </span>
              ))}
            </div>
            {atFinal ? <p className="text-sm font-medium text-green-700">All stages completed.</p> :
              <Button variant="primary" disabled={saving} onClick={() => save("PATCH", { expectedIndex: current.stage_index })}>
                {saving ? "Updating..." : `Move to: ${template.stages[current.stage_index + 1]}`}
              </Button>}
          </>
        )}
        {!loading && current && !template && <p className="text-sm text-red-700">Assigned template not found. Contact your administrator.</p>}
        <p className="mt-4 text-xs text-neutral-500">Stages advance in order only. This does not change the delivery status or driver operations.</p>
      </CardContent>
    </Card>
  );
}
