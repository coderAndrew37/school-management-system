// app/admin/analytics/page.tsx
import { getSession } from "@/lib/actions/auth";
import { fetchAnalyticsOverview } from "@/lib/data/analytics";
import { AnalyticsHub } from "@/app/_components/analytics/AnalyticsHub";
import {
  BarChart3,
  BookOpen,
  ClipboardList,
  GraduationCap,
  LayoutDashboard,
  TrendingUp,
  UserRoundPlus,
  Users,
  Activity,
} from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

export const metadata = {
  title: "Analytics | Kibali Academy Admin",
  description:
    "CBC assessment analytics — grade performance, subject breakdowns, term trends, attendance",
};
export const revalidate = 0;

function currentTerm() {
  const m = new Date().getMonth() + 1;
  return m <= 4 ? 1 : m <= 8 ? 2 : 3;
}

interface Props {
  searchParams: Promise<{ term?: string; year?: string }>;
}

export default async function AnalyticsPage({ searchParams }: Props) {
  const session = await getSession();
  if (!session || !["admin", "superadmin"].includes(session.profile.role)) {
    redirect("/login?redirectTo=/admin/analytics");
  }

  const sp = await searchParams;
  const term = Math.min(
    3,
    Math.max(1, parseInt(sp.term ?? String(currentTerm()), 10)),
  );
  const year = parseInt(sp.year ?? "2026", 10);

  const data = await fetchAnalyticsOverview(term, year);

  return (
    <div className="min-h-screen bg-[#0c0f1a] font-[family-name:var(--font-body)]">
      <div className="pointer-events-none fixed inset-0 overflow-hidden -z-10">
        <div className="absolute top-10 left-1/3 w-[600px] h-[400px] rounded-full bg-violet-500/[0.03] blur-[140px]" />
        <div className="absolute bottom-0 right-0 w-96 h-96 rounded-full bg-emerald-500/[0.03] blur-[100px]" />
        <div className="absolute top-1/2 left-0 w-72 h-72 rounded-full bg-amber-500/[0.025] blur-[100px]" />
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
        {/* Header */}
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
              Term {term} · {year}
            </p>
          </div>
          <nav className="flex flex-wrap items-center gap-2">
            <NavLink
              href="/admin"
              icon={<LayoutDashboard className="h-4 w-4" />}
            >
              Dashboard
            </NavLink>
            <NavLink
              href="/admin/students"
              icon={<Users className="h-4 w-4" />}
            >
              Students
            </NavLink>
            <NavLink
              href="/admin/heatmap"
              icon={<BarChart3 className="h-4 w-4" />}
            >
              Heatmap
            </NavLink>
            <NavLink
              href="/admin/admit"
              icon={<UserRoundPlus className="h-4 w-4" />}
              primary
            >
              Admit Student
            </NavLink>
          </nav>
        </header>

        {/* Term / year selector */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1 rounded-xl border border-white/10 bg-white/[0.03] p-1">
            {([1, 2, 3] as const).map((t) => (
              <Link
                key={t}
                href={`/admin/analytics?term=${t}&year=${year}`}
                className={[
                  "rounded-lg px-4 py-1.5 text-xs font-bold transition-all",
                  term === t
                    ? "bg-amber-400/15 border border-amber-400/30 text-amber-400"
                    : "text-white/35 hover:text-white/70",
                ].join(" ")}
              >
                Term {t}
              </Link>
            ))}
          </div>
          <div className="flex items-center gap-1 rounded-xl border border-white/10 bg-white/[0.03] p-1">
            {[2025, 2026, 2027].map((y) => (
              <Link
                key={y}
                href={`/admin/analytics?term=${term}&year=${y}`}
                className={[
                  "rounded-lg px-4 py-1.5 text-xs font-bold transition-all",
                  year === y
                    ? "bg-violet-400/15 border border-violet-400/30 text-violet-400"
                    : "text-white/35 hover:text-white/70",
                ].join(" ")}
              >
                {y}
              </Link>
            ))}
          </div>
        </div>

        {/* KPI strip */}
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
            icon={<Activity className="h-4 w-4" />}
            label="Coverage"
            value={`${data.coverageRate}%`}
            color="violet"
          />
          <StatCard
            icon={<BookOpen className="h-4 w-4" />}
            label="Subjects"
            value={data.subjectLeaderboard.length}
            color="orange"
          />
          <StatCard
            icon={<TrendingUp className="h-4 w-4" />}
            label="Avg Mean"
            value={data.avgMean.toFixed(1)}
            color="emerald"
          />
        </div>

        {/* Hub */}
        <AnalyticsHub data={data} />

        <footer className="pt-4 border-t border-white/[0.05]">
          <p className="text-center text-xs text-white/20">
            Kibali Academy · CBC School Management System · Academic Year {year}{" "}
            · Term {term}
          </p>
        </footer>
      </main>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

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
      className={[
        "flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold transition-all",
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

function StatCard({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  color: StatColor;
}) {
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
