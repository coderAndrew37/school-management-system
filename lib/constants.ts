// lib/constants.ts
// Kibali Academy — Navigation Manifest
//
// Every NavLink carries a `permissionRequired` domain-action token.
// The AdminSidebar server component filters this array through hasPermission()
// before passing it to the client shell — unauthorized links never reach the DOM.
//
// Token format: domain:subdomain:action  (e.g. "finance:fees:read")
// A null permissionRequired means the link is always visible to any authenticated admin.

import {
  LayoutDashboard,
  Users,
  GraduationCap,
  BookUser,
  BarChart3,
  PlusCircle,
  Upload,
  MailCheck,
  Wallet,
  Megaphone,
  CalendarDays,
  Bell,
  Settings,
  ClipboardList,
  FileSpreadsheet,
  ArrowLeftRight,
  BookOpen,
  ShieldCheck,
  Activity,
  DollarSign,
  FlaskConical,
  Layers,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

// ── NavLink Interface ─────────────────────────────────────────────────────────

export interface NavLink {
  label: string;
  href: string;
  icon: LucideIcon;
  group?: string;
  /**
   * Domain-action token required to render this link.
   * Uses the same evaluation pipeline as hasPermission():
   *   - null → always visible to any authenticated admin portal user
   *   - "*"  → visible only to super admins (wildcard bypass)
   *   - "finance:fees:read" → exact or wildcard token match required
   */
  permissionRequired: string | null;
}

// ── Navigation Manifest ───────────────────────────────────────────────────────

export const ADMIN_LINKS: NavLink[] = [

  // ── Overview ───────────────────────────────────────────────────────────────
  // Dashboard is always visible — every admin portal user can see it.
  {
    label: "Dashboard",
    href: "/admin/dashboard",
    icon: LayoutDashboard,
    group: "Overview",
    permissionRequired: null,
  },

  // ── People ────────────────────────────────────────────────────────────────
  {
    label: "Students",
    href: "/admin/students",
    icon: Users,
    group: "People",
    permissionRequired: "people:students:read",
  },
  {
    label: "Admit Student",
    href: "/admin/admission",
    icon: PlusCircle,
    group: "People",
    permissionRequired: "people:students:write",
  },
  {
    label: "Bulk Admission",
    href: "/admin/bulk-admit",
    icon: Upload,
    group: "People",
    permissionRequired: "people:students:write",
  },
  {
    label: "Applications",
    href: "/admin/applications",
    icon: ClipboardList,
    group: "People",
    permissionRequired: "people:students:read",
  },
  {
    label: "Teachers",
    href: "/admin/teachers",
    icon: BookUser,
    group: "People",
    permissionRequired: "people:teachers:read",
  },
  {
    label: "Class Teachers",
    href: "/admin/class-teachers",
    icon: GraduationCap,
    group: "People",
    permissionRequired: "people:teachers:read",
  },
  {
    label: "Subject Allocations",
    href: "/admin/allocation",
    icon: Layers,
    group: "People",
    permissionRequired: "people:teachers:write",
  },
  {
    label: "Parents",
    href: "/admin/parents",
    icon: Users,
    group: "People",
    permissionRequired: "people:parents:read",
  },
  {
    label: "Parent Invites",
    href: "/admin/invites",
    icon: MailCheck,
    group: "People",
    permissionRequired: "people:parents:write",
  },

  // ── Finance ───────────────────────────────────────────────────────────────
  {
    label: "Fee Management",
    href: "/admin/fees",
    icon: Wallet,
    group: "Finance",
    permissionRequired: "finance:fees:read",
  },
  {
    label: "Payments",
    href: "/admin/payments",
    icon: DollarSign,
    group: "Finance",
    permissionRequired: "finance:payments:read",
  },

  // ── Academics ─────────────────────────────────────────────────────────────
  {
    label: "Analytics",
    href: "/admin/analytics",
    icon: BarChart3,
    group: "Academics",
    permissionRequired: "academics:analytics:read",
  },
  {
    label: "Class Management",
    href: "/admin/classes",
    icon: BookUser,
    group: "Academics",
    permissionRequired: "academics:classes:read",
  },
  {
    label: "Heatmap",
    href: "/admin/heatmap",
    icon: Activity,
    group: "Academics",
    permissionRequired: "academics:heatmap:read",
  },
  {
    label: "Assessments",
    href: "/admin/assessments",
    icon: FlaskConical,
    group: "Academics",
    permissionRequired: "academics:assessments:read",
  },

  // ── Communications ────────────────────────────────────────────────────────
  {
    label: "Communications",
    href: "/admin/communications",
    icon: Megaphone,
    group: "Comms",
    permissionRequired: "comms:messages:read",
  },
  {
    label: "Events",
    href: "/admin/events",
    icon: CalendarDays,
    group: "Comms",
    permissionRequired: "comms:events:read",
  },
  {
    label: "Notifications",
    href: "/admin/notifications",
    icon: Bell,
    group: "Comms",
    permissionRequired: "comms:notifications:read",
  },
  {
    label: "Announcements",
    href: "/admin/announcements",
    icon: Megaphone,
    group: "Comms",
    permissionRequired: "comms:announcements:read",
  },

  // ── Student Management ────────────────────────────────────────────────────
  {
    label: "Transfer Center",
    href: "/admin/transfers",
    icon: ArrowLeftRight,
    group: "Student Management",
    permissionRequired: "people:students:write",
  },

  // ── KNEC Exports ──────────────────────────────────────────────────────────
  // These are high-privilege operations — require explicit export write capability.
  {
    label: "Grade 3 MLP",
    href: "/admin/exams/grade-3",
    icon: FileSpreadsheet,
    group: "KNEC Exports",
    permissionRequired: "knec:exports:write",
  },
  {
    label: "KPSEA Grade 6",
    href: "/admin/exams/grade-6",
    icon: FileSpreadsheet,
    group: "KNEC Exports",
    permissionRequired: "knec:exports:write",
  },
  {
    label: "KCSE Grade 9",
    href: "/admin/exams/grade-9",
    icon: FileSpreadsheet,
    group: "KNEC Exports",
    permissionRequired: "knec:exports:write",
  },
  {
    label: "CSL Logbook",
    href: "/admin/csl",
    icon: BookOpen,
    group: "KNEC Exports",
    permissionRequired: "knec:exports:read",
  },

  // ── Security & System ─────────────────────────────────────────────────────
  // Security panel is only visible to super admins (security:roles:manage token).
  {
    label: "Security & Roles",
    href: "/admin/security",
    icon: ShieldCheck,
    group: "System",
    permissionRequired: "security:roles:manage",
  },
  {
    label: "Settings",
    href: "/admin/settings",
    icon: Settings,
    group: "System",
    // Settings accessible to all admin portal users but full write requires a separate action check
    permissionRequired: null,
  },
];

// ── Helper: Filter links by profile ──────────────────────────────────────────
// Used in the server-side AdminSidebar to pre-filter before hydration.
// Imported here to keep the filtering logic co-located with the manifest.

import type { Profile } from "@/lib/types/auth";
import { hasPermission, isSuperAdmin } from "@/lib/actions/auth-utils";

/**
 * Returns only the NavLinks the given profile is authorized to see.
 * This runs server-side in AdminSidebar — never sends unauthorized routes to the client.
 */
export function getAuthorizedLinks(profile: Profile): NavLink[] {
  return ADMIN_LINKS.filter((link) => {
    // Super admins and dev team see everything
    if (isSuperAdmin(profile) || profile.is_dev) return true;

    // Links with no permission requirement are always visible
    if (link.permissionRequired === null) return true;

    // Super-admin-only link (wildcard token)
    if (link.permissionRequired === "*") return false;

    // Evaluate through the full domain-action pipeline
    return hasPermission(profile, link.permissionRequired);
  });
}