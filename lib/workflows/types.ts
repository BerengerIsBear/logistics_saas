export const WORKFLOW_REQUIREMENTS = {
  manual_confirmation: "Manual confirmation",
  driver_assigned: "Driver assigned",
  vehicle_assigned: "Vehicle assigned",
  pod_uploaded: "Proof of Delivery uploaded",
} as const;

export type WorkflowRequirement = keyof typeof WORKFLOW_REQUIREMENTS;

// Keys are destination stage indexes (starting at 0). Stage 0 has no entry condition.
export type WorkflowRules = Record<string, WorkflowRequirement[]>;

export type WorkflowTemplate = {
  id: string;
  name: string;
  stages: string[];
  rules: WorkflowRules;
  created_at: string;
};

export type JobWorkflowState = {
  workflow_id: string;
  stage_index: number;
  updated_at: string;
};

export function requirementsForStage(rules: WorkflowRules | null | undefined, stageIndex: number): WorkflowRequirement[] {
  return rules?.[String(stageIndex)] ?? [];
}

// The template stays immutable after creation, preserving the rules used by existing jobs.
export function parseWorkflowInput(body: unknown):
  | { name: string; stages: string[]; rules: WorkflowRules; error?: never }
  | { error: string; name?: never; stages?: never; rules?: never } {
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

  return { name, stages, rules };
}
