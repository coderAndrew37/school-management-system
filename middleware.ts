// middleware.ts — Kibali Academy
//
// THREE-LAYER RBAC (zero extra DB calls — reads JWT app_metadata only):
//
//  Layer 0 — Subdomain → tenant rewrite
//    kibali.yourdomain.com  →  internal /school/kibali/... rewrite
//    Injects X-School-Subdomain header so layouts can read it server-side.
//
//  Layer 1 — Base-role portal gating (unchanged from original)
//    app_metadata.role gates whole portal sections (/admin, /teacher, etc.)
//
//  Layer 2 — Admin sub-route path gating
//    app_metadata.admin_paths (written by sync_user_jwt_claims trigger) lists
//    the URL prefixes this admin role may access.
//    super_admin always has ["/admin"] which covers every sub-route.
//
//  Layer 3 — Domain-action permission gating (NEW)
//    app_metadata.permissions is the resolved token array from the trigger.
//    We map the incoming pathname to the token declared in ROUTE_PERMISSION_MAP.
//    If the token is NOT in the user's permissions array, redirect to
//    /admin/access-denied instead of showing a blank page or 404.
//
// Note: Middleware is intentionally lightweight — it NEVER calls Supabase DB.
//       Permission revocations propagate on the next JWT refresh (≤1 hour) OR
//       immediately for server-action-gated high-security mutations, which do
//       a real-time DB check regardless of JWT state.

import {
  PROTECTED_PREFIXES,
  ROLE_ROUTES,
  ACCESS_DENIED_ROUTE,
  type UserRole,
} from "@/lib/types/auth";
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// ── Route → permission token map ─────────────────────────────────────────────
// Mirrors ADMIN_LINKS permissionRequired values exactly.
// null = no domain-action check (visible to all authenticated admins).
// Longest-prefix wins when resolving.

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
  // Settings and dashboard have no permission requirement
  ["/admin/dashboard",      null],
  ["/admin/settings",       null],
];

// Resolve the required permission token for a pathname using longest-prefix match
function resolveRoutePermission(pathname: string): string | null | undefined {
  let best: [string, string | null] | undefined;
  for (const entry of ROUTE_PERMISSION_MAP) {
    const [prefix] = entry;
    if (pathname === prefix || pathname.startsWith(prefix + "/")) {
      if (!best || prefix.length > best[0].length) best = entry;
    }
  }
  return best ? best[1] : undefined; // undefined = no matching route in manifest
}

// Token matcher — supports wildcard suffix ('finance:*' matches 'finance:fees:read')
function hasTokenInArray(
  permissions: string[],
  required: string
): boolean {
  if (permissions.includes("*")) return true;
  if (permissions.includes(required)) return true;
  return permissions.some((p) => {
    if (!p.endsWith("*")) return false;
    const prefix = p.slice(0, -1); // strip '*'
    return required.startsWith(prefix);
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

// Authenticated users may still access these even though they appear in PUBLIC_ROUTES
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

  // ── Layer 0: Subdomain → tenant rewrite ────────────────────────────────────
  // For production: kibali.yourdomain.com → rewrite to /school/kibali/...
  // For dev/localhost: skip rewrite, rely on ?tenant= param or env default.
  const isLocalhost =
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname.endsWith(".local");

  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "yourdomain.com";

  if (!isLocalhost && hostname.endsWith(`.${rootDomain}`)) {
    const subdomain = hostname.replace(`.${rootDomain}`, "");
    // Skip the root domain itself (no subdomain)
    if (subdomain && subdomain !== "www") {
      // Rewrite internally — user still sees their subdomain URL
      const rewriteUrl = request.nextUrl.clone();
      rewriteUrl.pathname = `/school/${subdomain}${pathname}`;

      response = NextResponse.rewrite(rewriteUrl, {
        request: { headers: request.headers },
      });

      // Inject subdomain into request headers so server layouts can read it
      response.headers.set("X-School-Subdomain", subdomain);
    }
  }

  // Skip static assets and API routes entirely
  if (pathname.startsWith("/api/") || pathname.startsWith("/_next/")) {
    return response;
  }

  // ── Supabase session client (cookie-based, no DB call) ─────────────────────
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

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isPublicRoute = PUBLIC_ROUTES.some((r) => pathname.startsWith(r));

  // ── Layer 1a: Unauthenticated user ─────────────────────────────────────────
  if (!user) {
    if (isPublicRoute) return response;
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    if (pathname !== "/") loginUrl.searchParams.set("redirectTo", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // ── Read JWT claims (zero DB calls) ────────────────────────────────────────
  const meta          = user.app_metadata ?? {};
  const primaryRole   = meta.role       as UserRole   | undefined;
  const userRoles     = (meta.roles     ?? [])         as UserRole[];
  const adminPaths    = (meta.admin_paths ?? [])        as string[];
  const permissions   = (meta.permissions ?? [])        as string[];
  const isSuperAdmin  = (meta.is_super_admin ?? false)  as boolean;
  const isDev         = (meta.is_dev         ?? false)  as boolean;

  // New user — trigger hasn't fired yet; let through, loginAction guards
  if (!primaryRole) return response;

  // ── Root redirect ───────────────────────────────────────────────────────────
  if (pathname === "/") {
    return NextResponse.redirect(
      new URL(ROLE_ROUTES[primaryRole] ?? "/login", request.url)
    );
  }

  // ── Authenticated user on a public route ───────────────────────────────────
  if (isPublicRoute) {
    const isBypass = AUTH_BYPASS_ROUTES.some((p) => pathname.startsWith(p));
    if (!isBypass) {
      return NextResponse.redirect(
        new URL(ROLE_ROUTES[primaryRole] ?? "/login", request.url)
      );
    }
    return response;
  }

  // ── Layer 1b: Base-role portal gating ──────────────────────────────────────
  const matchingPrefix = Object.keys(PROTECTED_PREFIXES)
    .filter((p) => pathname.startsWith(p))
    .sort((a, b) => b.length - a.length)[0];

  if (matchingPrefix) {
    const allowedRoles   = PROTECTED_PREFIXES[matchingPrefix]!;
    const effectiveRoles = Array.from(new Set([primaryRole, ...userRoles]));
    const hasPortalAccess = effectiveRoles.some((r) => allowedRoles.includes(r));

    if (!hasPortalAccess) {
      return NextResponse.redirect(
        new URL(ROLE_ROUTES[primaryRole] ?? "/login", request.url)
      );
    }

    // ── Layer 2: Admin sub-route path gating ─────────────────────────────────
    // Super admins and dev team skip this check entirely
    const isPrivileged = isSuperAdmin || isDev;

    if (
      !isPrivileged &&
      pathname.startsWith("/admin") &&
      primaryRole === "admin" &&
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

    // ── Layer 3: Domain-action permission token gating ────────────────────────
    // Only applies inside /admin/* for non-privileged users
    if (
      !isPrivileged &&
      pathname.startsWith("/admin") &&
      primaryRole === "admin"
    ) {
      const requiredToken = resolveRoutePermission(pathname);

      // requiredToken === undefined → route not in manifest → let layout handle it
      // requiredToken === null      → no permission needed → allow through
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

  // Inject the current pathname into request headers so the server layout can
  // read it for its own route-level guard (avoids re-parsing in the layout)
  response.headers.set("X-Pathname", pathname);

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js)$).*)",
  ],
};