// app/(admin)/layout.tsx
// Kibali Academy — Admin Route Group Layout (Server Component)
//
// This layout executes on every navigation to any /admin/* route.
// It performs two layers of authorization:
//
//   Layer 1 — Base role check:
//     Verifies the session exists and the user has the "admin" base_role.
//     Redirects to /login if unauthenticated or /access-denied if wrong portal.
//
//   Layer 2 — Path-level domain-action check:
//     Reads the current URL path from Next.js headers, maps it to the
//     NavLink manifest's permissionRequired token, and evaluates it against
//     the live database profile (not cached JWT). If denied, redirects to
//     /admin/access-denied instead of silently rendering a blank page.
//
// Because this is a Server Component reading directly from Supabase on every
// render, permission revocations by the Super Admin are reflected instantly
// on the very next request — no stale client-side cache.

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getSession } from "@/lib/actions/auth";
import { ADMIN_LINKS, getAuthorizedLinks } from "@/lib/constants";
import { hasPermission } from "@/lib/actions/auth-utils";
import { ACCESS_DENIED_ROUTE } from "@/lib/types/auth";
import { AdminLayoutShell } from "@/app/_components/nav/AdminLayoutShell";

// ── Route-to-permission map ───────────────────────────────────────────────────
// Built once from the ADMIN_LINKS manifest so the layout and sidebar
// use the exact same source of truth for token requirements.

const ROUTE_PERMISSION_MAP: Map<string, string | null> = new Map(
  ADMIN_LINKS.map((link) => [link.href, link.permissionRequired])
);

/**
 * Resolves the NavLink entry that most specifically covers the current pathname.
 * Uses longest-prefix matching so /admin/exams/grade-3 matches correctly.
 */
function resolveRequiredPermission(pathname: string): string | null | undefined {
  let bestMatch: string | undefined;
  let bestLength = 0;

  for (const [route] of ROUTE_PERMISSION_MAP) {
    if (pathname === route || pathname.startsWith(route + "/")) {
      if (route.length > bestLength) {
        bestMatch = route;
        bestLength = route.length;
      }
    }
  }

  // undefined means no matching route was found in the manifest
  if (!bestMatch) return undefined;

  // null means the matched link has no permission requirement
  return ROUTE_PERMISSION_MAP.get(bestMatch);
}

// ── Layout ────────────────────────────────────────────────────────────────────

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // ── Resolve live session & profile ─────────────────────────────────────────
  // getSession() hits Supabase on every render — no stale JWT-only checks.
  // This ensures permission revocations are reflected immediately.
  const session = await getSession();

  // ── Layer 1: Authentication & base-role guard ───────────────────────────────
  if (!session) {
    redirect("/login");
  }

  if (session.primaryRole !== "admin" && !session.profile.is_dev) {
    // Wrong portal — send to their correct landing page
    const destination = {
      teacher: "/teacher/dashboard",
      parent: "/parent/dashboard",
      support: "/support/dashboard",
    }[session.primaryRole];

    redirect(destination ?? "/login");
  }

  // ── Layer 2: Path-level domain-action guard ─────────────────────────────────
  // Read the current request pathname from Next.js request headers.
  const headersList = await headers();
  const currentPath =
    headersList.get("x-pathname") ??
    headersList.get("x-invoke-path") ??
    "/admin/dashboard";

  const requiredPermission = resolveRequiredPermission(currentPath);

  if (requiredPermission !== undefined && requiredPermission !== null) {
    // A specific permission is required for this route
    const canAccess = hasPermission(session.profile, requiredPermission);

    if (!canAccess) {
      // Redirect to the access-denied screen instead of an empty page flash
      redirect(ACCESS_DENIED_ROUTE);
    }
  }

  // ── Compute effective permissions for shell UI ──────────────────────────────
  // Build the authorized links list once here so both the layout guard and the
  // sidebar share the same resolved set without a second DB round-trip.
  const authorizedLinks = getAuthorizedLinks(session.profile);

  return (
    <AdminLayoutShell
      profile={session.profile}
      email={session.user.email ?? ""}
      authorizedLinks={authorizedLinks}
    >
      {children}
    </AdminLayoutShell>
  );
}