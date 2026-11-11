// lib/auth/access.ts
// Server-only: validates the Supabase user and reads trusted role/company data.
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { supabaseAdmin } from "@/lib/supabase/server";

export type Role = "admin" | "dispatcher" | "driver";

export type AccessContext = {
  userId: string;
  companyId: string;
  driverId: string | null;
  role: Role;
};

type AccessResult =
  | { context: AccessContext; status?: never; error?: never }
  | { context?: never; status: 401 | 403; error: string };

function isRole(value: unknown): value is Role {
  return value === "admin" || value === "dispatcher" || value === "driver";
}

export async function getAccessContext(): Promise<AccessResult> {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll() {},
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { status: 401, error: "Unauthorized" };

  // NEVER trust a role supplied by the browser or user metadata.
  const { data: profile, error } = await supabaseAdmin()
    .from("profiles")
    .select("company_id, driver_id, role")
    .eq("id", user.id)
    .maybeSingle();

  // Fail closed when no valid role/company is assigned.
  if (error || !profile?.company_id || !isRole(profile.role)) {
    return { status: 403, error: "No valid company profile or role" };
  }

  return {
    context: {
      userId: user.id,
      companyId: profile.company_id,
      driverId: profile.driver_id ?? null,
      role: profile.role,
    },
  };
}

export async function requireRole(allowedRoles: Role[]) {
  const result = await getAccessContext();

  if (!result.context) {
    return { response: NextResponse.json({ error: result.error }, { status: result.status }) } as const;
  }
  if (!allowedRoles.includes(result.context.role)) {
    return { response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) } as const;
  }

  return { context: result.context } as const;
}
