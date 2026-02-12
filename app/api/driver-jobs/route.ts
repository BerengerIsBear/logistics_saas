// app/api/driver-jobs/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
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

  if (error) return { data: null as any, error: error.message };
  return { data, error: null as string | null };
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
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const prof = await getProfile(user.id);

  if (!prof.data?.company_id) {
    return NextResponse.json(
      {
        error: "No company profile",
        userId: user.id,
        profileFound: !!prof.data,
        profileError: prof.error,
        company_id: prof.data?.company_id ?? null,
        driver_id: prof.data?.driver_id ?? null,
      },
      { status: 403 }
    );
  }

  if (!prof.data.driver_id) {
    return NextResponse.json(
      {
        error: "Your user is not linked to a driver yet (profiles.driver_id is missing)",
        userId: user.id,
      },
      { status: 403 }
    );
  }

  const { searchParams } = new URL(req.url);
  const scope = String(searchParams.get("scope") ?? "today").trim();

  const today = todayYMD();

  let q = admin
    .from("jobs")
    .select(
      `
        *,
        customers(name),
        drivers(name),
        vehicles(plate_no)
      `
    )
    .eq("company_id", prof.data.company_id)
    .eq("driver_id", prof.data.driver_id)
    .order("scheduled_date", { ascending: true })
    .order("window_start", { ascending: true })
    .order("created_at", { ascending: false });

  // ✅ practical ops logic:
  // "today" means active jobs scheduled up to today (includes late jobs), excluding delivered
  if (scope === "today") {
    q = q.lte("scheduled_date", today).neq("status", "delivered");
  } else if (scope === "upcoming") {
    q = q.gt("scheduled_date", today).neq("status", "delivered");
  } else {
    return NextResponse.json({ error: "Invalid scope" }, { status: 400 });
  }

  const { data: rows, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ jobs: rows ?? [] });
}
