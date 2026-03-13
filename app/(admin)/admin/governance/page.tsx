import {
  Megaphone,
  CalendarDays,
  Package,
  Banknote,
  AlertTriangle,
  TrendingUp,
  CalendarCheck,
  UserCheck,
  UserX,
} from "lucide-react";
import {
  fetchAnnouncements,
  fetchAllEvents,
  fetchInventoryItems,
  fetchFeeStructures,
  fetchFeePayments,
  fetchStudentSummaries,
  fetchGovernanceStats,
  fetchAttendanceOverview,
} from "@/lib/data/governance";
import { GovernanceHub } from "@/app/_components/governance/GovernanceHub";

export const metadata = {
  title: "Governance | Kibali Academy Admin",
  description:
    "Announcements, calendar, attendance, inventory and fee management",
};

export const revalidate = 60;

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function GovernancePage() {
  const [
    announcements,
    events,
    inventory,
    feeStructures,
    payments,
    students,
    stats,
    attendanceOverview,
  ] = await Promise.all([
    fetchAnnouncements(),
    fetchAllEvents(),
    fetchInventoryItems(),
    fetchFeeStructures(2026),
    fetchFeePayments(2026),
    fetchStudentSummaries(),
    fetchGovernanceStats(),
    fetchAttendanceOverview(),
  ]);

  return (
    <div className="min-h-screen bg-[#0c0f1a] font-[family-name:var(--font-body)]">
      {/* Ambient glows */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden -z-10">
        <div className="absolute -top-40 left-1/4 w-[700px] h-[500px] rounded-full bg-amber-500/[0.03] blur-[140px]" />
        <div className="absolute bottom-0 right-0 w-96 h-96 rounded-full bg-emerald-500/[0.03] blur-[100px]" />
        <div className="absolute top-1/2 left-0 w-72 h-72 rounded-full bg-sky-500/[0.025] blur-[120px]" />
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* ── Page header ─────────────────────────────────────────────────── */}
        <header>
          <div className="flex items-center gap-4 mb-1">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-400/10 border border-amber-400/20 shadow-lg shadow-amber-400/5">
              <Megaphone className="h-5 w-5 text-amber-400" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-400/70">
                Kibali Academy · Admin
              </p>
              <h1 className="text-xl font-bold tracking-tight text-white">
                Communication &amp; Governance
              </h1>
            </div>
          </div>
          <p className="text-xs text-white/30 ml-[60px]">
            Announcements · School Calendar · Attendance Overview · Inventory ·
            Fee Management
          </p>
        </header>

        {/* ── Stats strip: 7 cards ─────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
          <StatCard
            icon={<Megaphone className="h-4 w-4" />}
            label="Announcements"
            value={stats.totalAnnouncements}
            color="amber"
          />
          <StatCard
            icon={<CalendarDays className="h-4 w-4" />}
            label="Upcoming Events"
            value={stats.upcomingEvents}
            color="sky"
          />
          <StatCard
            icon={<CalendarCheck className="h-4 w-4" />}
            label="Marked Today"
            value={attendanceOverview.totalMarked}
            color="emerald"
          />
          <StatCard
            icon={<UserCheck className="h-4 w-4" />}
            label="Present Today"
            value={stats.presentToday}
            color="emerald"
          />
          <StatCard
            icon={<UserX className="h-4 w-4" />}
            label="Absent Today"
            value={stats.absentToday}
            color="rose"
            alert={stats.absentToday > 0}
          />
          <StatCard
            icon={<Package className="h-4 w-4" />}
            label="Low-Stock Items"
            value={stats.lowStockItems}
            color="orange"
            alert={stats.lowStockItems > 0}
          />
          <StatCard
            icon={<AlertTriangle className="h-4 w-4" />}
            label="Fee Arrears"
            value={stats.overduePayments}
            color="rose"
            alert={stats.overduePayments > 0}
          />
        </div>

        {/* Fee collection summary — secondary strip */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-emerald-400/15 bg-emerald-400/[0.04] px-4 py-3 flex items-center gap-3">
            <TrendingUp className="h-5 w-5 text-emerald-400 flex-shrink-0" />
            <div>
              <p className="text-lg font-bold tabular-nums text-emerald-400">
                KES{" "}
                {stats.collectedThisTerm.toLocaleString("en-KE", {
                  maximumFractionDigits: 0,
                })}
              </p>
              <p className="text-[9px] uppercase tracking-widest text-white/30">
                Fees Collected · 2026
              </p>
            </div>
          </div>
          <div className="rounded-xl border border-amber-400/15 bg-amber-400/[0.04] px-4 py-3 flex items-center gap-3">
            <Banknote className="h-5 w-5 text-amber-400 flex-shrink-0" />
            <div>
              <p className="text-lg font-bold tabular-nums text-amber-400">
                KES{" "}
                {stats.outstandingFees.toLocaleString("en-KE", {
                  maximumFractionDigits: 0,
                })}
              </p>
              <p className="text-[9px] uppercase tracking-widest text-white/30">
                Outstanding Balance
              </p>
            </div>
          </div>
        </div>

        {/* ── Tabbed governance hub ────────────────────────────────────────── */}
        <GovernanceHub
          announcements={announcements}
          events={events}
          inventory={inventory}
          feeStructures={feeStructures}
          payments={payments}
          students={students}
          attendanceOverview={attendanceOverview}
        />

        <footer className="pt-4 border-t border-white/[0.05]">
          <p className="text-center text-xs text-white/20">
            Kibali Academy · CBC School Management System · Academic Year 2026
          </p>
        </footer>
      </main>
    </div>
  );
}

// ── StatCard sub-component ────────────────────────────────────────────────────

type StatColor = "amber" | "sky" | "emerald" | "rose" | "orange";

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
};

function StatCard({
  icon,
  label,
  value,
  color,
  alert = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  color: StatColor;
  alert?: boolean;
}) {
  const s = STAT_COLORS[color];
  return (
    <div
      className={`relative rounded-xl border ${s.border} ${s.bg} px-3 py-3 text-center overflow-hidden`}
    >
      {alert && (
        <span className="absolute top-1.5 right-1.5 flex h-2 w-2">
          <span
            className={`animate-ping absolute inline-flex h-full w-full rounded-full ${s.text} opacity-75`}
          />
          <span
            className={`relative inline-flex rounded-full h-2 w-2 ${s.bg} border ${s.border}`}
          />
        </span>
      )}
      <div className={`flex justify-center mb-1 ${s.text}`}>{icon}</div>
      <p className={`text-xl font-bold tabular-nums ${s.text}`}>{value}</p>
      <p className="text-[9px] uppercase tracking-widest text-white/30 mt-0.5 leading-tight">
        {label}
      </p>
    </div>
  );
}
