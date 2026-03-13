"use client";

// app/_components/analytics/AnalyticsHub.tsx
// Drop this in app/_components/analytics/AnalyticsHub.tsx

import { useState } from "react";
import {
  BarChart3,
  GraduationCap,
  BookOpen,
  TrendingUp,
  ChevronDown,
  ChevronUp,
  Users,
} from "lucide-react";
import type {
  AnalyticsOverview,
  GradeSnapshot,
  SubjectSnapshot,
  StudentPerformanceSummary,
} from "@/lib/data/analytics";

// ── Colour helpers ────────────────────────────────────────────────────────────

const SCORE_STYLE = {
  EE: {
    label: "Exceeds Expectation",
    bar: "bg-emerald-400",
    text: "text-emerald-400",
    bg: "bg-emerald-400/10",
    border: "border-emerald-400/25",
  },
  ME: {
    label: "Meets Expectation",
    bar: "bg-sky-400",
    text: "text-sky-400",
    bg: "bg-sky-400/10",
    border: "border-sky-400/25",
  },
  AE: {
    label: "Approaching",
    bar: "bg-amber-400",
    text: "text-amber-400",
    bg: "bg-amber-400/10",
    border: "border-amber-400/25",
  },
  BE: {
    label: "Below Expectation",
    bar: "bg-rose-400",
    text: "text-rose-400",
    bg: "bg-rose-400/10",
    border: "border-rose-400/25",
  },
};

const LEVEL_LABEL: Record<string, string> = {
  lower_primary: "Lower Primary",
  upper_primary: "Upper Primary",
  junior_secondary: "Junior Secondary",
};

const LEVEL_COLOR: Record<
  string,
  { text: string; border: string; bg: string }
> = {
  lower_primary: {
    text: "text-teal-400",
    border: "border-teal-400/25",
    bg: "bg-teal-400/5",
  },
  upper_primary: {
    text: "text-violet-400",
    border: "border-violet-400/25",
    bg: "bg-violet-400/5",
  },
  junior_secondary: {
    text: "text-blue-400",
    border: "border-blue-400/25",
    bg: "bg-blue-400/5",
  },
};

function meanLabel(wm: number): "EE" | "ME" | "AE" | "BE" {
  if (wm >= 3.5) return "EE";
  if (wm >= 2.5) return "ME";
  if (wm >= 1.5) return "AE";
  return "BE";
}

function ScoreBar({
  ee,
  me,
  ae,
  be,
}: {
  ee: number;
  me: number;
  ae: number;
  be: number;
}) {
  const total = ee + me + ae + be;
  if (total === 0)
    return <div className="h-2 rounded-full bg-white/5 w-full" />;
  const pct = (n: number) => `${Math.round((n / total) * 100)}%`;
  return (
    <div className="flex h-2 rounded-full overflow-hidden w-full gap-px">
      {ee > 0 && (
        <div
          className="bg-emerald-400 rounded-l-full"
          style={{ width: pct(ee) }}
        />
      )}
      {me > 0 && <div className="bg-sky-400" style={{ width: pct(me) }} />}
      {ae > 0 && <div className="bg-amber-400" style={{ width: pct(ae) }} />}
      {be > 0 && (
        <div
          className="bg-rose-400 rounded-r-full"
          style={{ width: pct(be) }}
        />
      )}
    </div>
  );
}

// ── Tabs ──────────────────────────────────────────────────────────────────────

type Tab = "overview" | "grades" | "subjects" | "students";

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  {
    id: "overview",
    label: "Overview",
    icon: <BarChart3 className="h-4 w-4" />,
  },
  {
    id: "grades",
    label: "By Grade",
    icon: <GraduationCap className="h-4 w-4" />,
  },
  {
    id: "subjects",
    label: "By Subject",
    icon: <BookOpen className="h-4 w-4" />,
  },
  {
    id: "students",
    label: "Top Performers",
    icon: <TrendingUp className="h-4 w-4" />,
  },
];

// ── Main ──────────────────────────────────────────────────────────────────────

export function AnalyticsHub({ data }: { data: AnalyticsOverview }) {
  const [tab, setTab] = useState<Tab>("overview");
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-1 rounded-2xl border border-white/[0.07] bg-white/[0.03] p-1.5 w-max">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={[
              "flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold transition-all",
              tab === t.id
                ? "bg-amber-400/15 border border-amber-400/30 text-amber-400"
                : "text-white/40 hover:text-white",
            ].join(" ")}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>
      {tab === "overview" && <OverviewTab data={data} />}
      {tab === "grades" && <GradesTab snapshots={data.gradeSnapshots} />}
      {tab === "subjects" && (
        <SubjectsTab
          leaderboard={data.subjectLeaderboard}
          snapshots={data.subjectSnapshots}
        />
      )}
      {tab === "students" && (
        <StudentsTab top={data.topPerformers} support={data.needsSupport} />
      )}
    </div>
  );
}

// ── Overview tab ──────────────────────────────────────────────────────────────

function OverviewTab({ data }: { data: AnalyticsOverview }) {
  return (
    <div className="space-y-6">
      {/* Score distribution */}
      <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6">
        <p className="text-xs font-semibold uppercase tracking-widest text-amber-400/70 mb-1">
          School-Wide
        </p>
        <h3 className="text-lg font-bold text-white mb-5">
          CBC Score Distribution
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          {data.scoreDistribution.map((d) => {
            const s = SCORE_STYLE[d.score as keyof typeof SCORE_STYLE];
            return (
              <div
                key={d.score}
                className={`rounded-xl border ${s.border} ${s.bg} p-4 text-center`}
              >
                <p className={`text-3xl font-black tabular-nums ${s.text}`}>
                  {d.percent}%
                </p>
                <p className={`text-xs font-bold mt-1 ${s.text}`}>{d.score}</p>
                <p className="text-[10px] text-white/30 mt-0.5">{s.label}</p>
                <p className="text-[10px] text-white/20 mt-1">
                  {d.count.toLocaleString()} strands
                </p>
              </div>
            );
          })}
        </div>
        <div className="space-y-1">
          <p className="text-[10px] uppercase tracking-wider text-white/30">
            Distribution across all {data.totalAssessments.toLocaleString()}{" "}
            assessment records
          </p>
          <ScoreBar
            ee={
              data.scoreDistribution.find((d) => d.score === "EE")?.count ?? 0
            }
            me={
              data.scoreDistribution.find((d) => d.score === "ME")?.count ?? 0
            }
            ae={
              data.scoreDistribution.find((d) => d.score === "AE")?.count ?? 0
            }
            be={
              data.scoreDistribution.find((d) => d.score === "BE")?.count ?? 0
            }
          />
          <div className="flex gap-4 flex-wrap pt-1">
            {(["EE", "ME", "AE", "BE"] as const).map((s) => (
              <div
                key={s}
                className="flex items-center gap-1.5 text-[10px] text-white/40"
              >
                <div
                  className={`w-2.5 h-2.5 rounded-sm ${SCORE_STYLE[s].bar}`}
                />
                {SCORE_STYLE[s].label}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Grade table */}
      <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6">
        <h3 className="text-base font-bold text-white mb-4">
          Grade Performance at a Glance
        </h3>
        {data.gradeSnapshots.length === 0 ? (
          <p className="text-sm text-white/30 py-8 text-center">
            No grade data yet — assessments will appear here once teachers
            submit scores.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.07]">
                  {[
                    "Grade",
                    "Level",
                    "Students",
                    "Assessed",
                    "Mean",
                    "Distribution",
                  ].map((h) => (
                    <th
                      key={h}
                      className={`pb-3 text-[10px] font-bold uppercase tracking-wider text-white/30 ${h === "Grade" || h === "Level" ? "text-left" : h === "Distribution" ? "min-w-[140px]" : "text-center"}`}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {data.gradeSnapshots.map((g) => {
                  const dom = meanLabel(g.weightedMean);
                  const s = SCORE_STYLE[dom];
                  const lc = LEVEL_COLOR[g.level] ?? LEVEL_COLOR.lower_primary!;
                  return (
                    <tr
                      key={g.grade}
                      className="hover:bg-white/[0.02] transition-colors"
                    >
                      <td className="py-3 pr-4 font-semibold text-white">
                        {g.grade}
                      </td>
                      <td className="py-3 pr-4">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${lc.bg} ${lc.border} border ${lc.text}`}
                        >
                          {LEVEL_LABEL[g.level]}
                        </span>
                      </td>
                      <td className="py-3 pr-4 text-center font-mono text-white/70">
                        {g.studentCount}
                      </td>
                      <td className="py-3 pr-4 text-center font-mono text-white/50">
                        {g.assessedCount}
                      </td>
                      <td className="py-3 pr-4 text-center">
                        {g.weightedMean > 0 ? (
                          <span
                            className={`text-xs font-bold px-2.5 py-1 rounded-lg ${s.bg} ${s.border} border ${s.text}`}
                          >
                            {g.weightedMean.toFixed(1)} · {dom}
                          </span>
                        ) : (
                          <span className="text-xs text-white/20">—</span>
                        )}
                      </td>
                      <td className="py-3">
                        <ScoreBar
                          ee={g.eeCount}
                          me={g.meCount}
                          ae={g.aeCount}
                          be={g.beCount}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Subject leaderboard */}
      <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6">
        <h3 className="text-base font-bold text-white mb-4">
          Subject Leaderboard
        </h3>
        {data.subjectLeaderboard.length === 0 ? (
          <p className="text-sm text-white/30 py-8 text-center">
            No subject data yet.
          </p>
        ) : (
          <div className="space-y-3">
            {data.subjectLeaderboard.slice(0, 12).map((s, i) => {
              const dom = meanLabel(s.weightedMean);
              const style = SCORE_STYLE[dom];
              const pct = ((s.weightedMean - 1) / 3) * 100;
              return (
                <div key={s.subjectName} className="flex items-center gap-4">
                  <span className="text-[10px] font-black tabular-nums text-white/20 w-5 text-right flex-shrink-0">
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-semibold text-white truncate">
                        {s.subjectName}
                      </span>
                      <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                        <span className="text-[10px] text-white/30">
                          {s.total} records
                        </span>
                        <span
                          className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${style.bg} ${style.text}`}
                        >
                          {s.weightedMean.toFixed(1)}
                        </span>
                      </div>
                    </div>
                    <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${style.bar} transition-all duration-500`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ── By Grade tab ──────────────────────────────────────────────────────────────

function GradesTab({ snapshots }: { snapshots: GradeSnapshot[] }) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const levels = [...new Set(snapshots.map((g) => g.level))];

  if (snapshots.length === 0) {
    return (
      <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] py-16 text-center">
        <p className="text-3xl mb-2">📊</p>
        <p className="text-sm text-white/35">No grade data yet</p>
        <p className="text-xs text-white/20 mt-1">
          Data appears once teachers submit assessments
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {levels.map((level) => {
        const grades = snapshots.filter((g) => g.level === level);
        const lc = LEVEL_COLOR[level] ?? LEVEL_COLOR.lower_primary!;
        return (
          <div key={level}>
            <div className="flex items-center gap-3 mb-4">
              <div className={`h-px flex-1 border-t ${lc.border}`} />
              <span
                className={`text-xs font-bold uppercase tracking-widest ${lc.text}`}
              >
                {LEVEL_LABEL[level]}
              </span>
              <div className={`h-px flex-1 border-t ${lc.border}`} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {grades.map((g) => {
                const dom = meanLabel(g.weightedMean);
                const s = SCORE_STYLE[dom];
                const isOpen = expanded === g.grade;
                const total = g.eeCount + g.meCount + g.aeCount + g.beCount;
                return (
                  <div
                    key={g.grade}
                    className={`rounded-2xl border transition-all ${isOpen ? "border-white/15 bg-white/[0.04]" : "border-white/[0.07] bg-white/[0.02]"}`}
                  >
                    <button
                      className="w-full p-5 text-left"
                      onClick={() => setExpanded(isOpen ? null : g.grade)}
                    >
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <p className="text-base font-bold text-white">
                            {g.grade}
                          </p>
                          <p className="text-xs text-white/35 mt-0.5">
                            {g.studentCount} students · {g.assessedCount}{" "}
                            assessed
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {g.weightedMean > 0 && (
                            <span
                              className={`text-xs font-bold px-2.5 py-1 rounded-lg ${s.bg} ${s.border} border ${s.text}`}
                            >
                              {g.weightedMean.toFixed(1)} · {dom}
                            </span>
                          )}
                          {isOpen ? (
                            <ChevronUp className="h-4 w-4 text-white/30" />
                          ) : (
                            <ChevronDown className="h-4 w-4 text-white/30" />
                          )}
                        </div>
                      </div>
                      <ScoreBar
                        ee={g.eeCount}
                        me={g.meCount}
                        ae={g.aeCount}
                        be={g.beCount}
                      />
                    </button>
                    {isOpen && (
                      <div className="px-5 pb-5 border-t border-white/[0.06] pt-4">
                        <div className="grid grid-cols-2 gap-3">
                          {(["EE", "ME", "AE", "BE"] as const).map((sc) => {
                            const count =
                              g[
                                `${sc.toLowerCase()}Count` as
                                  | "eeCount"
                                  | "meCount"
                                  | "aeCount"
                                  | "beCount"
                              ];
                            const pct =
                              total > 0 ? Math.round((count / total) * 100) : 0;
                            const st = SCORE_STYLE[sc];
                            return (
                              <div
                                key={sc}
                                className={`rounded-xl ${st.bg} border ${st.border} p-3`}
                              >
                                <p
                                  className={`text-lg font-black tabular-nums ${st.text}`}
                                >
                                  {pct}%
                                </p>
                                <p
                                  className={`text-[9px] font-bold uppercase ${st.text}`}
                                >
                                  {sc}
                                </p>
                                <p className="text-[9px] text-white/30 mt-0.5">
                                  {count} strands
                                </p>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── By Subject tab ────────────────────────────────────────────────────────────

function SubjectsTab({
  leaderboard,
  snapshots,
}: {
  leaderboard: { subjectName: string; weightedMean: number; total: number }[];
  snapshots: SubjectSnapshot[];
}) {
  const [filter, setFilter] = useState("");
  const filtered = leaderboard.filter((s) =>
    s.subjectName.toLowerCase().includes(filter.toLowerCase()),
  );

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter subjects…"
          className="flex-1 max-w-sm rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-2.5 text-sm text-white placeholder-white/20 outline-none focus:border-amber-400/50 transition-colors"
        />
        <span className="text-xs text-white/30">
          {filtered.length} subjects
        </span>
      </div>

      <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/[0.07]">
              {["#", "Subject", "Records", "Mean", "Performance"].map((h) => (
                <th
                  key={h}
                  className={`p-4 text-[10px] font-bold uppercase tracking-wider text-white/30 ${h === "Performance" ? "min-w-[200px]" : h === "Records" || h === "Mean" ? "text-center" : "text-left"}`}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.04]">
            {filtered.map((s, i) => {
              const dom = meanLabel(s.weightedMean);
              const style = SCORE_STYLE[dom];
              const pct = ((s.weightedMean - 1) / 3) * 100;
              const detail = snapshots.filter(
                (x) => x.subjectName === s.subjectName,
              );
              const aggEe = detail.reduce((a, x) => a + x.eeCount, 0);
              const aggMe = detail.reduce((a, x) => a + x.meCount, 0);
              const aggAe = detail.reduce((a, x) => a + x.aeCount, 0);
              const aggBe = detail.reduce((a, x) => a + x.beCount, 0);
              return (
                <tr
                  key={s.subjectName}
                  className="hover:bg-white/[0.02] transition-colors"
                >
                  <td className="p-4 text-[10px] font-black text-white/20">
                    {i + 1}
                  </td>
                  <td className="p-4">
                    <p className="font-semibold text-white">{s.subjectName}</p>
                    <p className="text-[10px] text-white/30 mt-0.5">
                      {detail.length} grade{detail.length !== 1 ? "s" : ""}
                    </p>
                  </td>
                  <td className="p-4 text-center font-mono text-xs text-white/50">
                    {s.total.toLocaleString()}
                  </td>
                  <td className="p-4 text-center">
                    <span
                      className={`text-xs font-bold px-2.5 py-1 rounded-lg ${style.bg} ${style.border} border ${style.text}`}
                    >
                      {s.weightedMean.toFixed(1)} · {dom}
                    </span>
                  </td>
                  <td className="p-4">
                    <div className="space-y-1">
                      <ScoreBar ee={aggEe} me={aggMe} ae={aggAe} be={aggBe} />
                      <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${style.bar}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="py-16 text-center">
            <p className="text-sm text-white/30">
              No subjects match &quot;{filter}&quot;
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Top Performers tab ────────────────────────────────────────────────────────

function StudentsTab({
  top,
  support,
}: {
  top: StudentPerformanceSummary[];
  support: StudentPerformanceSummary[];
}) {
  const [view, setView] = useState<"top" | "support">("top");
  const list = view === "top" ? top : support;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        {(["top", "support"] as const).map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={[
              "flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition-all border",
              view === v
                ? v === "top"
                  ? "bg-emerald-400/15 border-emerald-400/30 text-emerald-400"
                  : "bg-rose-400/15 border-rose-400/30 text-rose-400"
                : "border-white/10 text-white/40 hover:text-white",
            ].join(" ")}
          >
            {v === "top" ? (
              <TrendingUp className="h-3.5 w-3.5" />
            ) : (
              <Users className="h-3.5 w-3.5" />
            )}
            {v === "top"
              ? `Top Performers (${top.length})`
              : `Needs Support (${support.length})`}
          </button>
        ))}
      </div>

      <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] overflow-hidden">
        {list.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-3xl mb-2">📊</p>
            <p className="text-sm text-white/35">No assessment data yet</p>
            <p className="text-xs text-white/20 mt-1">
              Data will appear once teachers submit assessments
            </p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.07]">
                {["#", "Student", "Grade", "Mean", "Dominant", "Profile"].map(
                  (h) => (
                    <th
                      key={h}
                      className={`p-4 text-[10px] font-bold uppercase tracking-wider text-white/30 ${h === "Student" || h === "#" ? "text-left" : "text-center"}`}
                    >
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {list.map((s, i) => {
                const dom = s.dominantScore ?? meanLabel(s.weightedMean);
                const style = SCORE_STYLE[dom];
                const initials = s.fullName
                  .split(" ")
                  .slice(0, 2)
                  .map((w) => w[0])
                  .join("")
                  .toUpperCase();
                return (
                  <tr
                    key={s.studentId}
                    className="hover:bg-white/[0.02] transition-colors"
                  >
                    <td className="p-4 text-[10px] font-black text-white/20">
                      {i + 1}
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-amber-400/10 border border-amber-400/20 flex items-center justify-center text-[10px] font-black text-amber-400">
                          {initials}
                        </div>
                        <div>
                          <p className="font-semibold text-white text-xs">
                            {s.fullName}
                          </p>
                          <p className="text-[10px] text-white/30">
                            {s.readableId ?? "—"}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="p-4 text-center text-xs text-white/60">
                      {s.grade}
                    </td>
                    <td className="p-4 text-center">
                      {s.weightedMean > 0 ? (
                        <span
                          className={`text-xs font-bold px-2.5 py-1 rounded-lg ${style.bg} ${style.border} border ${style.text}`}
                        >
                          {s.weightedMean.toFixed(1)}
                        </span>
                      ) : (
                        <span className="text-xs text-white/20">—</span>
                      )}
                    </td>
                    <td className="p-4 text-center">
                      <span
                        className={`text-xs font-bold px-2.5 py-1 rounded-lg ${style.bg} ${style.text}`}
                      >
                        {dom}
                      </span>
                    </td>
                    <td className="p-4">
                      <ScoreBar
                        ee={s.eeCount}
                        me={s.meCount}
                        ae={s.aeCount}
                        be={s.beCount}
                      />
                      <p className="text-[9px] text-white/25 mt-1">
                        {s.totalAssessed} strands assessed
                      </p>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
