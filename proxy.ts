import { PROTECTED_PREFIXES, ROLE_ROUTES, type UserRole } from "@/lib/types/auth";
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  let response = NextResponse.next({
    request: { headers: request.headers },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({
            request: { headers: request.headers },
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const publicRoutes = [
    "/login",
    "/auth/forgot-password",
    "/auth/reset-password",
    "/auth/callback",
    "/auth/confirm",
  ];

  // Auth pages that stay accessible even when logged in
  const authenticatedBypass = [
    "/auth/confirm",
    "/auth/reset-password",
    "/auth/forgot-password",
    "/auth/choose-role",
  ];

  const isPublicRoute = publicRoutes.some((r) => pathname.startsWith(r));
  if (pathname.startsWith("/api/")) return response;

  // 1. Unauthenticated
  if (!user) {
    if (isPublicRoute) return response;
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/login";
    if (pathname !== "/") redirectUrl.searchParams.set("redirectTo", pathname);
    return NextResponse.redirect(redirectUrl);
  }

  // 2. Extract roles from app_metadata (zero DB calls)
  const primaryRole = user.app_metadata?.role as UserRole | undefined;
  const userRoles = (user.app_metadata?.roles ?? []) as UserRole[];

  // Trigger hasn't fired yet or metadata is stale — let the request through
  // rather than looping. The DB-level check in loginAction is the real guard.
  if (!primaryRole) return response;

  // 3. Root redirect
  if (pathname === "/") {
    return NextResponse.redirect(new URL(ROLE_ROUTES[primaryRole], request.url));
  }

  // 4. Authenticated user on a public route
  if (isPublicRoute) {
    const isBypass = authenticatedBypass.some((p) => pathname.startsWith(p));
    if (!isBypass) {
      return NextResponse.redirect(new URL(ROLE_ROUTES[primaryRole], request.url));
    }
    return response;
  }

  // 5. RBAC — find the longest matching protected prefix
  const matchingPrefix = Object.keys(PROTECTED_PREFIXES)
    .filter((p) => pathname.startsWith(p))
    .sort((a, b) => b.length - a.length)[0];

  if (matchingPrefix) {
    const allowedRoles = PROTECTED_PREFIXES[matchingPrefix];

    // Merge primary + all roles for the access check
    const effectiveRoles = Array.from(new Set([primaryRole, ...userRoles]));
    const hasAccess = effectiveRoles.some((r) => allowedRoles.includes(r));

    if (!hasAccess) {
      return NextResponse.redirect(new URL(ROLE_ROUTES[primaryRole], request.url));
    }
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js)$).*)",
  ],
};