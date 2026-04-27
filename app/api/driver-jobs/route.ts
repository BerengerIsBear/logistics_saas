// app/api/driver-jobs/route.ts
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

async function getProfile(userId: string) {
  const { data, error } = await admin
    .from("profiles")
    .select("company_id, driver_id")
    .eq("id", userId)
    .maybeSingle();

  if (error) return null;
  return data as { company_id: string; driver_id: string | null } | null;
}

function todayYMD() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export async function GET(req: Request) {
  const user = await getAuthedUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const profile = await getProfile(user.id);

  if (!profile?.company_id) {
    return NextResponse.json({ error: "No company profile" }, { status: 403 });
  }

  if (!profile.driver_id) {
    return NextResponse.json(
      { error: "User not linked to driver" },
      { status: 403 }
    );
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
    .eq("company_id", profile.company_id)
    .eq("driver_id", profile.driver_id);

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

