// app/api/jobs/[jobNumber]/assign/route.ts
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
  const driverId = String(body?.driverId ?? "").trim();
  const vehicleId = String(body?.vehicleId ?? "").trim();

  if (!driverId || !vehicleId) {
    return NextResponse.json({ error: "driverId and vehicleId required" }, { status: 400 });
  }

  // Ensure driver belongs to company
  const { data: driverRow } = await admin
    .from("drivers")
    .select("id")
    .eq("company_id", companyId)
    .eq("id", driverId)
    .maybeSingle();

  if (!driverRow) return NextResponse.json({ error: "Invalid driver" }, { status: 400 });

  // Ensure vehicle belongs to company
  const { data: vehicleRow } = await admin
    .from("vehicles")
    .select("id")
    .eq("company_id", companyId)
    .eq("id", vehicleId)
    .maybeSingle();

  if (!vehicleRow) return NextResponse.json({ error: "Invalid vehicle" }, { status: 400 });

  // Assign + optionally bump status to assigned if still pending
  const { data: job, error } = await admin
    .from("jobs")
    .update({
      driver_id: driverId,
      vehicle_id: vehicleId,
      assigned_at: new Date().toISOString(),
      status: "assigned",
    })
    .eq("company_id", companyId)
    .eq("job_number", jobNumber)
    .select("*")
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

  return NextResponse.json({ job });
}
