import { redirect } from "next/navigation";
import Link from "next/link";
import {
  BarChart3,
  LayoutDashboard,
  BookMarked,
  Calendar,
  FileText,
  UserRoundPlus,
  Mail,
  GraduationCap,
  BookOpen,
  Users,
  ClipboardList,
} from "lucide-react";
import { getSession } from "@/lib/actions/auth";

import { TopNav } from "@/app/_components/nav/TopNav";
import { fetchAnalyticsOverview } from "@/lib/data/analytics";
import { AnalyticsHub } from "@/app/_components/analytics/AnalyticsHub";

export const metadata = {
  title: "Analytics | Kibali Academy Admin",
  description:
    "CBC assessment analytics, grade performance, subject breakdowns and top performers",
};

export const revalidate = 300; // 5-minute ISR — analytics don't need to be real-time

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function AnalyticsPage() {
  const session = await getSession();
  if (!session || session.profile.role !== "admin") {
    redirect("/login?redirectTo=/admin/analytics");
  }

  const data = await fetchAnalyticsOverview(1, 2026);

  return (
    <div className="min-h-screen bg-[#0c0f1a] font-[family-name:var(--font-body)]">
      <TopNav profile={session.profile} email={session.user.email ?? ""} />

      {/* Ambient glows */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden -z-10">
        <div className="absolute top-10 left-1/3 w-[600px] h-[400px] rounded-full bg-violet-500/[0.03] blur-[140px]" />
        <div className="absolute bottom-0 right-0 w-96 h-96 rounded-full bg-emerald-500/[0.03] blur-[100px]" />
        <div className="absolute top-1/2 left-0 w-72 h-72 rounded-full bg-amber-500/[0.025] blur-[100px]" />
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
        {/* ── Page header ───────────────────────────────────────────────────── */}
        <header className="flex flex-wrap items-start justify-between gap-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-amber-400/70">
              Kibali Academy · Admin
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-white flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-400/10 border border-violet-400/20">
                <BarChart3 className="h-5 w-5 text-violet-400" />
              </div>
              CBC Analytics
            </h1>
            <p className="mt-1 text-xs text-white/35 ml-12">
              Assessment performance · Grade breakdowns · Subject analysis ·
              Term 1 · 2026
            </p>
          </div>

          <nav className="flex flex-wrap items-center gap-2">
            <NavLink
              href="/dashboard"
              icon={<LayoutDashboard className="h-4 w-4" />}
            >
              Dashboard
            </NavLink>
            <NavLink
              href="/admin/governance"
              icon={<BookMarked className="h-4 w-4" />}
            >
              Governance
            </NavLink>
            <NavLink href="/admin/comms" icon={<Mail className="h-4 w-4" />}>
              Communications
            </NavLink>
            <NavLink
              href="/admin/students"
              icon={<Users className="h-4 w-4" />}
            >
              Students
            </NavLink>
            <NavLink href="/reports" icon={<FileText className="h-4 w-4" />}>
              Reports
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

        {/* ── Stats strip ───────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <StatCard
            icon={<GraduationCap className="h-4 w-4" />}
            label="Students"
            value={data.totalStudents}
            color="amber"
          />
          <StatCard
            icon={<Users className="h-4 w-4" />}
            label="Teachers"
            value={data.totalTeachers}
            color="emerald"
          />
          <StatCard
            icon={<ClipboardList className="h-4 w-4" />}
            label="Assessments"
            value={data.totalAssessments}
            color="sky"
          />
          <StatCard
            icon={<BarChart3 className="h-4 w-4" />}
            label="Grades Active"
            value={data.gradeSnapshots.length}
            color="violet"
          />
          <StatCard
            icon={<BookOpen className="h-4 w-4" />}
            label="Subjects Tracked"
            value={data.subjectLeaderboard.length}
            color="orange"
          />
          <StatCard
            icon={<GraduationCap className="h-4 w-4" />}
            label="EE Rate"
            value={`${data.scoreDistribution.find((d) => d.score === "EE")?.percent ?? 0}%`}
            color="emerald"
          />
        </div>

        {/* ── Analytics hub (tabbed) ─────────────────────────────────────────── */}
        <AnalyticsHub data={data} />

        <footer className="pt-4 border-t border-white/[0.05]">
          <p className="text-center text-xs text-white/20">
            Kibali Academy · CBC School Management System · Academic Year 2026 ·
            Term 1
          </p>
        </footer>
      </main>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

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
      className={[
        "flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold transition-all duration-150",
        primary
          ? "bg-amber-400 text-[#0c0f1a] hover:bg-amber-300"
          : "border border-white/10 text-white/60 hover:text-white hover:border-white/20 hover:bg-white/5",
      ].join(" ")}
    >
      {icon}
      {children}
    </Link>
  );
}

type StatColor = "amber" | "sky" | "emerald" | "rose" | "orange" | "violet";
const STAT_COLORS: Record<
  StatColor,
  { border: string; bg: string; text: string }
> = {
  amber: {
    border: "border-amber-400/20",
    bg: "bg-amber-400/5",
    text: "text-amber-400",
  },
  sky: {
    border: "border-sky-400/20",
    bg: "bg-sky-400/5",
    text: "text-sky-400",
  },
  emerald: {
    border: "border-emerald-400/20",
    bg: "bg-emerald-400/5",
    text: "text-emerald-400",
  },
  rose: {
    border: "border-rose-400/20",
    bg: "bg-rose-400/5",
    text: "text-rose-400",
  },
  orange: {
    border: "border-orange-400/20",
    bg: "bg-orange-400/5",
    text: "text-orange-400",
  },
  violet: {
    border: "border-violet-400/20",
    bg: "bg-violet-400/5",
    text: "text-violet-400",
  },
};

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  color: StatColor;
}
function StatCard({ icon, label, value, color }: StatCardProps) {
  const s = STAT_COLORS[color];
  return (
    <div
      className={`rounded-xl border ${s.border} ${s.bg} px-3 py-3 text-center`}
    >
      <div className={`flex justify-center mb-1 ${s.text}`}>{icon}</div>
      <p className={`text-xl font-bold tabular-nums ${s.text}`}>{value}</p>
      <p className="text-[9px] uppercase tracking-widest text-white/30 mt-0.5 leading-tight">
        {label}
      </p>
    </div>
  );
}
