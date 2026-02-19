import Link from "next/link";
import {
  Calendar,
  BookMarked,
  LayoutDashboard,
  UserRoundPlus,
} from "lucide-react";
import {
  fetchAllGradesWithTimetable,
  fetchTimetableForGrade,
} from "@/lib/data/allocation";

import type { TimetableGrid } from "@/lib/types/allocation";
import { GenerateTimetableButton } from "../../_components/allocation/GenerateTimetableButton";
import { TimetableView } from "../../_components/allocation/TimeTableView";

export const metadata = {
  title: "Timetable | Kibali Academy",
};

export const revalidate = 60;

export default async function TimetablePage() {
  const grades = await fetchAllGradesWithTimetable(2026);

  // Fetch all grade grids in parallel
  const grids = await Promise.all(
    grades.map((grade) => fetchTimetableForGrade(grade, 2026)),
  );

  const gradeGrids: Record<string, TimetableGrid> = {};
  grades.forEach((grade, i) => {
    gradeGrids[grade] = grids[i]!;
  });

  return (
    <div className="min-h-screen bg-[#0c0f1a] font-[family-name:var(--font-body)]">
      {/* Ambient */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute top-0 left-1/3 w-[600px] h-[500px] rounded-full bg-emerald-500/[0.04] blur-[140px]" />
        <div className="absolute bottom-0 right-0 w-72 h-72 rounded-full bg-amber-500/[0.04] blur-[100px]" />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
        {/* ── Header ── */}
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-400/10 border border-emerald-400/20">
              <Calendar className="h-6 w-6 text-emerald-400" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-emerald-400/70">
                Kibera Academy · 2026
              </p>
              <h1 className="text-2xl font-bold tracking-tight text-white">
                School Timetable
              </h1>
            </div>
          </div>

          <nav className="flex items-center gap-2 flex-wrap">
            <GenerateTimetableButton academicYear={2026} />
            <NavLink
              href="/dashboard"
              icon={<LayoutDashboard className="h-4 w-4" />}
            >
              Dashboard
            </NavLink>
            <NavLink
              href="/allocation"
              icon={<BookMarked className="h-4 w-4" />}
            >
              Allocations
            </NavLink>
            <NavLink
              href="/admission"
              icon={<UserRoundPlus className="h-4 w-4" />}
              primary
            >
              Admit Student
            </NavLink>
          </nav>
        </header>

        {/* Timetable card */}
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-xl p-6">
          <div className="h-px w-full bg-gradient-to-r from-transparent via-emerald-400/30 to-transparent mb-6" />
          <TimetableView gradeGrids={gradeGrids} availableGrades={grades} />
        </div>

        <footer className="pt-4 border-t border-white/[0.05]">
          <p className="text-center text-xs text-white/20">
            Academic Year 2026 · Kibera Academy CBC School Management System
          </p>
        </footer>
      </div>
    </div>
  );
}

interface NavLinkProps {
  href: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  primary?: boolean;
}

function NavLink({ href, icon, children, primary }: NavLinkProps) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold transition-all duration-200 ${
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
