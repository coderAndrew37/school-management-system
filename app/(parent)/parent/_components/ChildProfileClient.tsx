"use client";

import Link from "next/link";
import {
  ArrowLeft,
  BadgeCheck,
  Calendar,
  GraduationCap,
  Hash,
  User,
} from "lucide-react";
import type {
  ChildProfileClientProps,
  CbcScore,
  ScoreBadgeProps,
  StatTileProps,
} from "@/lib/types/parent";
import {
  CBC_SCORES,
  getInitials,
  getAvatarColor,
  calcAge,
  getOverallLevel,
  getSubjectSummary,
  formatDOB,
} from "@/lib/helpers/parent";

// ── Stat tile ─────────────────────────────────────────────────────────────────

const ACCENT_CLASSES: Record<StatTileProps["accent"], string> = {
  amber: "bg-amber-50 text-amber-600",
  emerald: "bg-emerald-50 text-emerald-600",
  sky: "bg-sky-50 text-sky-600",
  rose: "bg-rose-50 text-rose-600",
};

function StatTile({ icon, label, value, accent }: StatTileProps) {
  return (
    <div className="rounded-2xl bg-white border border-stone-100 p-4 shadow-sm">
      <div
        className={`h-9 w-9 rounded-xl flex items-center justify-center mb-3 ${ACCENT_CLASSES[accent]}`}
      >
        {icon}
      </div>
      <p className="text-xs text-stone-400 font-medium uppercase tracking-wider">
        {label}
      </p>
      <p className="text-sm font-bold text-stone-700 mt-0.5">{value}</p>
    </div>
  );
}

// ── Score badge ───────────────────────────────────────────────────────────────

function ScoreBadge({ score }: ScoreBadgeProps) {
  const meta = CBC_SCORES[score];
  return (
    <span
      className={`inline-block rounded-lg px-2.5 py-1 text-xs font-bold border ${meta.bg} ${meta.color} ${meta.border}`}
    >
      {score} — {meta.description}
    </span>
  );
}

// ── Digital ID card ───────────────────────────────────────────────────────────

function DigitalIdCard({ child }: ChildProfileClientProps) {
  const initials = getInitials(child.full_name);
  const color = getAvatarColor(child.full_name);

  return (
    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-stone-800 to-stone-900 p-6 text-white shadow-2xl shadow-stone-300">
      {/* Dot-grid texture */}
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, white 1px, transparent 0)`,
          backgroundSize: "24px 24px",
        }}
      />
      {/* Gold top stripe */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-400" />

      <div className="relative">
        {/* Card header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-amber-400/20 border border-amber-400/40 flex items-center justify-center">
              <GraduationCap className="h-4 w-4 text-amber-400" />
            </div>
            <div>
              <p className="text-[10px] text-stone-400 uppercase tracking-widest font-semibold">
                Kibera Academy
              </p>
              <p className="text-[10px] text-stone-500">Student ID Card</p>
            </div>
          </div>
          <BadgeCheck className="h-5 w-5 text-amber-400" />
        </div>

        {/* Avatar + name */}
        <div className="flex items-center gap-4 mb-6">
          <div
            className={`h-16 w-16 rounded-2xl bg-gradient-to-br ${color} flex items-center justify-center text-xl font-bold text-white shadow-lg ring-2 ring-white/20`}
          >
            {initials}
          </div>
          <div>
            <h3 className="text-lg font-bold text-white leading-tight">
              {child.full_name}
            </h3>
            <p className="text-stone-400 text-sm">{child.current_grade}</p>
            <p className="text-stone-500 text-xs mt-0.5">
              {child.gender ?? "—"} · Age {calcAge(child.date_of_birth)}
            </p>
          </div>
        </div>

        {/* ID numbers */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-white/5 border border-white/10 px-3 py-2.5">
            <p className="text-[10px] text-stone-500 uppercase tracking-wider font-semibold mb-0.5">
              School ID
            </p>
            <p className="font-mono text-sm text-amber-400 font-semibold">
              {child.readable_id ?? "Pending"}
            </p>
          </div>
          <div className="rounded-xl bg-white/5 border border-white/10 px-3 py-2.5">
            <p className="text-[10px] text-stone-500 uppercase tracking-wider font-semibold mb-0.5">
              NEMIS UPI
            </p>
            <p className="font-mono text-sm text-sky-400 font-semibold">
              {child.upi_number ?? "Not assigned"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function ChildProfileClient({ child }: ChildProfileClientProps) {
  const overall = getOverallLevel(child.assessments);
  const subjects = getSubjectSummary(child.assessments);
  const firstName = child.full_name.split(" ")[0] ?? child.full_name;

  return (
    <div className="space-y-6">
      {/* Back nav */}
      <div className="flex items-center gap-3">
        <Link
          href="/parent"
          className="flex h-10 w-10 items-center justify-center rounded-xl bg-white border border-stone-200 shadow-sm hover:border-amber-300 hover:shadow-amber-100 transition-all duration-200"
        >
          <ArrowLeft className="h-4 w-4 text-stone-500" />
        </Link>
        <div>
          <p className="text-xs text-stone-400 font-medium">Student Profile</p>
          <h1 className="text-lg font-bold text-stone-800">{firstName}'s ID</h1>
        </div>
      </div>

      {/* Digital ID */}
      <DigitalIdCard child={child} />

      {/* Bio data */}
      <div>
        <h2 className="text-xs font-bold text-stone-400 uppercase tracking-wider mb-3">
          Bio Data
        </h2>
        <div className="grid grid-cols-2 gap-3">
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
      {child.parents !== null && (
        <div>
          <h2 className="text-xs font-bold text-stone-400 uppercase tracking-wider mb-3">
            Parent / Guardian
          </h2>
          <div className="rounded-2xl bg-white border border-stone-100 p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-amber-50 flex items-center justify-center flex-shrink-0">
                <User className="h-5 w-5 text-amber-500" />
              </div>
              <div>
                <p className="font-semibold text-stone-700">
                  {child.parents.full_name !== "To be updated"
                    ? child.parents.full_name
                    : "Not on record"}
                </p>
                <p className="text-xs text-stone-400 font-mono">
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
            <h2 className="text-xs font-bold text-stone-400 uppercase tracking-wider">
              Latest Scores
            </h2>
            <Link
              href={`/parent/child/${child.id}/progress`}
              className="text-xs font-semibold text-amber-600 hover:text-amber-700 transition-colors"
            >
              Full Report →
            </Link>
          </div>
          <div className="space-y-2">
            {subjects.map(({ subject, score }) => (
              <div
                key={subject}
                className="flex items-center justify-between rounded-2xl bg-white border border-stone-100 px-4 py-3 shadow-sm"
              >
                <p className="text-sm font-semibold text-stone-700">
                  {subject}
                </p>
                <ScoreBadge score={score as CbcScore} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
