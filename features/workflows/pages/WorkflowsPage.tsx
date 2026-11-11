"use client";

import { useCallback, useEffect, useState } from "react";
import { PageShell } from "@/components/PageShell";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import type { WorkflowTemplate } from "@/lib/workflows/types";

export default function WorkflowsPage({ canCreate }: { canCreate: boolean }) {
  const [templates, setTemplates] = useState<WorkflowTemplate[]>([]);
  const [name, setName] = useState("");
  const [stagesText, setStagesText] = useState("Created\nWarehouse\nLoaded\nDispatched\nDelivered");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/workflows", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to load workflows");
      setTemplates(json.templates ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load workflows");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function createWorkflow(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const stages = stagesText.split("\n").map((stage) => stage.trim()).filter(Boolean);
      const res = await fetch("/api/workflows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, stages }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to create workflow");
      setName("");
      setNotice("Workflow created. You can assign it to a job from Job Details.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create workflow");
    } finally {
      setSaving(false);
    }
  }

  return (
    <PageShell>
      <PageHeader title="Workflows" subtitle="Reusable operational checkpoints for your company." action={<Button variant="outline" onClick={load} disabled={loading}>Refresh</Button>} />
      <p className="mb-4 text-sm text-white/70">
        Custom stages are separate from delivery statuses (Pending → Assigned → In Transit → Delivered).
        They move one step at a time. Delivery tracking and driver actions stay unchanged.
      </p>
      {error && <div role="alert" className="mb-4 rounded-lg bg-white p-4 text-sm text-red-700">{error}</div>}
      {notice && <div role="status" className="mb-4 rounded-lg bg-white p-4 text-sm text-green-700">{notice}</div>}
      {canCreate && (
        <Card className="mb-4">
          <CardHeader><div className="font-semibold">Create Workflow</div><p className="mt-1 text-sm text-neutral-500">Admin only · Enter one stage per line (2–12 stages).</p></CardHeader>
          <CardContent>
            <form onSubmit={createWorkflow} className="max-w-xl space-y-4">
              <label className="block text-sm font-medium">Workflow name
                <Input className="mt-1" required maxLength={80} placeholder="e.g. Warehouse Dispatch" value={name} onChange={(event) => setName(event.target.value)} />
              </label>
              <label className="block text-sm font-medium">Stages (in order)
                <textarea
                  aria-label="Workflow stages"
                  className="mt-1 min-h-40 w-full rounded-md border border-neutral-200 p-3 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-200"
                  required value={stagesText} onChange={(event) => setStagesText(event.target.value)}
                />
              </label>
              <Button type="submit" variant="primary" disabled={saving}>{saving ? "Creating..." : "Create Workflow"}</Button>
            </form>
          </CardContent>
        </Card>
      )}
      <Card>
        <CardHeader><div className="font-semibold">Available Workflows</div><p className="mt-1 text-sm text-neutral-500">{templates.length} workflow(s). Existing templates are fixed to protect job history.</p></CardHeader>
        <CardContent>
          {loading && <p className="text-sm text-neutral-500">Loading...</p>}
          {!loading && templates.length === 0 && <p className="text-sm text-neutral-500">No workflows yet. Create one above to get started.</p>}
          <div className="space-y-4">
            {templates.map((template) => (
              <div key={template.id} className="rounded-lg border border-neutral-200 p-4">
                <div className="font-semibold">{template.name}</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {template.stages.map((stage, index) => (
                    <span key={`${template.id}-${index}`} className="rounded bg-neutral-100 px-3 py-1 text-xs text-neutral-700">{index + 1}. {stage}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </PageShell>
  );
}
