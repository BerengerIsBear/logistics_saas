// app/api/driver-jobs/route.ts
import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/access";
import { createClient } from "@supabase/supabase-js";

const admin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function todayYMD() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export async function GET(req: Request) {
  const auth = await requireRole(["driver"]);
  if ("response" in auth) return auth.response;
  const { companyId, driverId } = auth.context;
  if (!driverId) {
    return NextResponse.json({ error: "User not linked to driver" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const scope = String(searchParams.get("scope") ?? "today").trim();
  const statusFilter = String(searchParams.get("status") ?? "").trim();

  const today = todayYMD();

  let query = admin
    .from("jobs")
    .select(
      `
        *,
        customers(name),
        drivers(name),
        vehicles(plate_no)
      `
    )
    .eq("company_id", companyId)
    .eq("driver_id", driverId);

  // Operational scope logic
  if (scope === "today") {
    query = query
      .lte("scheduled_date", today)
      .neq("status", "delivered");
  } else if (scope === "upcoming") {
    query = query
      .gt("scheduled_date", today)
      .neq("status", "delivered");
  } else {
    return NextResponse.json({ error: "Invalid scope" }, { status: 400 });
  }

  // Optional status filter (future flexibility)
  if (statusFilter) {
    query = query.eq("status", statusFilter);
  }

  const { data: rows, error } = await query
    .order("scheduled_date", { ascending: true })
    .order("window_start", { ascending: true })
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ jobs: rows ?? [] });
}

