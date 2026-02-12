// app/api/jobs/[jobNumber]/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

const admin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function getAuthedUser() {
  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll() {},
      },
    }
  );

  const { data } = await supabase.auth.getUser();
  return data.user ?? null;
}

async function getCompanyId(userId: string) {
  const { data, error } = await admin
    .from("profiles")
    .select("company_id")
    .eq("id", userId)
    .single();

  if (error || !data?.company_id) return null;
  return data.company_id as string;
}

const ALLOWED_STATUSES = new Set(["pending", "assigned", "in_transit", "delivered"]);

function nowIso() {
  return new Date().toISOString();
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ jobNumber: string }> }
) {
  const { jobNumber } = await ctx.params;

  const user = await getAuthedUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const companyId = await getCompanyId(user.id);
  if (!companyId) return NextResponse.json({ error: "No company profile" }, { status: 403 });

  const body = await req.json().catch(() => null);
  const status = String(body?.status ?? "").trim();

  if (!ALLOWED_STATUSES.has(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  // Read current job to safely set lifecycle timestamps when needed
  const { data: current, error: readErr } = await admin
    .from("jobs")
    .select("status,in_transit_at,delivered_at")
    .eq("company_id", companyId)
    .eq("job_number", jobNumber)
    .maybeSingle();

  if (readErr) return NextResponse.json({ error: readErr.message }, { status: 500 });
  if (!current) return NextResponse.json({ error: "Job not found" }, { status: 404 });

  const patch: Record<string, any> = { status };

  // Auto-stamp timestamps for real lifecycle milestones
  if (status === "in_transit" && !current.in_transit_at) patch.in_transit_at = nowIso();
  if (status === "delivered" && !current.delivered_at) patch.delivered_at = nowIso();

  const { data: row, error } = await admin
    .from("jobs")
    .update(patch)
    .eq("company_id", companyId)
    .eq("job_number", jobNumber)
    .select("*")
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!row) return NextResponse.json({ error: "Job not found" }, { status: 404 });

  return NextResponse.json({ job: row });
}
