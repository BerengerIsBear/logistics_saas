// middleware.ts

import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function middleware(req: NextRequest) {
  const pathname = req.nextUrl.pathname;

  const isAuthPage =
    pathname.startsWith("/login") || pathname.startsWith("/auth/callback");

  // Page protection is also enforced by the server layouts and API role checks.
  const protectedPages = [
    "/jobs", "/customers", "/drivers", "/vehicles", "/driver-jobs",
    "/employees", "/workflows", "/workflow-escalations",
    "/driver-performance", "/sla-performance", "/operational-risk",
    "/profit-risk", "/customer-profitability", "/reports", "/settings", "/invoices",
  ];
  const isProtected = protectedPages.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`)
  );

  // Our API is used by our own browser pages, not third-party sites.
  // Block cross-site form/fetch requests that could use a logged-in cookie.
  if (pathname.startsWith("/api/") && !["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    const origin = req.headers.get("origin");
    const allowed = new Set([req.nextUrl.origin]);
    if (process.env.APP_URL) {
      try { allowed.add(new URL(process.env.APP_URL).origin); } catch { /* invalid APP_URL */ }
    }
    if (!origin || !allowed.has(origin)) {
      return NextResponse.json({ error: "Invalid request origin" }, { status: 403 });
    }
  }

  let res = NextResponse.next({
    request: req,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => {
            req.cookies.set(name, value);
          });

          res = NextResponse.next({
            request: req,
          });

          cookiesToSet.forEach(({ name, value, options }) => {
            res.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && isProtected) {
    const redirectUrl = req.nextUrl.clone();
    redirectUrl.pathname = "/login";
    redirectUrl.searchParams.set("redirectedFrom", pathname);

    return NextResponse.redirect(redirectUrl);
  }

  if (user && pathname === "/login") {
    const redirectUrl = req.nextUrl.clone();
    redirectUrl.pathname = "/jobs";

    return NextResponse.redirect(redirectUrl);
  }

  if (isAuthPage || isProtected) {
    return res;
  }

  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};