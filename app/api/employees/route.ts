import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/access";
import { supabaseAdmin } from "@/lib/supabase/server";
import { parseDriverId, parseEmail, parseRole } from "@/lib/employees/validation";
import { isSameOrigin, validateDriverLink } from "@/lib/employees/server";

export async function GET() {
  const auth = await requireRole(["admin"]);
  if ("response" in auth) return auth.response;

  const { data, error } = await supabaseAdmin().from("profiles")
    .select("id, email, role, driver_id, is_active, created_at")
    .eq("company_id", auth.context.companyId)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: "Could not load employees" }, { status: 500 });
  return NextResponse.json({ employees: data ?? [] });
}

export async function POST(req: Request) {
  const auth = await requireRole(["admin"]);
  if ("response" in auth) return auth.response;
  if (!isSameOrigin(req)) return NextResponse.json({ error: "Invalid request origin" }, { status: 403 });

  const body = await req.json().catch(() => null);
  const email = parseEmail(body?.email);
  const role = parseRole(body?.role);
  const driverId = parseDriverId(body?.driver_id ?? null);
  if (!email || !role || driverId === undefined) {
    return NextResponse.json({ error: "Valid email, role and driver selection are required" }, { status: 400 });
  }
  const linkError = await validateDriverLink(auth.context.companyId, role, driverId);
  if (linkError) return NextResponse.json({ error: linkError }, { status: 400 });

  // Do not trust the request Host header or a browser-provided redirect URL.
  // Set APP_URL in production, e.g. https://logistics.example.com.
  const baseUrl = process.env.APP_URL || (process.env.NODE_ENV !== "production" ? "http://localhost:3000" : "");
  if (!baseUrl || !/^https?:\/\//.test(baseUrl)) {
    return NextResponse.json({ error: "Set APP_URL to your application URL before sending invitations" }, { status: 500 });
  }
  const admin = supabaseAdmin();
  const { data: invite, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${baseUrl.replace(/\/$/, "")}/accept-invite`,
  });
  if (inviteError || !invite.user) {
    return NextResponse.json({ error: inviteError?.message || "Could not send invitation" }, { status: 400 });
  }

  // Do not hijack an existing profile from another tenant.
  const { data: existing, error: existingError } = await admin.from("profiles")
    .select("company_id").eq("id", invite.user.id).maybeSingle();
  if (existingError) {
    return NextResponse.json({ error: "Invitation sent but employee profile could not be verified. Contact administrator." }, { status: 500 });
  }
  if (existing?.company_id) {
    return NextResponse.json({ error: "Invitation sent but this account already belongs to a company. Contact administrator." }, { status: 409 });
  }

  const profile = {
    company_id: auth.context.companyId,
    email,
    role,
    driver_id: role === "driver" ? driverId : null,
    is_active: true,
  };
  const result = existing
    ? await admin.from("profiles").update(profile).eq("id", invite.user.id).is("company_id", null).select("id").maybeSingle()
    : await admin.from("profiles").insert({ id: invite.user.id, ...profile }).select("id").maybeSingle();

  if (result.error || !result.data) {
    return NextResponse.json({
      error: "Invitation was sent, but assigning company access failed. The account cannot use the app until a profile is assigned. Contact administrator.",
    }, { status: 500 });
  }

  return NextResponse.json({ employee: { id: invite.user.id, email, role } }, { status: 201 });
}
