import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/access";
import { supabaseAdmin } from "@/lib/supabase/server";
import { buildSlaPerformance, type SlaAnalyticsJob } from "@/lib/jobs/slaPerformance";

// GET /api/analytics/sla-performance — operational data, not financial data.
export async function GET() {
  const auth = await requireRole(["admin", "dispatcher"]);
  if ("response" in auth) return auth.response;

  try {
    const { companyId } = auth.context;
    const admin = supabaseAdmin();
    const jobs: SlaAnalyticsJob[] = [];
    const size = 500;

    // Explicit pagination avoids silently ignoring jobs after row 1,000.
    for (let offset = 0; ; offset += size) {
      const { data, error } = await admin
        .from("jobs")
        .select("id,customer_id,customer,status,scheduled_date,window_end,delivered_at")
        .eq("company_id", companyId)
        .order("id", { ascending: true })
        .range(offset, offset + size - 1);

      if (error) throw new Error(error.message);
      const batch = (data ?? []) as SlaAnalyticsJob[];
      jobs.push(...batch);
      if (batch.length < size) break;
    }

    return NextResponse.json(buildSlaPerformance(jobs), {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    console.error("SLA performance report failed", error);
    return NextResponse.json({ error: "Could not load SLA performance" }, { status: 500 });
  }
}
