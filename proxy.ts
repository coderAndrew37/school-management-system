// @/middleware.ts  (drop-in replacement for your proxy)
//
// Two-layer RBAC — zero DB calls per request:
//
//  Layer 1 — base_role (app_metadata.role)
//    Gates whole portal sections: /admin, /teacher, /parent, /support
//    Identical to your existing logic — nothing removed.
//
//  Layer 2 — admin_role sub-route gating (NEW)
//    app_metadata.admin_paths is written by the Postgres trigger
//    trg_sync_profile_role_to_app_metadata whenever base_role/admin_role changes.
//    It contains the allowed_paths array from admin_role_definitions.
//    A bursar gets ["/admin/fees","/admin/finance",...] — anything else
//    redirects them to /admin/dashboard rather than showing a 404 or error.
//    super_admin always has ["/admin"] which matches every sub-route.

import {
  PROTECTED_PREFIXES,
  ROLE_ROUTES,
  type UserRole,
} from "@/lib/types/auth";
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

  const authenticatedBypass = [
    "/auth/confirm",
    "/auth/reset-password",
    "/auth/forgot-password",
    "/auth/choose-role",
  ];

  const isPublicRoute = publicRoutes.some((r) => pathname.startsWith(r));
  if (pathname.startsWith("/api/")) return response;

  // ── 1. Unauthenticated ──────────────────────────────────────
  if (!user) {
    if (isPublicRoute) return response;
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/login";
    if (pathname !== "/") redirectUrl.searchParams.set("redirectTo", pathname);
    return NextResponse.redirect(redirectUrl);
  }

  // ── 2. Read from app_metadata (zero DB calls) ───────────────
  const primaryRole = user.app_metadata?.role         as UserRole | undefined;
  const userRoles   = (user.app_metadata?.roles ?? []) as UserRole[];
  const adminRole   = user.app_metadata?.admin_role   as string   | undefined;
  // Written by trg_sync_profile_role_to_app_metadata:
  //   super_admin  → ["/admin"]
  //   bursar       → ["/admin/dashboard","/admin/fees","/admin/finance",...]
  //   librarian    → ["/admin/dashboard","/admin/library"]
  //   etc.
  const adminPaths  = (user.app_metadata?.admin_paths ?? []) as string[];

  // New user — trigger hasn't fired yet. Let through; loginAction guards.
  if (!primaryRole) return response;

  // ── 3. Root redirect ────────────────────────────────────────
  if (pathname === "/") {
    return NextResponse.redirect(new URL(ROLE_ROUTES[primaryRole], request.url));
  }

  // ── 4. Authenticated on a public/bypass route ───────────────
  if (isPublicRoute) {
    const isBypass = authenticatedBypass.some((p) => pathname.startsWith(p));
    if (!isBypass) {
      return NextResponse.redirect(new URL(ROLE_ROUTES[primaryRole], request.url));
    }
    return response;
  }

  // ── 5. Layer 1: base_role portal gating ────────────────────
  // Unchanged from your original proxy.
  const matchingPrefix = Object.keys(PROTECTED_PREFIXES)
    .filter((p) => pathname.startsWith(p))
    .sort((a, b) => b.length - a.length)[0];

  if (matchingPrefix) {
    const allowedRoles   = PROTECTED_PREFIXES[matchingPrefix];
    const effectiveRoles = Array.from(new Set([primaryRole, ...userRoles]));
    const hasAccess      = effectiveRoles.some((r) => allowedRoles.includes(r));

    if (!hasAccess) {
      return NextResponse.redirect(new URL(ROLE_ROUTES[primaryRole], request.url));
    }

    // ── 6. Layer 2: admin sub-route gating (NEW) ─────────────
    //
    // Only applies when:
    //   - We're inside /admin/*
    //   - The user is an admin (primaryRole === "admin")
    //   - app_metadata.admin_paths has been populated by the trigger
    //
    // We skip this check entirely for /admin/dashboard so no
    // admin is ever hard-locked to a blank screen.
    if (
      pathname.startsWith("/admin") &&
      primaryRole === "admin" &&
      adminPaths.length > 0 &&
      pathname !== "/admin/dashboard" &&
      pathname !== "/admin"
    ) {
      const hasSubAccess = adminPaths.some((p) => pathname.startsWith(p));
      if (!hasSubAccess) {
        return NextResponse.redirect(new URL("/admin/dashboard", request.url));
      }
    }
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webop|ico|css|js)$).*)",
  ],
};