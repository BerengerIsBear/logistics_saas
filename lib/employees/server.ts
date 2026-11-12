import { supabaseAdmin } from "@/lib/supabase/server";
import type { Role } from "@/lib/auth/access";

export async function validateDriverLink(companyId: string, role: Role, driverId: string | null, employeeId?: string, requireActive = true) {
  if (role !== "driver") return driverId === null ? null : "Only Driver accounts may link a driver";
  if (!driverId) return "Select an active driver for Driver accounts";
  const admin = supabaseAdmin();
  const { data: driver, error } = await admin.from("drivers")
    .select("id, is_active").eq("id", driverId).eq("company_id", companyId).maybeSingle();
  if (error) return "Could not verify driver";
  if (!driver) return "Driver not found in your company";
  if (requireActive && !driver.is_active) return "Driver is inactive";

  // The DB also has a unique constraint to block concurrent duplicate links.
  let query = admin.from("profiles")
    .select("id").eq("company_id", companyId).eq("role", "driver").eq("driver_id", driverId);
  if (employeeId) query = query.neq("id", employeeId);
  const { data: existing, error: existingError } = await query.limit(1);
  if (existingError) return "Could not verify driver assignment";
  if (existing?.length) return "Driver is already linked to another employee";
  return null;
}

export function isSameOrigin(req: Request) {
  const origin = req.headers.get("origin");
  return Boolean(origin && origin === new URL(req.url).origin);
}
