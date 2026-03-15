"use client";

// app/_components/analytics/OverviewTab.tsx

import type { AnalyticsOverview } from "@/lib/data/analytics";
import { SS, LEVEL_COLOR, LEVEL_LABEL, meanLabel } from "./analytics-constants";
import { ScoreBar, Donut } from "./AnalyticsCharts";

export function OverviewTab({ data }: { data: AnalyticsOverview }) {
  const eeCount =
    data.scoreDistribution.find((d) => d.score === "EE")?.count ?? 0;
  const meCount =
    data.scoreDistribution.find((d) => d.score === "ME")?.count ?? 0;
  const aeCount =
    data.scoreDistribution.find((d) => d.score === "AE")?.count ?? 0;
  const beCount =
    data.scoreDistribution.find((d) => d.score === "BE")?.count ?? 0;
  const eePercent =
    data.scoreDistribution.find((d) => d.score === "EE")?.percent ?? 0;

  return (
    <div className="space-y-6">
      {/* KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {(
          [
            {
              label: "Coverage Rate",
              value: `${data.coverageRate}%`,
              sub: "students assessed",
              color: "text-amber-400",
            },
            {
              label: "Avg Performance",
              value: data.avgMean.toFixed(1),
              sub: "weighted mean (1–4)",
              color: "text-sky-400",
            },
            {
              label: "EE Rate",
              value: `${eePercent}%`,
              sub: "exceeds expectation",
              color: "text-emerald-400",
            },
            {
              label: "Assessments",
              value: data.totalAssessments.toLocaleString(),
              sub: "strand records",
              color: "text-violet-400",
            },
          ] as const
        ).map(({ label, value, sub, color }) => (
          <div
            key={label}
            className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4 text-center"
          >
            <p className={`text-2xl font-black tabular-nums ${color}`}>
              {value}
            </p>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-white/30 mt-0.5">
              {label}
            </p>
            <p className="text-[9px] text-white/20 mt-0.5">{sub}</p>
          </div>
        ))}
      </div>

      {/* Score distribution: donut + legend */}
      <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6">
        <h3 className="text-sm font-bold uppercase tracking-widest text-white/40 mb-5">
          School-Wide CBC Score Distribution
        </h3>
        <div className="flex flex-col sm:flex-row items-center gap-8">
          <div className="shrink-0">
            <Donut
              segments={[
                { value: eeCount, color: "#34d399" },
                { value: meCount, color: "#38bdf8" },
                { value: aeCount, color: "#f59e0b" },
                { value: beCount, color: "#fb7185" },
              ]}
              size={140}
              label={data.totalAssessments.toLocaleString()}
              sublabel="strands"
            />
          </div>
          <div className="flex-1 w-full space-y-3">
            {(["EE", "ME", "AE", "BE"] as const).map((score) => {
              const item = data.scoreDistribution.find(
                (d) => d.score === score,
              )!;
              const s = SS[score];
              return (
                <div key={score}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <div className={`w-2.5 h-2.5 rounded-sm ${s.bar}`} />
                      <span className="text-xs text-white/60">
                        {score} — {s.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`text-xs font-bold ${s.text}`}>
                        {item?.percent ?? 0}%
                      </span>
                      <span className="text-[10px] text-white/25">
                        {item?.count.toLocaleString() ?? 0}
                      </span>
                    </div>
                  </div>
                  <div className="h-1.5 rounded-full bg-white/[0.05] overflow-hidden">
                    <div
                      className={`h-full rounded-full ${s.bar} transition-all duration-700`}
                      style={{ width: `${item?.percent ?? 0}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Grade performance table */}
      <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] overflow-hidden">
        <div className="px-6 py-4 border-b border-white/[0.06]">
          <h3 className="text-sm font-bold text-white">
            Grade Performance Summary
          </h3>
        </div>
        {data.gradeSnapshots.length === 0 ? (
          <p className="text-sm text-white/30 py-12 text-center">
            No grade data yet — assessments appear here once teachers submit
            scores.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.07] bg-white/[0.02]">
                  {[
                    "Grade",
                    "Level",
                    "Enrolled",
                    "Assessed",
                    "Coverage",
                    "Mean",
                    "Distribution",
                  ].map((h) => (
                    <th
                      key={h}
                      className={[
                        "px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-white/30",
                        h === "Distribution"
                          ? "min-w-[160px] text-left"
                          : h === "Enrolled" ||
                              h === "Assessed" ||
                              h === "Coverage"
                            ? "text-center"
                            : "text-left",
                      ].join(" ")}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {data.gradeSnapshots.map((g) => {
                  const dom = meanLabel(g.weightedMean);
                  const s = SS[dom];
                  const lc = LEVEL_COLOR[g.level] ?? LEVEL_COLOR.lower_primary!;
                  return (
                    <tr
                      key={g.grade}
                      className="hover:bg-white/[0.02] transition-colors"
                    >
                      <td className="px-4 py-3 font-semibold text-white">
                        {g.grade}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`text-[9px] font-bold px-2 py-0.5 rounded border ${lc.bg} ${lc.border} ${lc.text}`}
                        >
                          {LEVEL_LABEL[g.level]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center font-mono text-xs text-white/60">
                        {g.studentCount}
                      </td>
                      <td className="px-4 py-3 text-center font-mono text-xs text-white/50">
                        {g.assessedCount}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <div className="w-12 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                            <div
                              className="h-full rounded-full bg-amber-400 transition-all"
                              style={{ width: `${g.coverageRate}%` }}
                            />
                          </div>
                          <span className="text-[10px] text-white/40">
                            {g.coverageRate}%
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {g.weightedMean > 0 ? (
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-lg ${s.bg} ${s.border} border ${s.text}`}
                          >
                            {g.weightedMean.toFixed(1)} · {dom}
                          </span>
                        ) : (
                          <span className="text-xs text-white/20">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <ScoreBar
                          ee={g.eeCount}
                          me={g.meCount}
                          ae={g.aeCount}
                          be={g.beCount}
                          h="h-2.5"
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
    </div>
  );
}
