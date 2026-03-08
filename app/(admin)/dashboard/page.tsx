// ─────────────────────────────────────────────────────────────────────────────
// app/(admin)/dashboard/page.tsx  —  Server Component
// Route: /dashboard  (route group (admin) keeps URL clean)
// Session + layout handled by (admin)/layout.tsx
// ─────────────────────────────────────────────────────────────────────────────

import {
  fetchDashboardChartData,
  fetchDashboardStats,
  fetchStudents,
  fetchTeachers,
} from "@/lib/data/dashboard";
import {
  ArrowRight,
  BarChart3,
  GraduationCap,
  UserRoundPlus,
  Users,
} from "lucide-react";
import Link from "next/link";

import {
  AdmissionsTrend,
  EnrollmentChart,
  GenderDonut,
  ScoreDonut,
} from "@/app/_components/dashboard/DashboardCharts";
import { StatCard } from "@/app/_components/dashboard/StatCard";
import { StudentGrid } from "@/app/_components/dashboard/StudentGrd";
import { TeachersTable } from "@/app/_components/dashboard/TeachersTable";
import RegisterTeacherModal from "@/app/_components/teachers/RegisterTeacherModal";

export const metadata = {
  title: "Dashboard | Kibali Academy",
  description: "Overview of students and teachers at Kibali Academy",
};

export const revalidate = 60;

const STUDENT_PREVIEW = 8;

export default async function DashboardPage() {
  const [students, teachers, stats, charts] = await Promise.all([
    fetchStudents(STUDENT_PREVIEW),
    fetchTeachers(),
    fetchDashboardStats(),
    fetchDashboardChartData(1, 2026),
  ]);

  const hasMore = stats.totalStudents > STUDENT_PREVIEW;

  return (
    <div className="min-h-screen bg-[#0c0f1a] font-[family-name:var(--font-body)]">
      {/* Ambient glows */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden -z-10">
        <div className="absolute -top-60 left-1/4 w-[700px] h-[700px] rounded-full bg-amber-500/[0.04] blur-[140px]" />
        <div className="absolute top-1/2 right-0 w-96 h-96 rounded-full bg-emerald-500/[0.04] blur-[120px]" />
        <div className="absolute bottom-0 left-0 w-80 h-80 rounded-full bg-sky-500/[0.04] blur-[100px]" />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* ── Page header ───────────────────────────────────────────────────── */}
        <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5">
          <div className="flex items-center gap-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-400/10 border border-amber-400/20 shadow-lg shadow-amber-400/5">
              <GraduationCap className="h-5 w-5 text-amber-400" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-400/70">
                Kibali Academy
              </p>
              <h1 className="text-xl font-bold tracking-tight text-white">
                School Dashboard
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* NEW: Green Teacher Modal Button */}
            <RegisterTeacherModal />

            {/* Existing Student Link */}
            <Link
              href="/admission"
              className="flex items-center gap-2 rounded-xl bg-amber-400 hover:bg-amber-300 active:scale-95 transition-all duration-200 px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-[#0c0f1a] shadow-lg shadow-amber-400/20"
            >
              <UserRoundPlus className="h-4 w-4" />
              Admit Student
            </Link>
          </div>
        </header>

        {/* ── Stat Cards ─────────────────────────────────────────────────────── */}
        <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard
            label="Total Students"
            value={stats.totalStudents}
            icon="🎒"
            accent="amber"
            href="/students"
          />
          <StatCard
            label="Teaching Staff"
            value={stats.totalTeachers}
            icon="📋"
            accent="emerald"
            href="/teachers"
          />
          <StatCard
            label="Registered Parents"
            value={stats.totalParents}
            icon="👪"
            accent="sky"
            href="/parents"
          />
        </section>

        {/* ── Charts row ─────────────────────────────────────────────────────── */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Grade Enrollment — 2/3 width */}
          <div className="lg:col-span-2 rounded-2xl border border-white/[0.07] bg-white/[0.03] p-5">
            <ChartHeader
              title="Grade Enrollment"
              subtitle={`${stats.totalStudents} students across ${charts.gradeEnrollment.length} active grades`}
            />
            {/* Level legend */}
            <div className="flex flex-wrap gap-3 mb-4">
              {charts.levelSummary.map((l) => (
                <div key={l.level} className="flex items-center gap-1.5">
                  <div
                    className="w-2 h-2 rounded-sm"
                    style={{ background: l.color }}
                  />
                  <span className="text-[10px] text-white/40">{l.label}</span>
                  <span className="text-[10px] font-mono font-bold text-white/60">
                    ({l.count})
                  </span>
                </div>
              ))}
            </div>
            <EnrollmentChart data={charts.gradeEnrollment} />
            {/* Mini legend for male/female */}
            <div className="flex items-center gap-4 mt-2">
              <LegendDot color="#f59e0b" label="Male" />
              <LegendDot color="#fb923c" label="Female" />
              <span className="text-[9px] text-white/20 ml-auto">
                grouped by gender
              </span>
            </div>
          </div>

          {/* Right column — 1/3 */}
          <div className="flex flex-col gap-4">
            {/* Gender split */}
            <div className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-5">
              <ChartHeader
                title="Gender Split"
                subtitle={`${stats.totalStudents} enrolled learners`}
              />
              <GenderDonut
                male={charts.genderSplit.male}
                female={charts.genderSplit.female}
                unknown={charts.genderSplit.unknown}
              />
            </div>

            {/* Assessment coverage */}
            <div className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-5">
              <ChartHeader
                title="Assessment Coverage"
                subtitle="Term 1 · 2026"
              />
              <div className="space-y-3 mt-1">
                <CoverageStat
                  label="Assessed"
                  value={charts.assessmentTotals.assessed}
                  total={charts.assessmentTotals.total}
                  color="#34d399"
                />
                <CoverageStat
                  label="Not yet assessed"
                  value={charts.assessmentTotals.unassessed}
                  total={charts.assessmentTotals.total}
                  color="#fb7185"
                />
              </div>
            </div>
          </div>
        </section>

        {/* ── Second charts row ─────────────────────────────────────────────── */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Score distribution */}
          <div className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-5">
            <div className="flex items-start justify-between mb-4">
              <ChartHeader
                title="CBC Score Distribution"
                subtitle={`${charts.scoreDistribution.reduce((a, d) => a + d.count, 0).toLocaleString()} strand assessments · Term 1`}
              />
              <Link
                href="/admin/analytics"
                className="flex items-center gap-1 text-[10px] text-amber-400/60 hover:text-amber-400 transition-colors flex-shrink-0 ml-3"
              >
                <BarChart3 className="h-3 w-3" />
                Full analytics
              </Link>
            </div>
            <ScoreDonut data={charts.scoreDistribution} />
          </div>

          {/* Admissions trend */}
          <div className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-5">
            <div className="flex items-start justify-between mb-4">
              <ChartHeader
                title="Admissions Trend"
                subtitle="New student admissions — last 6 months"
              />
              <Link
                href="/students"
                className="flex items-center gap-1 text-[10px] text-amber-400/60 hover:text-amber-400 transition-colors flex-shrink-0 ml-3"
              >
                <Users className="h-3 w-3" />
                All students
              </Link>
            </div>
            <AdmissionsTrend data={charts.recentAdmissions} />
          </div>
        </section>

        {/* ── Divider ───────────────────────────────────────────────────────── */}
        <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

        {/* ── Recent Students ────────────────────────────────────────────────── */}
        <section>
          <div className="flex items-end justify-between mb-5">
            <SectionHeader
              title="Recent Students"
              count={stats.totalStudents}
              subtitle={
                hasMore
                  ? `Showing ${STUDENT_PREVIEW} of ${stats.totalStudents} enrolled students`
                  : "All enrolled students"
              }
              accentColor="text-amber-400"
            />
            <Link
              href="/students"
              className="flex items-center gap-1.5 text-xs font-semibold text-amber-400/60 hover:text-amber-400 transition-colors group"
            >
              View all
              <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
            </Link>
          </div>

          <StudentGrid students={students} />

          {hasMore && (
            <div className="mt-4">
              <Link
                href="/students"
                className="flex items-center justify-center gap-2 w-full rounded-2xl border border-white/[0.07] border-dashed bg-white/[0.02] hover:bg-amber-400/[0.04] hover:border-amber-400/20 transition-all duration-300 py-4 text-sm font-medium text-white/30 hover:text-amber-400/70"
              >
                View all {stats.totalStudents} students — search, filter &amp;
                sort
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          )}
        </section>

        {/* ── Divider ───────────────────────────────────────────────────────── */}
        <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

        {/* ── Teachers ──────────────────────────────────────────────────────── */}
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

        {/* ── Footer ────────────────────────────────────────────────────────── */}
        <footer className="pt-4 border-t border-white/[0.05]">
          <p className="text-center text-xs text-white/20">
            Kibali Academy · CBC School Management System · Academic Year 2026
          </p>
        </footer>
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ChartHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="mb-1">
      <h3 className="text-sm font-bold text-white">{title}</h3>
      <p className="text-[10px] text-white/30 mt-0.5">{subtitle}</p>
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className="w-2 h-2 rounded-sm" style={{ background: color }} />
      <span className="text-[9px] text-white/30">{label}</span>
    </div>
  );
}

function CoverageStat({
  label,
  value,
  total,
  color,
}: {
  label: string;
  value: number;
  total: number;
  color: string;
}) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-white/50">{label}</span>
        <span className="text-xs font-mono font-semibold text-white/70">
          {value} <span className="text-white/25">({pct}%)</span>
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
    </div>
  );
}

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
    <div>
      <h2 className="text-base font-bold text-white flex items-baseline gap-2">
        {title}
        <span className={`text-sm font-mono font-semibold ${accentColor}`}>
          ({count})
        </span>
      </h2>
      <p className="text-xs text-white/35 mt-0.5">{subtitle}</p>
    </div>
  );
}
