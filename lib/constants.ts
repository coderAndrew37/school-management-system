import {
  BarChart3,
  Bell,
  BookMarked,
  Calendar,
  ClipboardCheck,
  ClipboardList,
  FileText,
  GraduationCap,
  Landmark,
  LayoutDashboard,
  Mail,
  UserRoundPlus,
  Users,
  type LucideIcon,
} from "lucide-react";

export interface NavLink {
  name: string;
  href: string;
  icon: LucideIcon;
  group?: string; // optional section label
}

// ── Admin navigation ──────────────────────────────────────────────────────────

export const ADMIN_LINKS: NavLink[] = [
  // Main
  {
    name: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
    group: "Main",
  },
  { name: "Students", href: "/students", icon: Users, group: "Main" },
  {
    name: "Analytics",
    href: "/analytics",
    icon: BarChart3,
    group: "Main",
  },

  // Academic
  {
    name: "Admit Student",
    href: "/admission",
    icon: UserRoundPlus,
    group: "Academic",
  },
  {
    name: "Allocation",
    href: "/allocation",
    icon: BookMarked,
    group: "Academic",
  },
  {
    name: "Class Teachers",
    href: "/class-teachers",
    icon: Users,
    group: "Academic",
  },
  { name: "Timetable", href: "/timetable", icon: Calendar, group: "Academic" },
  { name: "Report Cards", href: "/reports", icon: FileText, group: "Academic" },
  {
    name: "Promote Students",
    href: "/promotion",
    icon: UserRoundPlus,
    group: "Academic",
  },

  // Admin
  {
    name: "Governance",
    href: "/governance",
    icon: Landmark,
    group: "Administration",
  },
  {
    name: "Communications",
    href: "/communications",
    icon: Mail,
    group: "Administration",
  },
];

// ── Teacher navigation ────────────────────────────────────────────────────────

export const TEACHER_LINKS: NavLink[] = [
  {
    name: "My Dashboard",
    href: "/teacher",
    icon: LayoutDashboard,
    group: "Main",
  },
  {
    name: "Assessments",
    href: "/teacher/assess",
    icon: ClipboardList,
    group: "Teaching",
  },
  {
    name: "Attendance",
    href: "/teacher/attendance",
    icon: ClipboardCheck,
    group: "Teaching",
  },
  { name: "Timetable", href: "/timetable", icon: Calendar, group: "Teaching" },
];

// ── Parent navigation ─────────────────────────────────────────────────────────

export const PARENT_LINKS: NavLink[] = [
  { name: "My Children", href: "/parent", icon: GraduationCap, group: "Main" },
  {
    name: "Notifications",
    href: "/parent#notifications",
    icon: Bell,
    group: "Main",
  },
];
