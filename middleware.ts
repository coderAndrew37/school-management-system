// middleware.ts — Kibali Academy
//
// THREE-LAYER RBAC (zero extra DB calls — reads JWT app_metadata only):
//
//  Layer 0 — Subdomain → tenant rewrite
//    kibali.yourdomain.com → internal /school/kibali/... rewrite
//
//  Layer 1 — Base-role portal gating
//    app_metadata.role gates whole portal sections (/admin, /teacher, etc.)
//    Roles: super_admin | admin | staff | parent | student
//
//  Layer 2 — Admin sub-route path gating
//    app_metadata.admin_paths lists URL prefixes this admin role may access.
//    super_admin always has ["/admin"] — covers every sub-route.
//    Skipped entirely for super_admin and is_dev.
//
//  Layer 3 — Domain-action permission token gating
//    app_metadata.permissions is the resolved token array.
//    Maps pathname → required token via ROUTE_PERMISSION_MAP.
//    Skipped entirely for super_admin and is_dev.

import {
  PROTECTED_PREFIXES,
  ROLE_ROUTES,
  ACCESS_DENIED_ROUTE,
  type UserRole,
} from "@/lib/types/auth";
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// ── Route → permission token map ─────────────────────────────────────────────

const ROUTE_PERMISSION_MAP: [string, string | null][] = [
  ["/admin/security",       "security:roles:manage"],
  ["/admin/fees",           "finance:fees:read"],
  ["/admin/payments",       "finance:payments:read"],
  ["/admin/analytics",      "academics:analytics:read"],
  ["/admin/heatmap",        "academics:heatmap:read"],
  ["/admin/classes",        "academics:classes:read"],
  ["/admin/assessments",    "academics:assessments:read"],
  ["/admin/exams/grade-3",  "knec:exports:write"],
  ["/admin/exams/grade-6",  "knec:exports:write"],
  ["/admin/exams/grade-9",  "knec:exports:write"],
  ["/admin/csl",            "knec:exports:read"],
  ["/admin/students",       "people:students:read"],
  ["/admin/admission",      "people:students:write"],
  ["/admin/bulk-admit",     "people:students:write"],
  ["/admin/applications",   "people:students:read"],
  ["/admin/teachers",       "people:teachers:read"],
  ["/admin/class-teachers", "people:teachers:read"],
  ["/admin/allocation",     "people:teachers:write"],
  ["/admin/parents",        "people:parents:read"],
  ["/admin/invites",        "people:parents:write"],
  ["/admin/transfers",      "people:students:write"],
  ["/admin/communications", "comms:messages:read"],
  ["/admin/events",         "comms:events:read"],
  ["/admin/announcements",  "comms:announcements:read"],
  ["/admin/notifications",  "comms:notifications:read"],
  ["/admin/health",         "system:health:read"],
  ["/admin/library",        "system:library:read"],
  ["/admin/dashboard",      null],
  ["/admin/settings",       null],
  ["/admin/access-denied",  null],
];

function resolveRoutePermission(pathname: string): string | null | undefined {
  let best: [string, string | null] | undefined;
  for (const entry of ROUTE_PERMISSION_MAP) {
    const [prefix] = entry;
    if (pathname === prefix || pathname.startsWith(prefix + "/")) {
      if (!best || prefix.length > best[0].length) best = entry;
    }
  }
  return best ? best[1] : undefined;
}

function hasTokenInArray(permissions: string[], required: string): boolean {
  if (permissions.includes("*"))      return true;
  if (permissions.includes(required)) return true;
  return permissions.some((p) => {
    if (!p.endsWith("*")) return false;
    return required.startsWith(p.slice(0, -1));
  });
}

// ── Route classifications ─────────────────────────────────────────────────────

const PUBLIC_ROUTES = [
  "/login",
  "/auth/forgot-password",
  "/auth/reset-password",
  "/auth/callback",
  "/auth/confirm",
];

const AUTH_BYPASS_ROUTES = [
  "/auth/confirm",
  "/auth/reset-password",
  "/auth/forgot-password",
  "/auth/choose-role",
];

// ── Middleware ────────────────────────────────────────────────────────────────

export async function middleware(request: NextRequest) {
  const { pathname, hostname } = request.nextUrl;
  let response = NextResponse.next({ request: { headers: request.headers } });

  // ── Layer 0: Subdomain → tenant rewrite ──────────────────────────────────
  const isLocalhost =
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname.endsWith(".local");

  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "yourdomain.com";

  if (!isLocalhost && hostname.endsWith(`.${rootDomain}`)) {
    const subdomain = hostname.replace(`.${rootDomain}`, "");
    if (subdomain && subdomain !== "www") {
      const rewriteUrl = request.nextUrl.clone();
      rewriteUrl.pathname = `/school/${subdomain}${pathname}`;
      response = NextResponse.rewrite(rewriteUrl, {
        request: { headers: request.headers },
      });
      response.headers.set("X-School-Subdomain", subdomain);
    }
  }

  // Skip static assets and API routes
  if (pathname.startsWith("/api/") || pathname.startsWith("/_next/")) {
    return response;
  }

  // ── Supabase session (cookie-based, no DB call) ───────────────────────────
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request: { headers: request.headers } });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  const isPublicRoute = PUBLIC_ROUTES.some((r) => pathname.startsWith(r));

  // ── Unauthenticated ───────────────────────────────────────────────────────
  if (!user) {
    if (isPublicRoute) return response;
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    if (pathname !== "/") loginUrl.searchParams.set("redirectTo", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // ── Read JWT claims ───────────────────────────────────────────────────────
  const meta         = user.app_metadata ?? {};
  const primaryRole  = meta.role          as UserRole | undefined;
  const userRoles    = (meta.roles ?? []) as UserRole[];
  const adminPaths   = (meta.admin_paths  ?? []) as string[];
  const permissions  = (meta.permissions  ?? []) as string[];
  const isSuperAdmin = (meta.is_super_admin ?? false) as boolean;
  const isDev        = (meta.is_dev         ?? false) as boolean;

  // Privileged users bypass Layers 2 and 3 entirely
  const isPrivileged = isSuperAdmin || isDev;

  // New user — JWT not synced yet, let through
  if (!primaryRole) return response;

  // ── Root redirect ─────────────────────────────────────────────────────────
  if (pathname === "/") {
    return NextResponse.redirect(
      new URL(ROLE_ROUTES[primaryRole] ?? "/login", request.url)
    );
  }

  // ── Authenticated user on a public route ──────────────────────────────────
  if (isPublicRoute) {
    const isBypass = AUTH_BYPASS_ROUTES.some((p) => pathname.startsWith(p));
    if (!isBypass) {
      return NextResponse.redirect(
        new URL(ROLE_ROUTES[primaryRole] ?? "/login", request.url)
      );
    }
    return response;
  }

  // ── Layer 1: Base-role portal gating ─────────────────────────────────────
  const matchingPrefix = Object.keys(PROTECTED_PREFIXES)
    .filter((p) => pathname.startsWith(p))
    .sort((a, b) => b.length - a.length)[0];

  if (matchingPrefix) {
    const allowedRoles    = PROTECTED_PREFIXES[matchingPrefix]!;
    const effectiveRoles  = Array.from(new Set([primaryRole, ...userRoles]));
    const hasPortalAccess = effectiveRoles.some((r) => allowedRoles.includes(r));

    if (!hasPortalAccess) {
      return NextResponse.redirect(
        new URL(ROLE_ROUTES[primaryRole] ?? "/login", request.url)
      );
    }

    // ── Layer 2: Admin sub-route path gating ─────────────────────────────
    // Only for non-privileged admin/super_admin users on /admin routes
    const isAdminPortal = pathname.startsWith("/admin");
    const isAdminRole   = primaryRole === "admin" || primaryRole === "super_admin";

    if (
      !isPrivileged &&
      isAdminPortal &&
      isAdminRole &&
      adminPaths.length > 0 &&
      pathname !== "/admin/dashboard" &&
      pathname !== "/admin"
    ) {
      const hasPathAccess = adminPaths.some((p) => pathname.startsWith(p));
      if (!hasPathAccess) {
        return NextResponse.redirect(
          new URL("/admin/dashboard", request.url)
        );
      }
    }

    // ── Layer 3: Domain-action permission token gating ────────────────────
    // Only for non-privileged users on /admin routes
    if (!isPrivileged && isAdminPortal && isAdminRole) {
      const requiredToken = resolveRoutePermission(pathname);

      if (requiredToken !== undefined && requiredToken !== null) {
        const hasPermission = hasTokenInArray(permissions, requiredToken);
        if (!hasPermission) {
          return NextResponse.redirect(
            new URL(ACCESS_DENIED_ROUTE, request.url)
          );
        }
      }
    }
  }

  response.headers.set("X-Pathname", pathname);
  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js)$).*)",
  ],
};