export const WORKFLOW_REQUIREMENTS = {
  manual_confirmation: "Manual confirmation",
  driver_assigned: "Driver assigned",
  vehicle_assigned: "Vehicle assigned",
  pod_uploaded: "Proof of Delivery uploaded",
} as const;

export type WorkflowRequirement = keyof typeof WORKFLOW_REQUIREMENTS;

// Keys are destination stage indexes (starting at 0). Stage 0 has no entry condition.
export type WorkflowRules = Record<string, WorkflowRequirement[]>;

// Key = stage index (starting at 0). The final stage has no active timer.
// Omit a key to leave that stage without an SLA.
export type WorkflowSlaMinutes = Record<string, number>;

export type StageSlaStatus = "on_track" | "at_risk" | "breached" | "not_configured" | "unknown" | "completed";

export function getStageSlaStatus(
  stageIndex: number,
  stageCount: number,
  startedAt: string | null | undefined,
  stageSlaMinutes: WorkflowSlaMinutes | null | undefined,
  nowMs: number = Date.now(),
): { status: StageSlaStatus; deadlineMs: number | null; remainingMs: number | null } {
  if (stageIndex >= stageCount - 1) return { status: "completed", deadlineMs: null, remainingMs: null };

  const limit = stageSlaMinutes?.[String(stageIndex)];
  if (typeof limit !== "number" || !Number.isInteger(limit) || !Number.isFinite(limit) || limit < 1) {
    return { status: "not_configured", deadlineMs: null, remainingMs: null };
  }
  const startMs = startedAt ? Date.parse(startedAt) : NaN;
  if (!Number.isFinite(startMs)) return { status: "unknown", deadlineMs: null, remainingMs: null };

  const deadlineMs = startMs + limit * 60_000;
  const remainingMs = deadlineMs - nowMs;
  if (remainingMs <= 0) return { status: "breached", deadlineMs, remainingMs };
  const warningMs = Math.min(10 * 60_000, limit * 60_000 * 0.2);
  return {
    status: remainingMs <= warningMs ? "at_risk" : "on_track",
    deadlineMs,
    remainingMs,
  };
}

export type WorkflowTemplate = {
  id: string;
  name: string;
  stages: string[];
  rules: WorkflowRules;
  stage_sla_minutes: WorkflowSlaMinutes;
  created_at: string;
};

export type JobWorkflowState = {
  workflow_id: string;
  stage_index: number;
  updated_at: string;
  stage_started_at: string;
};

export function requirementsForStage(rules: WorkflowRules | null | undefined, stageIndex: number): WorkflowRequirement[] {
  return rules?.[String(stageIndex)] ?? [];
}

// The template stays immutable after creation, preserving the rules used by existing jobs.
export function parseWorkflowInput(body: unknown):
  | { name: string; stages: string[]; rules: WorkflowRules; stage_sla_minutes: WorkflowSlaMinutes; error?: never }
  | { error: string; name?: never; stages?: never; rules?: never; stage_sla_minutes?: never } {
  if (!body || typeof body !== "object") return { error: "Invalid request" };
  const input = body as Record<string, unknown>;
  if (typeof input.name !== "string") return { error: "Workflow name is required" };
  const name = input.name.trim();
  if (name.length < 1 || name.length > 80) return { error: "Name must be 1–80 characters" };
  if (!Array.isArray(input.stages) || input.stages.length < 2 || input.stages.length > 12) {
    return { error: "Enter 2–12 stages" };
  }
  if (!input.stages.every((stage) => typeof stage === "string" && stage.trim().length >= 1 && stage.trim().length <= 60)) {
    return { error: "Each stage must be 1–60 characters" };
  }
  const stages = (input.stages as string[]).map((stage) => stage.trim());
  if (new Set(stages.map((stage) => stage.toLowerCase())).size !== stages.length) {
    return { error: "Stage names must be different" };
  }

  const supplied = input.rules ?? {};
  if (!supplied || typeof supplied !== "object" || Array.isArray(supplied)) {
    return { error: "Invalid workflow rules" };
  }

  const rules: WorkflowRules = {};
  for (const [key, value] of Object.entries(supplied)) {
    const stageIndex = Number(key);
    if (!/^[1-9]\d*$/.test(key) || !Number.isSafeInteger(stageIndex) || stageIndex >= stages.length) {
      return { error: "Rules must target a stage after the first" };
    }
    if (!Array.isArray(value) || value.length > 4 || !value.every((rule) =>
      typeof rule === "string" && Object.prototype.hasOwnProperty.call(WORKFLOW_REQUIREMENTS, rule)
    )) {
      return { error: "Invalid condition selected" };
    }
    const unique = Array.from(new Set(value)) as WorkflowRequirement[];
    if (unique.length !== value.length) return { error: "Duplicate conditions are not allowed" };
    if (unique.length) rules[key] = unique;
  }

  const suppliedSla = input.stage_sla_minutes ?? {};
  if (!suppliedSla || typeof suppliedSla !== "object" || Array.isArray(suppliedSla)) {
    return { error: "Invalid stage SLA timers" };
  }
  const stage_sla_minutes: WorkflowSlaMinutes = {};
  for (const [key, minutes] of Object.entries(suppliedSla)) {
    const index = Number(key);
    if (!/^(0|[1-9]\d*)$/.test(key) || !Number.isSafeInteger(index) || index >= stages.length - 1) {
      return { error: "Timers must target a stage before the last stage" };
    }
    if (typeof minutes !== "number" || !Number.isInteger(minutes) || minutes < 1 || minutes > 10080) {
      return { error: "Each stage time limit must be 1–10080 whole minutes" };
    }
    stage_sla_minutes[key] = minutes;
  }

  return { name, stages, rules, stage_sla_minutes };
}
