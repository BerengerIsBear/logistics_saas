// app/api/me/company/route.ts
import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/access";

export async function GET() {
  const auth = await requireRole(["admin", "dispatcher", "driver"]);
  if ("response" in auth) return auth.response;

  return NextResponse.json({
    companyId: auth.context.companyId,
    role: auth.context.role,
  });
}
