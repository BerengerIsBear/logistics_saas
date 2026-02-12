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

async function getCompanyId(userId: string) {
  const { data, error } = await admin
    .from("profiles")
    .select("company_id")
    .eq("id", userId)
    .single();

  if (error || !data?.company_id) return null;
  return data.company_id as string;
}

function todayYMD() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`; // "YYYY-MM-DD"
}

export async function GET(req: Request) {
  const user = await getAuthedUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const companyId = await getCompanyId(user.id);
  if (!companyId) return NextResponse.json({ error: "No company profile" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const driverId = String(searchParams.get("driverId") ?? "").trim();
  const scope = String(searchParams.get("scope") ?? "today").trim(); // today | upcoming

  if (!driverId) return NextResponse.json({ error: "driverId required" }, { status: 400 });

  let q = admin
    .from("jobs")
    .select(
      `
      *,
      drivers(name),
      vehicles(plate_no)
    `
    )
    .eq("company_id", companyId)
    .eq("driver_id", driverId)
    .order("scheduled_date", { ascending: true })
    .order("window_start", { ascending: true })
    .order("created_at", { ascending: false });

  const today = todayYMD();

  if (scope === "today") {
    q = q.eq("scheduled_date", today);
  } else if (scope === "upcoming") {
    q = q.gt("scheduled_date", today).neq("status", "delivered");
  } else {
    return NextResponse.json({ error: "Invalid scope" }, { status: 400 });
  }

  const { data: rows, error } = await q;

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ jobs: rows ?? [] });
}

