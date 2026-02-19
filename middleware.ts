import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { CookieOptions } from "@supabase/ssr";
import type { UserRole } from "@/lib/types/auth";
import { PROTECTED_PREFIXES, ROLE_ROUTES } from "@/lib/types/auth";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Build a response we can attach cookie mutations to
  let response = NextResponse.next({
    request: { headers: request.headers },
  });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  // Create a Supabase client that can read/write cookies on the response
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(
        cookiesToSet: { name: string; value: string; options: CookieOptions }[],
      ) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        response = NextResponse.next({ request: { headers: request.headers } });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  // IMPORTANT: getUser() refreshes the session token if needed (PKCE requirement)
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // ── Public routes — always allow ────────────────────────────────────────
  const publicRoutes = [
    "/login",
    "/forgot-password",
    "/reset-password",
    "/auth/callback",
    "/auth/confirm",
  ];

  const isPublicRoute = publicRoutes.some((r) => pathname.startsWith(r));
  const isApiRoute = pathname.startsWith("/api/");

  // Allow API routes (they do their own auth checks)
  if (isApiRoute) return response;

  // ── Unauthenticated user tries to access protected route ─────────────────
  if (!user && !isPublicRoute) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/login";
    redirectUrl.searchParams.set("redirectTo", pathname);
    return NextResponse.redirect(redirectUrl);
  }

  // ── Authenticated user hits a public auth page ───────────────────────────
  if (
    user &&
    isPublicRoute &&
    pathname !== "/auth/callback" &&
    pathname !== "/auth/confirm"
  ) {
    // Fetch role to redirect to the right dashboard
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    const role = (profile?.role ?? "parent") as UserRole;
    return NextResponse.redirect(new URL(ROLE_ROUTES[role], request.url));
  }

  // ── Role-based access control ────────────────────────────────────────────
  if (user && !isPublicRoute) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    const role = (profile?.role ?? "parent") as UserRole;

    // Find which protected prefix this route falls under
    for (const [prefix, allowedRoles] of Object.entries(PROTECTED_PREFIXES)) {
      if (pathname.startsWith(prefix)) {
        if (!allowedRoles.includes(role)) {
          // Redirect to the user's correct dashboard
          return NextResponse.redirect(new URL(ROLE_ROUTES[role], request.url));
        }
        break;
      }
    }
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths EXCEPT:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico
     * - public folder assets
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js)$).*)",
  ],
};
