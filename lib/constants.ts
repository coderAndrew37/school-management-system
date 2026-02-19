import {
  LayoutDashboard,
  Users,
  BookOpen,
  Camera,
  FileText,
  UserCircle,
} from "lucide-react";

export const ADMIN_LINKS = [
  { name: "Dashboard", href: "/admin/dashboard", icon: LayoutDashboard },
  { name: "Students", href: "/admin/students", icon: Users },
  { name: "Teachers", href: "/admin/teachers", icon: UserCircle },
];

export const TEACHER_LINKS = [
  { name: "My Classes", href: "/teacher/classes", icon: BookOpen },
  { name: "CBC Assessment", href: "/teacher/grading", icon: FileText },
  { name: "Upload Evidence", href: "/teacher/evidence", icon: Camera },
];
