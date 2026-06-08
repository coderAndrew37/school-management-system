import { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import {
  Calendar,
  BookMarked,
  LayoutDashboard,
  UserRoundPlus,
} from "lucide-react";
import { getSession } from "@/lib/actions/auth";
import {
  fetchAllGradesWithTimetable,
  fetchTimetableForGrade,
  fetchGradeAllocations,
} from "@/lib/data/allocation";
import type { TimetableGrid } from "@/lib/types/allocation";
import type { GradeAllocation } from "@/lib/data/allocation";
import { GenerateTimetableButton } from "@/app/_components/allocation/GenerateTimetableButton";
import { getActiveTermYear } from "@/lib/utils/settings";
import { TimetableView } from "@/app/_components/allocation/TimeTableView";

export const metadata: Metadata = { 
  title: "Timetable Management | Kibali Academy",
  description: "Configure weekly CBC lesson scheduling tracks.",
};

export const revalidate = 0; // Fresh dataset validation — real-time scheduling edits require instant redraws

export default async function TimetablePage() {
  // 1. Authenticate session securely
  const session = await getSession();
  if (!session || !session.profile) {
    redirect("/auth/login");
  }

  const { 
    school_id, 
    is_super_admin, 
    is_dev, 
    allowed_permissions_override 
  } = session.profile;
  
  // 2. Evaluate permissions using the actual keys present on your Profile type
  const canViewTimetable = 
    is_super_admin || 
    is_dev || 
    allowed_permissions_override?.includes("view_timetable") || 
    allowed_permissions_override?.includes("manage_timetable");

  if (!canViewTimetable || !school_id) {
    redirect("/dashboard");
  }

  // 3. Resolve current calendar boundary parameters
  const { academicYear } = await getActiveTermYear();
  
  // 4. Gather applicable target grade designations inside this specific school scope
  const grades = await fetchAllGradesWithTimetable(school_id, academicYear);

  // 5. Fetch structural matrix grids and active lesson allocations concurrently
  const [grids, allocLists] = await Promise.all([
    Promise.all(grades.map((g) => fetchTimetableForGrade(school_id, g, academicYear))),
    Promise.all(grades.map((g) => fetchGradeAllocations(school_id, g, academicYear))),
  ]);

  const gradeGrids: Record<string, TimetableGrid> = {};
  const allocationsByGrade: Record<string, GradeAllocation[]> = {};

  grades.forEach((grade, i) => {
    gradeGrids[grade] = grids[i]!;
    allocationsByGrade[grade] = allocLists[i]!;
  });

  return (
    <div className="min-h-screen bg-[#0c0f1a] font-[family-name:var(--font-body)]">
      {/* Dynamic Background Accents */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute top-0 left-1/3 w-[600px] h-[500px] rounded-full bg-emerald-500/[0.04] blur-[140px]" />
        <div className="absolute bottom-0 right-0 w-72 h-72 rounded-full bg-amber-500/[0.04] blur-[100px]" />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
        {/* Portal Header Block */}
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-400/10 border border-emerald-400/20">
              <Calendar className="h-6 w-6 text-emerald-400" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-emerald-400/70">
                Kibali Academy · {academicYear}
              </p>
              <h1 className="text-2xl font-bold tracking-tight text-white">
                School Timetable
              </h1>
              <p className="text-[11px] text-white/25 mt-0.5">
                Drag lessons to reorder · Click + to assign · Hover × to remove
              </p>
            </div>
          </div>

          {/* Action and Navigation Toolbar */}
          <nav className="flex items-center gap-2 flex-wrap">
            <GenerateTimetableButton academicYear={academicYear} />
            <NavLink
              href="/dashboard"
              icon={<LayoutDashboard className="h-4 w-4" />}
            >
              Dashboard
            </NavLink>
            <NavLink
              href="/dashboard/allocation"
              icon={<BookMarked className="h-4 w-4" />}
            >
              Allocations
            </NavLink>
            <NavLink
              href="/dashboard/students/admit"
              icon={<UserRoundPlus className="h-4 w-4" />}
              primary
            >
              Admit Student
            </NavLink>
          </nav>
        </header>

        {/* Timetable Interactive Grid Shell */}
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.025] backdrop-blur-xl p-6">
          <div className="h-px w-full bg-gradient-to-r from-transparent via-emerald-400/25 to-transparent mb-6" />
          <TimetableView
            gradeGrids={gradeGrids}
            availableGrades={grades}
            allocationsByGrade={allocationsByGrade}
            academicYear={academicYear}
          />
        </div>

        {/* Footer Identity Block */}
        <footer className="pt-4 border-t border-white/[0.05]">
          <p className="text-center text-xs text-white/15">
            Academic Year {academicYear} · Kibali Academy CBC School Management System
          </p>
        </footer>
      </div>
    </div>
  );
}

function NavLink({
  href,
  icon,
  children,
  primary,
}: {
  href: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  primary?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold transition-all ${
        primary
          ? "bg-amber-400 text-[#0c0f1a] hover:bg-amber-300"
          : "border border-white/10 text-white/60 hover:text-white hover:border-white/20 hover:bg-white/5"
      }`}
    >
      {icon}
      {children}
    </Link>
  );
}