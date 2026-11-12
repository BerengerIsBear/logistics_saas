"use client";

import { useCallback, useEffect, useState } from "react";
import { PageShell } from "@/components/PageShell";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  WORKFLOW_REQUIREMENTS,
  requirementsForStage,
  type WorkflowRequirement,
  type WorkflowRules,
  type WorkflowSlaMinutes,
  type WorkflowTemplate,
} from "@/lib/workflows/types";

export default function WorkflowsPage({ canCreate }: { canCreate: boolean }) {
  const [templates, setTemplates] = useState<WorkflowTemplate[]>([]);
  const [name, setName] = useState("");
  const [stagesText, setStagesText] = useState("Created\nWarehouse\nLoaded\nDispatched\nDelivered");
  const [rules, setRules] = useState<WorkflowRules>({});
  const [stageSlaMinutes, setStageSlaMinutes] = useState<WorkflowSlaMinutes>({});
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

  const previewStages = stagesText.split("\n").map((stage) => stage.trim()).filter(Boolean);

  function toggleRule(index: number, requirement: WorkflowRequirement, checked: boolean) {
    setRules((current) => {
      const key = String(index);
      const next = { ...current };
      const values = current[key] ?? [];
      const updated = checked ? [...values, requirement] : values.filter((r) => r !== requirement);
      if (updated.length) next[key] = updated;
      else delete next[key];
      return next;
    });
  }

  function updateStageTimer(index: number, value: string) {
    setStageSlaMinutes((current) => {
      const next = { ...current };
      if (value === "") delete next[String(index)];
      else next[String(index)] = Number(value);
      return next;
    });
  }

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
        body: JSON.stringify({ name, stages, rules, stage_sla_minutes: stageSlaMinutes }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to create workflow");
      setName("");
      setRules({});
      setStageSlaMinutes({});
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
              <div className="space-y-3">
                <div className="text-sm font-semibold">Conditions to enter each stage (optional)</div>
                <p className="text-xs text-neutral-500">Pick what must be true before moving INTO the stage. You can select multiple conditions.</p>
                {previewStages.slice(1, 12).map((stage, offset) => {
                  const stageIndex = offset + 1;
                  const selected = requirementsForStage(rules, stageIndex);
                  return (
                    <fieldset key={stageIndex} className="rounded-lg border border-neutral-200 p-3">
                      <legend className="px-1 text-sm font-medium">Move to: {stage}</legend>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {Object.entries(WORKFLOW_REQUIREMENTS).map(([rule, label]) => (
                          <label key={rule} className="flex items-center gap-2 text-sm">
                            <input
                              type="checkbox"
                              checked={selected.includes(rule as WorkflowRequirement)}
                              onChange={(event) => toggleRule(stageIndex, rule as WorkflowRequirement, event.target.checked)}
                            />
                            {label}
                          </label>
                        ))}
                      </div>
                    </fieldset>
                  );
                })}
              </div>
              <div className="space-y-3">
                <div className="text-sm font-semibold">Stage SLA timers (optional)</div>
                <p className="text-xs text-neutral-500">Maximum time allowed IN each stage, starting when the job enters it. Leave blank for no time limit. Final stage needs no timer.</p>
                {previewStages.slice(0, -1).map((stage, index) => (
                  <label key={index} className="flex items-center justify-between gap-4 text-sm">
                    <span>{index + 1}. {stage}</span>
                    <span className="flex items-center gap-2">
                      <Input
                        className="w-28"
                        type="number" min={1} max={10080} step={1}
                        placeholder="No limit"
                        value={stageSlaMinutes[String(index)] ?? ""}
                        onChange={(event) => updateStageTimer(index, event.target.value)}
                        aria-label={`Time limit for ${stage} in minutes`}
                      />
                      <span className="text-neutral-500">min</span>
                    </span>
                  </label>
                ))}
              </div>
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
                {template.stages.slice(0, -1).map((stage, index) => {
                  const minutes = template.stage_sla_minutes?.[String(index)];
                  return minutes ? (
                    <p key={`sla-${index}`} className="mt-2 text-xs text-neutral-600">
                      <span className="font-medium">In {stage}:</span> {minutes} minute SLA
                    </p>
                  ) : null;
                })}
                {template.stages.slice(1).map((stage, offset) => {
                  const conditions = requirementsForStage(template.rules, offset + 1);
                  return conditions.length > 0 ? (
                    <p key={offset} className="mt-2 text-xs text-neutral-600">
                      <span className="font-medium">To {stage}:</span> {conditions.map((c) => WORKFLOW_REQUIREMENTS[c]).join(" + ")}
                    </p>
                  ) : null;
                })}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </PageShell>
  );
}
