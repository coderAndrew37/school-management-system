// lib/constants.ts — updated with Fees + Communications nav links

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
  Settings,
  Bell,
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
    href: "/",
    icon: LayoutDashboard,
    group: "Overview",
  },

  // ── People ────────────────────────────────────────────────────────────────
  { label: "Students", href: "/students", icon: Users, group: "People" },
  {
    label: "Admit Student",
    href: "/admission",
    icon: PlusCircle,
    group: "People",
  },
  {
    label: "Bulk Admission",
    href: "/bulk-admit",
    icon: Upload,
    group: "People",
  },
  {
    label: "Teachers",
    href: "/teachers",
    icon: BookUser,
    group: "People",
  },
  {
    label: "Class Teachers",
    href: "/class-teachers",
    icon: GraduationCap,
    group: "People",
  },
  {
    label: "Parent Invites",
    href: "/invites",
    icon: MailCheck,
    group: "People",
  },

  // ── Finance ───────────────────────────────────────────────────────────────
  {
    label: "Fee Management",
    href: "/fees",
    icon: Wallet,
    group: "Finance",
  },

  // ── Academics ─────────────────────────────────────────────────────────────
  {
    label: "Performance",
    href: "/heatmap",
    icon: BarChart3,
    group: "Academics",
  },

  // ── Communications ────────────────────────────────────────────────────────
  {
    label: "Announcements",
    href: "/announcements",
    icon: Megaphone,
    group: "Comms",
  },
  {
    label: "Events",
    href: "/events",
    icon: CalendarDays,
    group: "Comms",
  },
  {
    label: "Notifications",
    href: "/notifications",
    icon: Bell,
    group: "Comms",
  },
];
