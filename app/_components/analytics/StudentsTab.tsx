"use client";

// app/_components/analytics/StudentsTab.tsx

import { useState } from "react";
import { TrendingUp, Users } from "lucide-react";
import type { StudentPerformanceSummary } from "@/lib/data/analytics";
import { SS, meanLabel } from "./analytics-constants";
import { ScoreBar } from "./AnalyticsCharts";

interface Props {
  top: StudentPerformanceSummary[];
  support: StudentPerformanceSummary[];
}

export function StudentsTab({ top, support }: Props) {
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
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.07] bg-white/[0.02]">
                  {[
                    "#",
                    "Student",
                    "Grade",
                    "Mean",
                    "Dominant",
                    "Profile",
                    "Strands",
                  ].map((h) => (
                    <th
                      key={h}
                      className={[
                        "px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-white/30",
                        h === "Student" || h === "#"
                          ? "text-left"
                          : "text-center",
                      ].join(" ")}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {list.map((s, i) => {
                  const dom = s.dominantScore ?? meanLabel(s.weightedMean);
                  const style = SS[dom];
                  const inits = s.fullName
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
                      <td className="px-4 py-3 text-[10px] font-black text-white/20">
                        {i + 1}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-amber-400/10 border border-amber-400/20 flex items-center justify-center text-[10px] font-black text-amber-400 shrink-0">
                            {inits}
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
                      <td className="px-4 py-3 text-center text-xs text-white/50">
                        {s.grade}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {s.weightedMean > 0 ? (
                          <span
                            className={`text-xs font-bold px-2 py-0.5 rounded-lg ${style.bg} ${style.border} border ${style.text}`}
                          >
                            {s.weightedMean.toFixed(1)}
                          </span>
                        ) : (
                          <span className="text-xs text-white/20">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`text-xs font-bold px-2 py-0.5 rounded-lg ${style.bg} ${style.text}`}
                        >
                          {dom}
                        </span>
                      </td>
                      <td className="px-4 py-3 min-w-[140px]">
                        <ScoreBar
                          ee={s.eeCount}
                          me={s.meCount}
                          ae={s.aeCount}
                          be={s.beCount}
                          h="h-2.5"
                        />
                      </td>
                      <td className="px-4 py-3 text-center text-[10px] text-white/30 font-mono">
                        {s.totalAssessed}
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
