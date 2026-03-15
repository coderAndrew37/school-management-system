"use client";

// app/_components/nav/TeacherSidebar.tsx

import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  X,
  GraduationCap,
  ClipboardList,
  Calendar,
  BookMarked,
  MessageSquare,
  Image,
  Award,
  LayoutDashboard,
  Users,
  FileText,
} from "lucide-react";

interface TeacherNavLink {
  href: string;
  label: string;
  icon: React.ElementType;
  group: string;
}

const BASE_NAV: TeacherNavLink[] = [
  {
    href: "/teacher",
    label: "Dashboard",
    icon: LayoutDashboard,
    group: "Overview",
  },
  {
    href: "/teacher/assess",
    label: "Assessments",
    icon: ClipboardList,
    group: "Teaching",
  },
  {
    href: "/teacher/attendance",
    label: "Attendance",
    icon: Calendar,
    group: "Teaching",
  },
  {
    href: "/teacher/diary",
    label: "Diary",
    icon: BookMarked,
    group: "Teaching",
  },
  {
    href: "/teacher/gallery",
    label: "Gallery",
    icon: Image,
    group: "Teaching",
  },
  {
    href: "/teacher/pathway",
    label: "JSS Pathways",
    icon: Award,
    group: "Teaching",
  },
  {
    href: "/teacher/messages",
    label: "Messages",
    icon: MessageSquare,
    group: "Communication",
  },
];

const CLASS_TEACHER_NAV: TeacherNavLink[] = [
  {
    href: "/teacher/class/students",
    label: "My Class",
    icon: Users,
    group: "Class Teacher",
  },
  {
    href: "/teacher/class/reports",
    label: "Reports",
    icon: FileText,
    group: "Class Teacher",
  },
];

interface Props {
  isOpen: boolean;
  onClose: () => void;
  isClassTeacher: boolean;
  classGrades: string[];
}

export function TeacherSidebar({
  isOpen,
  onClose,
  isClassTeacher,
  classGrades,
}: Props) {
  const pathname = usePathname();

  const nav = isClassTeacher ? [...BASE_NAV, ...CLASS_TEACHER_NAV] : BASE_NAV;

  const groups = nav.reduce<Record<string, TeacherNavLink[]>>((acc, link) => {
    if (!acc[link.group]) acc[link.group] = [];
    acc[link.group]!.push(link);
    return acc;
  }, {});

  function isActive(href: string): boolean {
    if (href === "/teacher") return pathname === "/teacher";
    return pathname.startsWith(href);
  }

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        className="sidebar-teacher fixed top-0 left-0 z-50 flex flex-col h-full w-[220px] bg-white border-r border-slate-200"
        data-open={String(isOpen)}
      >
        <style>{`
          .sidebar-teacher {
            transform: translateX(-100%);
            transition: transform 0.25s cubic-bezier(0.4,0,0.2,1);
          }
          .sidebar-teacher[data-open="true"] {
            transform: translateX(0);
          }
          @media (min-width: 1024px) {
            .sidebar-teacher { transform: translateX(0) !important; }
          }
        `}</style>

        {/* Header */}
        <div className="flex items-center justify-between px-4 h-14 border-b border-slate-100 flex-shrink-0">
          <Link
            href="/teacher"
            onClick={onClose}
            className="flex items-center gap-2.5"
          >
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 border border-emerald-200 flex-shrink-0">
              <GraduationCap className="h-4 w-4 text-emerald-600" />
            </div>
            <div className="min-w-0">
              <p className="text-[9px] font-black uppercase tracking-[0.15em] text-emerald-600/70 leading-none">
                Kibali
              </p>
              <p className="text-xs font-bold text-slate-600 leading-none mt-0.5">
                Teacher
              </p>
            </div>
          </Link>
          <button
            onClick={onClose}
            className="lg:hidden flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            aria-label="Close sidebar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Class teacher badge — shows all assigned grades */}
        {isClassTeacher && classGrades.length > 0 && (
          <div className="mx-3 mt-3 px-3 py-2 rounded-xl bg-emerald-50 border border-emerald-200">
            <p className="text-[9px] font-black uppercase tracking-wider text-emerald-600/70">
              Class Teacher
            </p>
            {classGrades.length === 1 ? (
              <p className="text-xs font-bold text-emerald-700 mt-0.5">
                {classGrades[0]}
              </p>
            ) : (
              <div className="flex flex-wrap gap-1 mt-1">
                {classGrades.map((g) => (
                  <span
                    key={g}
                    className="text-[9px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-md px-1.5 py-0.5"
                  >
                    {g.replace("Grade ", "G").replace(" / JSS", "")}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-3 px-2.5 space-y-4">
          {Object.entries(groups).map(([groupName, groupLinks]) => (
            <div key={groupName}>
              <p className="px-2.5 mb-1 text-[9px] font-black uppercase tracking-[0.18em] text-slate-400">
                {groupName}
              </p>
              <div className="space-y-0.5">
                {groupLinks.map((link) => {
                  const active = isActive(link.href);
                  const Icon = link.icon;
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      onClick={onClose}
                      className={
                        active
                          ? "flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs font-semibold transition-all bg-emerald-50 border border-emerald-200 text-emerald-700"
                          : "flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs font-semibold transition-all text-slate-500 hover:text-slate-800 hover:bg-slate-50 border border-transparent"
                      }
                    >
                      <div
                        className={
                          active
                            ? "flex-shrink-0 flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600"
                            : "flex-shrink-0 flex h-6 w-6 items-center justify-center rounded-lg text-slate-400"
                        }
                      >
                        <Icon className="h-3.5 w-3.5" />
                      </div>
                      <span className="truncate">{link.label}</span>
                      {active && (
                        <div className="ml-auto w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0" />
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="flex-shrink-0 px-4 py-3 border-t border-slate-100">
          <p className="text-[9px] text-slate-300 font-mono text-center leading-relaxed">
            CBC School Management
            <br />
            Academic Year 2026
          </p>
        </div>
      </aside>
    </>
  );
}
