export type WorkflowTemplate = {
  id: string;
  name: string;
  stages: string[];
  created_at: string;
};

export type JobWorkflowState = {
  workflow_id: string;
  stage_index: number;
  updated_at: string;
};

// Stage names are fixed once a template is created, so historical jobs remain readable.
export function parseWorkflowInput(body: unknown):
  | { name: string; stages: string[]; error?: never }
  | { error: string; name?: never; stages?: never } {
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
  return { name, stages };
}
