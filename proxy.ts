import { PROTECTED_PREFIXES, ROLE_ROUTES } from "@/lib/types/auth";
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Initial response object to manage cookie syncing
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

  // 1. Get authenticated user and metadata (Role is now inside app_metadata)
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

  const isPublicRoute = publicRoutes.some((r) => pathname.startsWith(r));
  if (pathname.startsWith("/api/")) return response;

  // 2. Unauthenticated handling
  if (!user) {
    if (isPublicRoute) return response;
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/login";
    if (pathname !== "/") redirectUrl.searchParams.set("redirectTo", pathname);
    return NextResponse.redirect(redirectUrl);
  }

  // 3. Extract Role from Metadata (Zero DB Calls)
  // We assume the SQL trigger has populated 'role' and 'roles'
  const primaryRole = user.app_metadata?.role as keyof typeof ROLE_ROUTES;
  const userRoles = (user.app_metadata?.roles || []) as string[];

  // If role is missing from metadata, the user might need to re-log
  // or the trigger hasn't fired yet. Fallback to response to avoid loops.
  if (!primaryRole) return response;

  // 4. Handle "/" root redirect
  if (pathname === "/") {
    return NextResponse.redirect(
      new URL(ROLE_ROUTES[primaryRole], request.url),
    );
  }

  // 5. Authenticated user hitting public pages (e.g., trying to go to /login)
  if (isPublicRoute) {
    const bypass = [
      "/auth/confirm",
      "/auth/reset-password",
      "/auth/forgot-password",
        "/auth/choose-role",
    ].some((p) => pathname.startsWith(p));

    if (!bypass) {
      return NextResponse.redirect(
        new URL(ROLE_ROUTES[primaryRole], request.url),
      );
    }
    return response;
  }

  // 6. Role-based Access Control (RBAC)
  const matchingPrefixes = Object.keys(PROTECTED_PREFIXES)
    .filter((p) => pathname.startsWith(p))
    .sort((a, b) => b.length - a.length);

  if (matchingPrefixes.length > 0) {
    const targetPrefix = matchingPrefixes[0];
    const allowedRoles =
      PROTECTED_PREFIXES[targetPrefix as keyof typeof PROTECTED_PREFIXES];

    // Check if user has any of the required roles
    const hasAccess =
      userRoles.some((r) => allowedRoles.includes(r as any)) ||
      allowedRoles.includes(primaryRole as any);

    if (!hasAccess) {
      return NextResponse.redirect(
        new URL(ROLE_ROUTES[primaryRole], request.url),
      );
    }
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js)$).*)",
  ],
};
