// lib/auth/portal-meta.tsx
// Kibali Academy — Shared Portal Metadata
//
// Single source of truth for portal display info, used by:
//   - ChooseRoleForm (post-login portal selection)
//   - PortalSwitcher (navbar dropdown for runtime switching)
//   - /account/switch-portal (dedicated switch page)
//
// Keeping this in one place ensures the "is this role displayable / how many
// portals does this user effectively have" computation can never diverge
// between the login-time chooser and the in-app switcher.

import { GraduationCap, ShieldCheck, BookOpen, Users } from "lucide-react";
import { ROLE_ROUTES, type BaseRole } from "@/lib/types/auth";

export interface PortalMeta {
  label: string;
  description: string;
  icon: React.ReactNode;
  accent: string;
  bg: string;
  basePath: string;
}

// Roles with UI-presentable portals. `student` and `super_admin` intentionally
// omitted: super_admin lands in /admin (covered by `admin`), student portal
// not yet built. Partial<Record<...>> keeps this exhaustiveness-safe.
export const PORTAL_META: Partial<Record<BaseRole, PortalMeta>> = {
  admin: {
    label: "Administrator",
    description: "School management & configurations",
    icon: <ShieldCheck className="h-5 w-5" />,
    accent: "border-amber-200 text-amber-700 hover:border-amber-300",
    bg: "bg-amber-50/60 hover:bg-amber-100/70",
    basePath: "/admin",
  },
  staff: {
    label: "Teacher Portal",
    description: "CBC assessments, classroom logs & timetables",
    icon: <BookOpen className="h-5 w-5" />,
    accent: "border-emerald-200 text-emerald-700 hover:border-emerald-300",
    bg: "bg-emerald-50/60 hover:bg-emerald-100/70",
    basePath: "/teacher",
  },
  parent: {
    label: "Parent / Guardian",
    description: "Child results, diaries & fee statements",
    icon: <Users className="h-5 w-5" />,
    accent: "border-sky-200 text-sky-700 hover:border-sky-300",
    bg: "bg-sky-50/60 hover:bg-sky-100/70",
    basePath: "/parent",
  },
};

// Branding icon shown in chooser/switcher headers.
export const PORTAL_BRAND_ICON = <GraduationCap className="h-5 w-5 text-amber-700" />;

/**
 * Filters a raw roles array down to roles that have a displayable portal.
 * Used as the canonical "effective portal count" before any length checks —
 * both ChooseRoleForm and PortalSwitcher MUST use this, not raw `roles.length`,
 * to avoid super_admin/student inflating counts client-side vs. middleware.
 */
export function getDisplayablePortals(roles: BaseRole[]): BaseRole[] {
  return roles.filter((role) => PORTAL_META[role] !== undefined);
}

/**
 * Resolves the destination path for a given role: prefer the portal's
 * basePath; fall back to ROLE_ROUTES for roles without portal metadata
 * (e.g. super_admin → /admin/dashboard via ROLE_ROUTES).
 */
export function getPortalDestination(role: BaseRole): string {
  return PORTAL_META[role]?.basePath ?? ROLE_ROUTES[role];
}