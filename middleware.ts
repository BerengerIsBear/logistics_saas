import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function middleware(req: NextRequest) {
  const pathname = req.nextUrl.pathname;

  const isAuthPage =
    pathname.startsWith("/login") || pathname.startsWith("/auth/callback");

  const isProtected =
    pathname === "/" ||
    pathname.startsWith("/jobs") ||
    pathname.startsWith("/customers") ||
    pathname.startsWith("/drivers") ||
    pathname.startsWith("/driver-jobs") ||
    pathname.startsWith("/invoices") ||
    pathname.startsWith("/reports") ||
    pathname.startsWith("/settings");

  if (!isProtected || isAuthPage) {
    return NextResponse.next();
  }

  const res = NextResponse.next();

  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return req.cookies.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              res.cookies.set(name, value, options);
            });
          },
        },
      }
    );

    const { data } = await supabase.auth.getUser();

    if (!data.user) {
      const redirectUrl = req.nextUrl.clone();
      redirectUrl.pathname = "/login";
      return NextResponse.redirect(redirectUrl);
    }

    return res;
  } catch {
    const redirectUrl = req.nextUrl.clone();
    redirectUrl.pathname = "/login";
    return NextResponse.redirect(redirectUrl);
  }
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};