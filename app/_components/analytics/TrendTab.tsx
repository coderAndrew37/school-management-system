"use client";

import { ArrowDown, ArrowUp, Minus } from "lucide-react";
import type {
  TermComparisonRow,
  AttendanceSnapshot,
} from "@/lib/data/analytics";
import { HBar } from "./AnalyticsCharts";

interface Props {
  termComparison: TermComparisonRow[];
  attendance: AttendanceSnapshot[];
  admissions: { month: string; count: number }[];
}

export function TrendTab({ termComparison, attendance, admissions }: Props) {
  const hasTermData = termComparison.some(
    (r) => r.t1 > 0 || r.t2 > 0 || r.t3 > 0,
  );

  return (
    <div className="space-y-6">
      {/* Term-over-term comparison */}
      <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6">
        <h3 className="text-sm font-bold text-white mb-1">
          Term-over-Term Performance
        </h3>
        <p className="text-[10px] text-white/30 mb-5">
          Weighted mean by grade across all terms this year
        </p>

        {!hasTermData ? (
          <p className="text-sm text-white/30 py-8 text-center">
            No multi-term data yet — appears once assessments are submitted
            across terms.
          </p>
        ) : (
          <div className="space-y-5">
            <div className="flex gap-4 text-[10px]">
              {[
                { label: "Term 1", color: "bg-amber-400" },
                { label: "Term 2", color: "bg-sky-400" },
                { label: "Term 3", color: "bg-emerald-400" },
              ].map(({ label, color }) => (
                <div
                  key={label}
                  className="flex items-center gap-1.5 text-white/40"
                >
                  <div className={`w-2.5 h-2.5 rounded-sm ${color}`} />
                  {label}
                </div>
              ))}
            </div>

            {termComparison
              .filter((r) => r.t1 > 0 || r.t2 > 0 || r.t3 > 0)
              .map((row) => {
                const deltaEl =
                  row.delta > 0 ? (
                    <span className="flex items-center gap-0.5 text-emerald-400">
                      <ArrowUp className="h-2.5 w-2.5" />
                      {row.delta.toFixed(1)}
                    </span>
                  ) : row.delta < 0 ? (
                    <span className="flex items-center gap-0.5 text-rose-400">
                      <ArrowDown className="h-2.5 w-2.5" />
                      {Math.abs(row.delta).toFixed(1)}
                    </span>
                  ) : (
                    <span className="flex items-center gap-0.5 text-white/25">
                      <Minus className="h-2.5 w-2.5" />—
                    </span>
                  );

                return (
                  <div key={row.grade} className="space-y-1">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold text-white">
                        {row.grade}
                      </p>
                      <div className="text-[10px]">{deltaEl}</div>
                    </div>
                    <div className="space-y-1">
                      {[
                        { val: row.t1, color: "bg-amber-400", label: "T1" },
                        { val: row.t2, color: "bg-sky-400", label: "T2" },
                        { val: row.t3, color: "bg-emerald-400", label: "T3" },
                      ].map(({ val, color, label }) => (
                        <div key={label} className="flex items-center gap-2">
                          <span
                            className={`text-[9px] w-5 ${val > 0 ? "text-white/25" : "text-white/15"}`}
                          >
                            {label}
                          </span>
                          <div
                            className={`flex-1 h-2 rounded-full overflow-hidden ${val > 0 ? "bg-white/[0.06]" : "bg-white/[0.03]"}`}
                          >
                            {val > 0 && (
                              <div
                                className={`h-full rounded-full ${color} transition-all duration-700`}
                                style={{ width: `${((val - 1) / 3) * 100}%` }}
                              />
                            )}
                          </div>
                          <span
                            className={`text-[10px] font-mono w-8 text-right ${val > 0 ? "text-white/50" : "text-white/15"}`}
                          >
                            {val > 0 ? val.toFixed(1) : "—"}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
          </div>
        )}
      </div>

      {/* Attendance by grade */}
      <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6">
        <h3 className="text-sm font-bold text-white mb-1">
          Attendance by Grade
        </h3>
        <p className="text-[10px] text-white/30 mb-5">
          This term attendance rate (green ≥ 90% · amber ≥ 75% · red below)
        </p>
        {attendance.length === 0 ? (
          <p className="text-sm text-white/30 py-8 text-center">
            No attendance records for this term yet.
          </p>
        ) : (
          <div className="space-y-4">
            {attendance.map((a) => (
              <HBar
                key={a.grade}
                label={a.grade}
                sublabel={`${a.presentCount} present · ${a.absentCount} absent · ${a.lateCount} late`}
                value={a.rate}
                max={100}
                color={
                  a.rate >= 90
                    ? "bg-emerald-400"
                    : a.rate >= 75
                      ? "bg-amber-400"
                      : "bg-rose-400"
                }
                right={
                  <span
                    className={`text-sm font-bold ${
                      a.rate >= 90
                        ? "text-emerald-400"
                        : a.rate >= 75
                          ? "text-amber-400"
                          : "text-rose-400"
                    }`}
                  >
                    {a.rate}%
                  </span>
                }
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
