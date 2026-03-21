// lib/constants.ts — updated to include Analytics + Settings nav links

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
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface NavLink {
  label: string;
  href: string;
  icon: LucideIcon;
  group?: string;
}

export const ADMIN_LINKS: NavLink[] = [
  // ── Overview ──────────────────────────────────────────────────────────────
  {
    label: "Dashboard",
    href: "/admin/dashboard",
    icon: LayoutDashboard,
    group: "Overview",
  },

  // ── People ────────────────────────────────────────────────────────────────
  { label: "Students", href: "/admin/students", icon: Users, group: "People" },
  {
    label: "Admit Student",
    href: "/admin/admission",
    icon: PlusCircle,
    group: "People",
  },
  {
    label: "Bulk Admission",
    href: "/admin/bulk-admit",
    icon: Upload,
    group: "People",
  },

  {
    label: "Applications",
    href: "/admin/applications",
    icon: ClipboardList,
    group: "People",
  },
  {
    label: "Teachers",
    href: "/admin/teachers",
    icon: BookUser,
    group: "People",
  },
  {
    label: "Class Teachers",
    href: "/admin/class-teachers",
    icon: GraduationCap,
    group: "People",
  },
  {
    label: "Subject Allocations",
    href: "/admin/allocation",
    icon: GraduationCap,
    group: "People",
  },
  {
    label: "Parent Invites",
    href: "/admin/invites",
    icon: MailCheck,
    group: "People",
  },

  // ── Finance ───────────────────────────────────────────────────────────────
  {
    label: "Fee Management",
    href: "/admin/fees",
    icon: Wallet,
    group: "Finance",
  },

  // ── Academics ─────────────────────────────────────────────────────────────
  {
    label: "Analytics",
    href: "/admin/analytics",
    icon: BarChart3,
    group: "Academics",
  },
  {
    label: "Heatmap",
    href: "/admin/heatmap",
    icon: BarChart3,
    group: "Academics",
  },

  // ── Communications ────────────────────────────────────────────────────────
  {
    label: "Commnications",
    href: "/admin/communications",
    icon: Megaphone,
    group: "Comms",
  },
  {
    label: "Events",
    href: "/admin/events",
    icon: CalendarDays,
    group: "Comms",
  },
  {
    label: "Notifications",
    href: "/admin/notifications",
    icon: Bell,
    group: "Comms",
  },
  {
    label: "Announcements",
    href: "/admin/announcements",
    icon: Megaphone,
    group: "Comms",
  },

  // ── System ────────────────────────────────────────────────────────────────
  {
    label: "Settings",
    href: "/admin/settings",
    icon: Settings,
    group: "System",
  },
];
