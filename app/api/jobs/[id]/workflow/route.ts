import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/access";
import { supabaseAdmin } from "@/lib/supabase/server";
import { logActivity } from "@/lib/activity/logActivity";
import { getStageSlaStatus, requirementsForStage, type WorkflowRules, type WorkflowSlaMinutes } from "@/lib/workflows/types";

const isUuid = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

type Context = { params: Promise<{ id: string }> };

async function findJob(companyId: string, jobNumber: string) {
  return supabaseAdmin()
    .from("jobs")
    .select("id,job_number,driver_id,vehicle_id")
    .eq("company_id", companyId)
    .eq("job_number", jobNumber)
    .maybeSingle();
}

export async function GET(_request: Request, context: Context) {
  const auth = await requireRole(["admin", "dispatcher"]);
  if ("response" in auth) return auth.response;
  const { companyId } = auth.context;
  const { id } = await context.params;
  const { data: job, error: jobError } = await findJob(companyId, id);
  if (jobError) return NextResponse.json({ error: jobError.message }, { status: 500 });
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

  const admin = supabaseAdmin();
  const [templatesResult, currentResult] = await Promise.all([
    admin.from("workflow_templates")
      .select("id,name,stages,rules,stage_sla_minutes,created_at").eq("company_id", companyId)
      .order("created_at", { ascending: false }),
    admin.from("job_workflows")
      .select("workflow_id,stage_index,updated_at,stage_started_at")
      .eq("company_id", companyId).eq("job_id", job.id).maybeSingle(),
  ]);
  if (templatesResult.error || currentResult.error) {
    return NextResponse.json({ error: templatesResult.error?.message ?? currentResult.error?.message }, { status: 500 });
  }
  return NextResponse.json({ templates: templatesResult.data ?? [], current: currentResult.data ?? null });
}

// Assign a template once. Avoid overwriting job history by accident.
export async function POST(request: Request, context: Context) {
  const auth = await requireRole(["admin", "dispatcher"]);
  if ("response" in auth) return auth.response;
  const { companyId, userId } = auth.context;
  const body = await request.json().catch(() => null);
  const workflowId = typeof body?.workflowId === "string" ? body.workflowId : "";
  if (!isUuid(workflowId)) return NextResponse.json({ error: "Select a valid workflow" }, { status: 400 });

  const { id } = await context.params;
  const admin = supabaseAdmin();
  const [{ data: job, error: jobError }, { data: workflow, error: templateError }] = await Promise.all([
    findJob(companyId, id),
    admin.from("workflow_templates").select("id,name,stages,rules,stage_sla_minutes")
      .eq("company_id", companyId).eq("id", workflowId).maybeSingle(),
  ]);
  if (jobError || templateError) return NextResponse.json({ error: jobError?.message ?? templateError?.message }, { status: 500 });
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });
  if (!workflow) return NextResponse.json({ error: "Workflow not found" }, { status: 404 });

  const { data, error } = await admin.from("job_workflows")
    .insert({ job_id: job.id, company_id: companyId, workflow_id: workflow.id, stage_index: 0, updated_by: userId, stage_started_at: new Date().toISOString() })
    .select("workflow_id,stage_index,updated_at,stage_started_at").single();
  if (error) {
    if (error.code === "23505") return NextResponse.json({ error: "This job already has a workflow" }, { status: 409 });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await logActivity({
    admin, companyId, jobId: job.id, actorUserId: userId, action: "workflow.assigned",
    meta: { job_number: job.job_number, workflow_id: workflow.id, workflow: workflow.name, stage: workflow.stages[0] },
  });
  return NextResponse.json({ current: data }, { status: 201 });
}

// A deliberate one-stage advance. Never trusts the client for the next stage name/index.
export async function PATCH(request: Request, context: Context) {
  const auth = await requireRole(["admin", "dispatcher"]);
  if ("response" in auth) return auth.response;
  const { companyId, userId } = auth.context;
  const body = await request.json().catch(() => null);
  if (!Number.isInteger(body?.expectedIndex) || body.expectedIndex < 0) {
    return NextResponse.json({ error: "Expected stage index required" }, { status: 400 });
  }

  const { id } = await context.params;
  const admin = supabaseAdmin();
  const { data: job, error: jobError } = await findJob(companyId, id);
  if (jobError) return NextResponse.json({ error: jobError.message }, { status: 500 });
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

  const { data: state, error: stateError } = await admin.from("job_workflows")
    .select("workflow_id,stage_index,stage_started_at")
    .eq("company_id", companyId).eq("job_id", job.id).maybeSingle();
  if (stateError) return NextResponse.json({ error: stateError.message }, { status: 500 });
  if (!state) return NextResponse.json({ error: "Assign a workflow first" }, { status: 400 });
  if (state.stage_index !== body.expectedIndex) {
    return NextResponse.json({ error: "Workflow moved. Refresh the page." }, { status: 409 });
  }

  const { data: workflow, error: workflowError } = await admin.from("workflow_templates")
    .select("id,name,stages,rules,stage_sla_minutes").eq("company_id", companyId)
    .eq("id", state.workflow_id).maybeSingle();
  if (workflowError) return NextResponse.json({ error: workflowError.message }, { status: 500 });
  if (!workflow) return NextResponse.json({ error: "Workflow not found" }, { status: 404 });
  const stages: string[] = workflow.stages;
  if (state.stage_index >= stages.length - 1) return NextResponse.json({ error: "Already at final stage" }, { status: 400 });

  const nextIndex = state.stage_index + 1;
  const rules = requirementsForStage(workflow.rules as WorkflowRules | null, nextIndex);

  // Conditions are verified server-side, never based on a browser's claim.
  if (rules.includes("driver_assigned") && !job.driver_id) {
    return NextResponse.json({ error: "Assign a driver before moving to this stage" }, { status: 409 });
  }
  if (rules.includes("vehicle_assigned") && !job.vehicle_id) {
    return NextResponse.json({ error: "Assign a vehicle before moving to this stage" }, { status: 409 });
  }
  if (rules.includes("pod_uploaded")) {
    // pod_files.job_id stores a human-readable job number (e.g. JOB-1012), not the UUID.
    const { data: pod, error: podError } = await admin.from("pod_files")
      .select("id").eq("company_id", companyId).eq("job_id", job.job_number)
      .limit(1).maybeSingle();
    if (podError) return NextResponse.json({ error: podError.message }, { status: 500 });
    if (!pod) return NextResponse.json({ error: "Upload Proof of Delivery before moving to this stage" }, { status: 409 });
  }
  // Manual confirmation is an explicit staff attestation, not independent proof.
  if (rules.includes("manual_confirmation") && body.confirmed !== true) {
    return NextResponse.json({ error: "Confirm the stage requirements before continuing" }, { status: 409 });
  }

  const advancedAt = new Date().toISOString();
  const { data: updated, error: updateError } = await admin.from("job_workflows")
    .update({ stage_index: nextIndex, updated_at: advancedAt, stage_started_at: advancedAt, updated_by: userId })
    .eq("company_id", companyId).eq("job_id", job.id)
    .eq("workflow_id", state.workflow_id).eq("stage_index", state.stage_index)
    .select("workflow_id,stage_index,updated_at,stage_started_at").maybeSingle();

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });
  if (!updated) return NextResponse.json({ error: "Workflow moved. Refresh the page." }, { status: 409 });

  const priorSla = getStageSlaStatus(
    state.stage_index, stages.length, state.stage_started_at,
    workflow.stage_sla_minutes as WorkflowSlaMinutes | null, Date.parse(advancedAt),
  );
  await logActivity({
    admin, companyId, jobId: job.id, actorUserId: userId, action: "workflow.advanced",
    meta: {
      job_number: job.job_number, workflow_id: workflow.id, workflow: workflow.name,
      from: stages[state.stage_index], to: stages[nextIndex], from_index: state.stage_index, to_index: nextIndex,
      requirements_checked: rules,
      previous_stage_started_at: state.stage_started_at,
      previous_stage_sla_minutes: (workflow.stage_sla_minutes as WorkflowSlaMinutes | null)?.[String(state.stage_index)] ?? null,
      previous_stage_sla_breached: priorSla.status === "breached",
      previous_stage_elapsed_minutes: state.stage_started_at
        ? Math.max(0, Math.round((Date.parse(advancedAt) - Date.parse(state.stage_started_at)) / 60_000))
        : null,
      manual_confirmation: rules.includes("manual_confirmation") ? true : undefined,
    },
  });
  return NextResponse.json({ current: updated });
}
