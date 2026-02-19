import Link from "next/link";
import {
  FileText,
  LayoutDashboard,
  BookMarked,
  Calendar,
  UserRoundPlus,
} from "lucide-react";
import { fetchAllGrades } from "@/lib/data/reports";
import { createServerClient } from "@/lib/supabase/client";
import { ReportsClient } from "@/app/_components/reports/ReportsClient";

export const metadata = {
  title: "Report Cards | Kibali Academy",
  description: "Generate and download CBC report cards for all students",
};

export const revalidate = 120;

async function fetchStudentCountsByGrade(): Promise<{
  counts: Record<string, number>;
  total: number;
}> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("students")
    .select("current_grade");

  if (error || !data) return { counts: {}, total: 0 };

  const counts: Record<string, number> = {};
  for (const row of data as { current_grade: string }[]) {
    counts[row.current_grade] = (counts[row.current_grade] ?? 0) + 1;
  }

  return { counts, total: data.length };
}

export default async function ReportsPage() {
  const [grades, { counts, total }] = await Promise.all([
    fetchAllGrades(),
    fetchStudentCountsByGrade(),
  ]);

  return (
    <div className="min-h-screen bg-[#0c0f1a] font-[family-name:var(--font-body)]">
      {/* Ambient glows */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute top-0 right-1/3 w-[600px] h-[500px] rounded-full bg-amber-500/[0.04] blur-[140px]" />
        <div className="absolute bottom-0 left-1/4 w-80 h-80 rounded-full bg-emerald-500/[0.03] blur-[120px]" />
      </div>

      <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
        {/* ── Header ── */}
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-400/10 border border-amber-400/20">
              <FileText className="h-6 w-6 text-amber-400" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-amber-400/70">
                Kibali Academy · Admin
              </p>
              <h1 className="text-2xl font-bold tracking-tight text-white">
                Bulk Report Cards
              </h1>
              <p className="text-xs text-white/35 mt-0.5">
                Generate CBC progress reports for all students
              </p>
            </div>
          </div>

          <nav className="flex items-center gap-2 flex-wrap">
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
            <NavLink href="/timetable" icon={<Calendar className="h-4 w-4" />}>
              Timetable
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

        {/* Stats strip */}
        <div className="grid grid-cols-3 gap-3">
          <StatChip label="Total Students" value={total} color="amber" />
          <StatChip label="Grades" value={grades.length} color="sky" />
          <StatChip label="Academic Year" value={2026} color="emerald" raw />
        </div>

        {/* Main client component */}
        {total === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 rounded-2xl border border-dashed border-white/10">
            <p className="text-4xl mb-3">🎒</p>
            <p className="text-white/50 font-medium">
              No students in the system yet
            </p>
            <p className="text-white/25 text-sm mt-1">
              Admit students first before generating reports.
            </p>
            <Link
              href="/admission"
              className="mt-5 flex items-center gap-2 rounded-xl bg-amber-400 hover:bg-amber-300 px-4 py-2.5 text-xs font-bold text-[#0c0f1a] transition-all"
            >
              <UserRoundPlus className="h-4 w-4" />
              Admit First Student
            </Link>
          </div>
        ) : (
          <ReportsClient
            availableGrades={grades}
            studentCounts={counts}
            totalStudents={total}
          />
        )}

        <footer className="pt-4 border-t border-white/[0.05]">
          <p className="text-center text-xs text-white/20">
            Kibali Academy · CBC School Management System · Reports are
            generated server-side
          </p>
        </footer>
      </div>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────

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

interface StatChipProps {
  label: string;
  value: number;
  color: "amber" | "sky" | "emerald";
  raw?: boolean;
}

const chipColors = {
  amber: "bg-amber-400/5 border-amber-400/15 text-amber-400",
  sky: "bg-sky-400/5 border-sky-400/15 text-sky-400",
  emerald: "bg-emerald-400/5 border-emerald-400/15 text-emerald-400",
};

function StatChip({ label, value, color, raw }: StatChipProps) {
  return (
    <div
      className={`rounded-xl border px-4 py-3 text-center ${chipColors[color]}`}
    >
      <p
        className={`text-2xl font-bold tabular-nums ${raw ? "font-mono" : ""}`}
      >
        {value}
      </p>
      <p className="text-[10px] uppercase tracking-widest text-white/30 mt-0.5">
        {label}
      </p>
    </div>
  );
}
