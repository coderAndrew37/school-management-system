import Link from "next/link";
import { GraduationCap, UserRoundPlus } from "lucide-react";
import {
  fetchStudents,
  fetchTeachers,
  fetchDashboardStats,
} from "@/lib/data/dashboard";
import { StatCard } from "@/app/_components/dashboard/StatCard";
import { StudentGrid } from "@/app/_components/dashboard/StudentGrd";
import { TeachersTable } from "@/app/_components/dashboard/TeachersTable";

export const metadata = {
  title: "Dashboard | Kibera Academy",
  description: "Overview of students and teachers at Kibera Academy",
};

// Revalidate data every 60 seconds (ISR)
export const revalidate = 60;

export default async function DashboardPage() {
  const [students, teachers, stats] = await Promise.all([
    fetchStudents(),
    fetchTeachers(),
    fetchDashboardStats(),
  ]);

  return (
    <div className="min-h-screen bg-[#0c0f1a] font-[family-name:var(--font-body)]">
      {/* Ambient glows */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-60 left-1/4 w-[700px] h-[700px] rounded-full bg-amber-500/[0.04] blur-[140px]" />
        <div className="absolute top-1/2 right-0 w-96 h-96 rounded-full bg-emerald-500/[0.04] blur-[120px]" />
        <div className="absolute bottom-0 left-0 w-80 h-80 rounded-full bg-sky-500/[0.04] blur-[100px]" />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-10">
        {/* ── Header ── */}
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-400/10 border border-amber-400/20 shadow-lg shadow-amber-400/5">
              <GraduationCap className="h-6 w-6 text-amber-400" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-amber-400/70">
                Kibera Academy
              </p>
              <h1 className="text-2xl font-bold tracking-tight text-white">
                School Dashboard
              </h1>
            </div>
          </div>

          <Link
            href="/admission"
            className="flex items-center gap-2 rounded-xl bg-amber-400 hover:bg-amber-300 active:scale-95 transition-all duration-200 px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-[#0c0f1a] shadow-lg shadow-amber-400/20"
          >
            <UserRoundPlus className="h-4 w-4" />
            Admit Student
          </Link>
        </header>

        {/* ── Stat Cards ── */}
        <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard
            label="Total Students"
            value={stats.totalStudents}
            icon="🎒"
            accent="amber"
          />
          <StatCard
            label="Teaching Staff"
            value={stats.totalTeachers}
            icon="📋"
            accent="emerald"
          />
          <StatCard
            label="Registered Parents"
            value={stats.totalParents}
            icon="👪"
            accent="sky"
          />
        </section>

        {/* ── Students Section ── */}
        <section>
          <SectionHeader
            title="Students"
            count={students.length}
            subtitle="All enrolled students"
            accentColor="text-amber-400"
          />
          <div className="mt-5">
            <StudentGrid students={students} />
          </div>
        </section>

        {/* ── Divider ── */}
        <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

        {/* ── Teachers Section ── */}
        <section>
          <SectionHeader
            title="Teaching Staff"
            count={teachers.length}
            subtitle="All registered teachers"
            accentColor="text-emerald-400"
          />
          <div className="mt-5">
            <TeachersTable teachers={teachers} />
          </div>
        </section>

        {/* ── Footer ── */}
        <footer className="pt-4 border-t border-white/[0.05]">
          <p className="text-center text-xs text-white/20">
            Kibera Academy Portal · Data refreshes every 60 seconds
          </p>
        </footer>
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

interface SectionHeaderProps {
  title: string;
  count: number;
  subtitle: string;
  accentColor: string;
}

function SectionHeader({
  title,
  count,
  subtitle,
  accentColor,
}: SectionHeaderProps) {
  return (
    <div className="flex items-baseline justify-between">
      <div>
        <h2 className="text-lg font-bold text-white flex items-baseline gap-2">
          {title}
          <span className={`text-sm font-mono font-semibold ${accentColor}`}>
            ({count})
          </span>
        </h2>
        <p className="text-xs text-white/35 mt-0.5">{subtitle}</p>
      </div>
    </div>
  );
}
