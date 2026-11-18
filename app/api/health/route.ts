import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";

// Public, read-only health check for uptime monitoring.
// Returns no customer data or internal error details.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const headers = { "Cache-Control": "no-store" };

export async function GET() {
  try {
    const { error } = await supabaseAdmin()
      .from("companies")
      .select("id")
      .limit(1);

    if (error) {
      return NextResponse.json({ status: "unhealthy" }, { status: 503, headers });
    }

    return NextResponse.json({ status: "ok" }, { status: 200, headers });
  } catch {
    return NextResponse.json({ status: "unhealthy" }, { status: 503, headers });
  }
}
