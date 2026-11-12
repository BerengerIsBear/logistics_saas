import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/access";
import { supabaseAdmin } from "@/lib/supabase/server";

// All results are company-scoped and contain no financial information.
export async function GET() {
  const auth = await requireRole(["admin", "dispatcher"]);
  if ("response" in auth) return auth.response;

  const admin = supabaseAdmin();
  const { companyId } = auth.context;
  const [listResult, openResult, acknowledgedResult] = await Promise.all([
    admin.from("workflow_escalations")
      .select("id,job_id,workflow_name,stage_name,stage_started_at,deadline_at,status,created_at,acknowledged_at", { count: "exact" })
      .eq("company_id", companyId)
      .in("status", ["open", "acknowledged"])
      .order("deadline_at", { ascending: true })
      .limit(200),
    admin.from("workflow_escalations")
      .select("id", { count: "exact", head: true })
      .eq("company_id", companyId).eq("status", "open"),
    admin.from("workflow_escalations")
      .select("id", { count: "exact", head: true })
      .eq("company_id", companyId).eq("status", "acknowledged"),
  ]);

  if (listResult.error || openResult.error || acknowledgedResult.error) {
    return NextResponse.json({ error: "Could not load escalations" }, { status: 500 });
  }
  const alerts = listResult.data ?? [];
  const ids = [...new Set(alerts.map((alert) => alert.job_id))];

  let jobs: { id: string; job_number: string; customer: string | null }[] = [];
  if (ids.length > 0) {
    const result = await admin.from("jobs")
      .select("id,job_number,customer")
      .eq("company_id", companyId)
      .in("id", ids);
    if (result.error) return NextResponse.json({ error: "Could not load job details" }, { status: 500 });
    jobs = result.data ?? [];
  }

  const byJobId = new Map(jobs.map((job) => [job.id, job]));
  return NextResponse.json({
    total: listResult.count ?? alerts.length,
    open_count: openResult.count ?? 0,
    acknowledged_count: acknowledgedResult.count ?? 0,
    rows: alerts.map((alert) => ({
      ...alert,
      job_number: byJobId.get(alert.job_id)?.job_number ?? null,
      customer: byJobId.get(alert.job_id)?.customer ?? null,
    })),
  }, { headers: { "Cache-Control": "private, no-store" } });
}

// Useful during local testing. Scheduled Supabase Cron also calls this database function every minute.
export async function POST() {
  const auth = await requireRole(["admin", "dispatcher"]);
  if ("response" in auth) return auth.response;

  const { data, error } = await supabaseAdmin().rpc("sync_workflow_escalations", {
    p_company_id: auth.context.companyId,
  });
  if (error) return NextResponse.json({ error: "Escalation scan failed" }, { status: 500 });

  return NextResponse.json({ result: data?.[0] ?? { created_count: 0, resolved_count: 0 } });
}
