import { PROTECTED_PREFIXES, ROLE_ROUTES } from "@/lib/types/auth";
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
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
    "/auth/forgot-password",
    "/auth/reset-password",
    "/auth/callback",
    "/auth/confirm",
  ];

  const isPublicRoute = publicRoutes.some((r) => pathname.startsWith(r));
  const isApiRoute = pathname.startsWith("/api/");

  if (isApiRoute) return response;

  // ── Root "/" → redirect to dashboard based on role ────────────────────────
  // On the management system subdomain, "/" is not a landing page.
  // Unauthenticated users hitting "/" go to login; authenticated go to their
  // role dashboard.
  if (pathname === "/") {
    if (!user) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    const profile = await fetchProfile(supabase, user.id);
    const primaryRole = resolvePrimaryRole(profile);
    return NextResponse.redirect(
      new URL(ROLE_ROUTES[primaryRole], request.url),
    );
  }

  // ── Unauthenticated → redirect to login ───────────────────────────────────
  if (!user && !isPublicRoute) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/login";
    redirectUrl.searchParams.set("redirectTo", pathname);
    return NextResponse.redirect(redirectUrl);
  }

  // ── Authenticated user hits a public/auth page → send to their dashboard ──
  //
  // EXCEPTIONS — keep authenticated users on these pages:
  //   /auth/confirm         — must stay to call setSession() with the token
  //   /auth/reset-password  — parent is authenticated mid-onboarding, must
  //                           complete password setup before going to portal
  //   /auth/forgot-password — any authenticated user can reset their password
  if (user && isPublicRoute) {
    const bypassRedirect =
      pathname.startsWith("/auth/confirm") ||
      pathname.startsWith("/auth/reset-password") ||
      pathname.startsWith("/auth/forgot-password");

    if (!bypassRedirect) {
      const profile = await fetchProfile(supabase, user.id);
      const primaryRole = resolvePrimaryRole(profile);
      return NextResponse.redirect(
        new URL(ROLE_ROUTES[primaryRole], request.url),
      );
    }
  }

  // ── Role-based access control ─────────────────────────────────────────────
  if (user && !isPublicRoute) {
    const profile = await fetchProfile(supabase, user.id);
    const userRoles = resolveAllRoles(profile);

    const matchingPrefixes = Object.keys(PROTECTED_PREFIXES)
      .filter((prefix) => pathname.startsWith(prefix))
      .sort((a, b) => b.length - a.length); // longest match wins

    if (matchingPrefixes.length > 0) {
      const allowedRoles = PROTECTED_PREFIXES[matchingPrefixes[0]!]!;
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

async function fetchProfile(supabase: any, userId: string) {
  const { data } = await supabase
    .from("profiles")
    .select("role, roles")
    .eq("id", userId)
    .single();
  return data ?? null;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js)$).*)",
  ],
};
