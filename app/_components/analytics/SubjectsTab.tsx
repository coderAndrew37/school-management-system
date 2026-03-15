"use client";

// app/_components/analytics/SubjectsTab.tsx

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import type { SubjectSnapshot } from "@/lib/data/analytics";
import { SS, meanLabel } from "./analytics-constants";
import { ScoreBar } from "./AnalyticsCharts";

interface Props {
  subjectLeaderboard: {
    subjectName: string;
    weightedMean: number;
    total: number;
  }[];
  snapshots: SubjectSnapshot[];
}

export function SubjectsTab({ subjectLeaderboard, snapshots }: Props) {
  const [filter, setFilter] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  const filtered = subjectLeaderboard.filter((s) =>
    s.subjectName.toLowerCase().includes(filter.toLowerCase()),
  );

  const SCORE_COLS = [
    "text-emerald-400",
    "text-sky-400",
    "text-amber-400",
    "text-rose-400",
  ] as const;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter subjects…"
          className="flex-1 max-w-xs rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-2.5 text-sm text-white placeholder-white/20 outline-none focus:border-amber-400/50 transition-colors"
        />
        <span className="text-xs text-white/30">
          {filtered.length} subjects
        </span>
      </div>

      <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] overflow-hidden">
        {filtered.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-sm text-white/30">
              No subjects match &quot;{filter}&quot;
            </p>
          </div>
        ) : (
          <div className="divide-y divide-white/[0.04]">
            {filtered.map((s, i) => {
              const dom = meanLabel(s.weightedMean);
              const style = SS[dom];
              const detail = snapshots.filter(
                (x) => x.subjectName === s.subjectName,
              );
              const aggEe = detail.reduce((a, x) => a + x.eeCount, 0);
              const aggMe = detail.reduce((a, x) => a + x.meCount, 0);
              const aggAe = detail.reduce((a, x) => a + x.aeCount, 0);
              const aggBe = detail.reduce((a, x) => a + x.beCount, 0);
              const isOpen = expanded === s.subjectName;

              return (
                <div key={s.subjectName}>
                  <button
                    onClick={() => setExpanded(isOpen ? null : s.subjectName)}
                    className="w-full flex items-center gap-4 px-5 py-4 hover:bg-white/[0.02] transition-colors text-left"
                  >
                    <span className="text-[10px] font-black text-white/20 w-5 text-right shrink-0">
                      {i + 1}
                    </span>
                    <div className="flex-1 min-w-0 space-y-2">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-white">
                            {s.subjectName}
                          </p>
                          <p className="text-[10px] text-white/30">
                            {s.total.toLocaleString()} strand records ·{" "}
                            {detail.length} grade
                            {detail.length !== 1 ? "s" : ""}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span
                            className={`text-xs font-bold px-2.5 py-1 rounded-lg ${style.bg} ${style.border} border ${style.text}`}
                          >
                            {s.weightedMean.toFixed(1)} · {dom}
                          </span>
                          {isOpen ? (
                            <ChevronUp className="h-3.5 w-3.5 text-white/30" />
                          ) : (
                            <ChevronDown className="h-3.5 w-3.5 text-white/30" />
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                          <div
                            className={`h-full rounded-full ${style.bar} transition-all duration-500`}
                            style={{
                              width: `${((s.weightedMean - 1) / 3) * 100}%`,
                            }}
                          />
                        </div>
                        <ScoreBar
                          ee={aggEe}
                          me={aggMe}
                          ae={aggAe}
                          be={aggBe}
                          h="h-1.5"
                        />
                      </div>
                    </div>
                  </button>

                  {isOpen && (
                    <div className="px-5 pb-4 bg-white/[0.01]">
                      <div className="rounded-xl border border-white/[0.06] overflow-hidden">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-white/[0.06] bg-white/[0.02]">
                              {[
                                "Grade",
                                "Records",
                                "Mean",
                                "EE",
                                "ME",
                                "AE",
                                "BE",
                              ].map((h) => (
                                <th
                                  key={h}
                                  className="px-3 py-2 text-[9px] font-bold uppercase tracking-wider text-white/30 text-left"
                                >
                                  {h}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-white/[0.04]">
                            {[...detail]
                              .sort((a, b) => b.weightedMean - a.weightedMean)
                              .map((d) => {
                                const ds = SS[meanLabel(d.weightedMean)];
                                return (
                                  <tr
                                    key={d.grade}
                                    className="hover:bg-white/[0.02]"
                                  >
                                    <td className="px-3 py-2 text-xs font-semibold text-white">
                                      {d.grade}
                                    </td>
                                    <td className="px-3 py-2 text-xs text-white/40 font-mono">
                                      {d.total}
                                    </td>
                                    <td className="px-3 py-2">
                                      <span
                                        className={`text-[10px] font-bold ${ds.text}`}
                                      >
                                        {d.weightedMean.toFixed(1)}
                                      </span>
                                    </td>
                                    {[
                                      d.eePercent,
                                      d.mePercent,
                                      d.aePercent,
                                      d.bePercent,
                                    ].map((pct, pi) => (
                                      <td
                                        key={pi}
                                        className={`px-3 py-2 text-xs font-mono ${SCORE_COLS[pi]}`}
                                      >
                                        {pct}%
                                      </td>
                                    ))}
                                  </tr>
                                );
                              })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
