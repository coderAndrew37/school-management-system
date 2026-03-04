import { PROTECTED_PREFIXES, ROLE_ROUTES } from "@/lib/types/auth";
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
// 1. Import the shared helpers
import { resolveAllRoles, resolvePrimaryRole } from "@/lib/actions/auth-utils";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  let response = NextResponse.next({
    request: { headers: request.headers },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
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

  // ── Route classification ──────────────────────────────────────────────────
  const publicRoutes = [
    "/login",
    "/forgot-password",
    "/reset-password",
    "/auth/callback",
    "/auth/confirm",
  ];
  const isPublicRoute = publicRoutes.some((r) => pathname.startsWith(r));
  const isApiRoute = pathname.startsWith("/api/");

  if (isApiRoute) return response;

  // ── Unauthenticated → redirect to login ───────────────────────────────────
  if (!user && !isPublicRoute) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/login";
    redirectUrl.searchParams.set("redirectTo", pathname);
    return NextResponse.redirect(redirectUrl);
  }

  // ── Authenticated user hits a public auth page → send to their dashboard ──
  if (
    user &&
    isPublicRoute &&
    pathname !== "/auth/callback" &&
    pathname !== "/auth/confirm"
  ) {
    const profile = await fetchProfile(supabase, user.id);
    const primaryRole = resolvePrimaryRole(profile);
    return NextResponse.redirect(
      new URL(ROLE_ROUTES[primaryRole], request.url),
    );
  }

  // ── Role-based access control ─────────────────────────────────────────────
  if (user && !isPublicRoute) {
    const profile = await fetchProfile(supabase, user.id);
    const userRoles = resolveAllRoles(profile);

    const matchingPrefixes = Object.keys(PROTECTED_PREFIXES)
      .filter((prefix) => pathname.startsWith(prefix))
      .sort((a, b) => b.length - a.length);

    if (matchingPrefixes.length > 0) {
      const allowedRoles = PROTECTED_PREFIXES[matchingPrefixes[0]];
      const hasAccess = userRoles.some((r) => allowedRoles.includes(r));

      if (!hasAccess) {
        const primaryRole = resolvePrimaryRole(profile);
        return NextResponse.redirect(
          new URL(ROLE_ROUTES[primaryRole], request.url),
        );
      }
    }
  }

  return response;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function fetchProfile(supabase: any, userId: string) {
  const { data } = await supabase
    .from("profiles")
    .select("role, roles")
    .eq("id", userId)
    .single();
  return data ?? null;
}

// 2. REMOVED: resolveAllRoles and resolvePrimaryRole were deleted from here

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js)$).*)",
  ],
};
