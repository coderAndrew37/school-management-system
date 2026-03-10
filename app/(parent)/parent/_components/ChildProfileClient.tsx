"use client";

import type {
  CbcScore,
  ChildProfileClientProps,
  ScoreBadgeProps,
  StatTileProps,
} from "@/lib/helpers/parent";
import {
  calcAge,
  CBC_SCORES,
  formatDOB,
  getAvatarColor,
  getInitials,
  getOverallLevel,
  getSubjectSummary,
} from "@/lib/helpers/parent";
import {
  ArrowLeft,
  BadgeCheck,
  Calendar,
  GraduationCap,
  Hash,
  Phone,
  User,
} from "lucide-react";
import Link from "next/link";

// ── Stat tile — matches .stat-card pattern ────────────────────────────────────
const TILE: Record<
  StatTileProps["accent"],
  { iconBg: string; iconText: string; border: string; bg: string }
> = {
  amber: {
    iconBg: "bg-amber-100",
    iconText: "text-amber-700",
    border: "border-amber-200",
    bg: "bg-amber-50",
  },
  emerald: {
    iconBg: "bg-emerald-100",
    iconText: "text-emerald-700",
    border: "border-emerald-200",
    bg: "bg-emerald-50",
  },
  sky: {
    iconBg: "bg-cyan-100",
    iconText: "text-cyan-700",
    border: "border-cyan-200",
    bg: "bg-cyan-50",
  },
  rose: {
    iconBg: "bg-purple-100",
    iconText: "text-purple-700",
    border: "border-purple-200",
    bg: "bg-purple-50",
  },
};

function StatTile({ icon, label, value, accent }: StatTileProps) {
  const t = TILE[accent];
  return (
    <div className={`rounded-2xl border ${t.border} ${t.bg} p-4 shadow-sm`}>
      <div
        className={`h-9 w-9 rounded-xl flex items-center justify-center mb-3 ${t.iconBg} ${t.iconText}`}
      >
        {icon}
      </div>
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-0.5">
        {label}
      </p>
      <p className="text-sm font-bold text-slate-800">{value}</p>
    </div>
  );
}

// ── Score badge — matches .badge .b-green etc ─────────────────────────────────
function ScoreBadge({ score }: ScoreBadgeProps) {
  const m = CBC_SCORES[score];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-bold ${m.bg} ${m.color} ${m.border}`}
    >
      {score} — {m.description}
    </span>
  );
}

// ── Digital ID card ───────────────────────────────────────────────────────────
function DigitalIdCard({ child }: ChildProfileClientProps) {
  const initials = getInitials(child.full_name);
  const color = getAvatarColor(child.full_name);
  return (
    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-blue-800 via-blue-700 to-cyan-600 p-6 text-white shadow-xl shadow-blue-200">
      <div className="pointer-events-none absolute -right-8 -top-8 h-40 w-40 rounded-full bg-white/[0.08]" />
      <div className="pointer-events-none absolute right-12 -bottom-12 h-32 w-32 rounded-full bg-white/[0.05]" />
      <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-400" />

      <div className="relative">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-xl bg-white/15 border border-white/25 flex items-center justify-center">
              <GraduationCap className="h-4 w-4 text-amber-300" />
            </div>
            <div>
              <p className="text-[10px] text-blue-200 uppercase tracking-widest font-black">
                Kibali Academy
              </p>
              <p className="text-[10px] text-blue-300">Student Identity Card</p>
            </div>
          </div>
          <BadgeCheck className="h-5 w-5 text-amber-300" />
        </div>

        {/* Avatar + name */}
        <div className="flex items-center gap-4 mb-5">
          <div
            className={`h-16 w-16 rounded-2xl bg-gradient-to-br ${color} flex items-center justify-center text-xl font-black text-white shadow-xl ring-2 ring-white/20 flex-shrink-0`}
          >
            {initials}
          </div>
          <div className="min-w-0">
            <h3 className="text-lg font-black text-white leading-tight truncate">
              {child.full_name}
            </h3>
            <p className="text-sm text-blue-200 mt-0.5">
              {child.current_grade}
            </p>
            <p className="text-xs text-blue-300 mt-0.5">
              {child.gender ?? "—"} · Age {calcAge(child.date_of_birth)}
            </p>
          </div>
        </div>

        {/* ID chips */}
        <div className="grid grid-cols-2 gap-2.5">
          <div className="rounded-xl bg-white/10 border border-white/15 px-3 py-2.5">
            <p className="text-[9px] text-blue-300 uppercase tracking-wider font-black mb-1">
              School ID
            </p>
            <p className="font-mono text-sm text-amber-300 font-bold">
              {child.readable_id ?? "Pending"}
            </p>
          </div>
          <div className="rounded-xl bg-white/10 border border-white/15 px-3 py-2.5">
            <p className="text-[9px] text-blue-300 uppercase tracking-wider font-black mb-1">
              NEMIS UPI
            </p>
            <p className="font-mono text-sm text-cyan-300 font-bold">
              {child.upi_number ?? "Not assigned"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export function ChildProfileClient({ child }: ChildProfileClientProps) {
  const overall = getOverallLevel(child.assessments);
  const subjects = getSubjectSummary(child.assessments);
  const firstName = child.full_name.split(" ")[0] ?? child.full_name;

  return (
    <div className="space-y-5">
      {/* Back nav */}
      <div className="flex items-center gap-3">
        <Link
          href="/parent"
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:border-blue-300 hover:text-blue-600 hover:bg-blue-50 active:scale-90"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <p className="text-[10px] text-slate-400 font-black uppercase tracking-wider">
            Student Profile
          </p>
          <h1 className="text-base font-black text-slate-800">
            {firstName}'s Card
          </h1>
        </div>
      </div>

      {/* ID card */}
      <DigitalIdCard child={child} />

      {/* Bio data */}
      <div>
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">
          Bio Data
        </p>
        <div className="grid grid-cols-2 gap-2.5">
          <StatTile
            icon={<Calendar className="h-4 w-4" />}
            label="Date of Birth"
            value={formatDOB(child.date_of_birth)}
            accent="amber"
          />
          <StatTile
            icon={<User className="h-4 w-4" />}
            label="Gender"
            value={child.gender ?? "Not specified"}
            accent="sky"
          />
          <StatTile
            icon={<GraduationCap className="h-4 w-4" />}
            label="Current Grade"
            value={child.current_grade}
            accent="emerald"
          />
          <StatTile
            icon={<Hash className="h-4 w-4" />}
            label="Overall Level"
            value={`${overall.emoji} ${overall.label}`}
            accent="rose"
          />
        </div>
      </div>

      {/* Parent / guardian */}
      {child.parents && (
        <div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">
            Parent / Guardian
          </p>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-amber-100 border border-amber-200 flex items-center justify-center flex-shrink-0">
                <User className="h-5 w-5 text-amber-700" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-slate-800 text-sm truncate">
                  {child.parents.full_name !== "To be updated"
                    ? child.parents.full_name
                    : "Not on record"}
                </p>
                <p className="text-xs text-slate-400 font-mono flex items-center gap-1 mt-0.5">
                  <Phone className="h-3 w-3" />
                  {child.parents.phone_number}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Latest scores */}
      {subjects.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
              Latest Scores
            </p>
            <Link
              href={`/parent/child/${child.id}/progress`}
              className="text-xs font-black text-blue-600 hover:text-blue-700 transition-colors"
            >
              Full Report →
            </Link>
          </div>
          <div className="space-y-2">
            {subjects.map(({ subject, score }) => (
              <div
                key={subject}
                className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm gap-3"
              >
                <p className="text-sm font-bold text-slate-700 flex-1 min-w-0 truncate">
                  {subject}
                </p>
                <ScoreBadge score={score as CbcScore} />
              </div>
            ))}
          </div>
        </div>
      )}
      {subjects.length === 0 && (
        <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 py-10 text-center">
          <p className="text-sm font-bold text-slate-400">
            No assessment scores yet
          </p>
        </div>
      )}
    </div>
  );
}
