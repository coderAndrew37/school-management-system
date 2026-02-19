"use client";

import { useState } from "react";
import { DAYS, PERIOD_TIMES, PERIODS } from "@/lib/types/allocation";
import type { TimetableGrid } from "@/lib/types/allocation";

interface TimetableViewProps {
  gradeGrids: Record<string, TimetableGrid>;
  availableGrades: string[];
}

// Deterministic color per subject code
const SUBJECT_COLORS = [
  "from-amber-400/20 to-amber-600/10 border-amber-400/30 text-amber-300",
  "from-sky-400/20 to-sky-600/10 border-sky-400/30 text-sky-300",
  "from-emerald-400/20 to-emerald-600/10 border-emerald-400/30 text-emerald-300",
  "from-rose-400/20 to-rose-600/10 border-rose-400/30 text-rose-300",
  "from-violet-400/20 to-violet-600/10 border-violet-400/30 text-violet-300",
  "from-cyan-400/20 to-cyan-600/10 border-cyan-400/30 text-cyan-300",
  "from-orange-400/20 to-orange-600/10 border-orange-400/30 text-orange-300",
  "from-teal-400/20 to-teal-600/10 border-teal-400/30 text-teal-300",
];

function subjectColor(code: string): string {
  let hash = 0;
  for (let i = 0; i < code.length; i++)
    hash = code.charCodeAt(i) + ((hash << 5) - hash);
  return SUBJECT_COLORS[Math.abs(hash) % SUBJECT_COLORS.length]!;
}

// Break indicators
function isBreak(period: number): { isBreak: boolean; label: string } {
  if (period === 3)
    return { isBreak: true, label: "SHORT BREAK · 10:00–10:20" };
  if (period === 6) return { isBreak: true, label: "LUNCH · 12:50–1:30" };
  return { isBreak: false, label: "" };
}

export function TimetableView({
  gradeGrids,
  availableGrades,
}: TimetableViewProps) {
  const [selectedGrade, setSelectedGrade] = useState<string>(
    availableGrades[0] ?? "",
  );

  const grid = gradeGrids[selectedGrade] ?? {};

  // Count lessons and unique subjects for the selected grade
  const cells = Object.values(grid).filter(Boolean);
  const uniqueSubjects = new Set(cells.map((c) => c!.subjectCode)).size;

  return (
    <div className="space-y-5">
      {/* Grade tabs */}
      <div className="flex flex-wrap gap-2">
        {availableGrades.map((grade) => (
          <button
            key={grade}
            onClick={() => setSelectedGrade(grade)}
            className={`rounded-xl px-4 py-2 text-xs font-semibold transition-all duration-200 ${
              grade === selectedGrade
                ? "bg-amber-400 text-[#0c0f1a] shadow-lg shadow-amber-400/20"
                : "border border-white/10 text-white/50 hover:text-white hover:border-white/20 hover:bg-white/5"
            }`}
          >
            {grade}
          </button>
        ))}
      </div>

      {availableGrades.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 rounded-2xl border border-dashed border-white/10">
          <p className="text-4xl mb-3">📅</p>
          <p className="text-white/40 text-sm font-medium">
            No timetable generated yet
          </p>
          <p className="text-white/25 text-xs mt-1">
            Go to Subject Allocation and click "Generate Timetable"
          </p>
        </div>
      ) : (
        <>
          {/* Grade stats */}
          <div className="flex items-center gap-4 text-xs text-white/40">
            <span className="font-semibold text-white">{selectedGrade}</span>
            <span>·</span>
            <span>{cells.length} lessons/week</span>
            <span>·</span>
            <span>{uniqueSubjects} subjects</span>
          </div>

          {/* Timetable grid — scrollable horizontally on mobile */}
          <div className="overflow-x-auto rounded-2xl border border-white/[0.08]">
            <table className="w-full min-w-[700px] border-collapse">
              <thead>
                <tr className="bg-white/[0.04]">
                  <th className="w-28 px-4 py-3.5 text-left text-[10px] font-semibold uppercase tracking-widest text-white/30 border-b border-r border-white/[0.07]">
                    Period
                  </th>
                  {DAYS.map((day) => (
                    <th
                      key={day}
                      className="px-3 py-3.5 text-center text-[10px] font-semibold uppercase tracking-widest text-white/50 border-b border-white/[0.07]"
                    >
                      {day}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {PERIODS.map((period) => {
                  const breakInfo = isBreak(period - 1);
                  return (
                    <>
                      {/* Break row after period 3 and 6 */}
                      {breakInfo.isBreak && (
                        <tr key={`break-${period}`}>
                          <td
                            colSpan={6}
                            className="px-4 py-2 text-center text-[10px] font-semibold uppercase tracking-widest text-white/20 bg-white/[0.02] border-b border-white/[0.04]"
                          >
                            {breakInfo.label}
                          </td>
                        </tr>
                      )}
                      <tr
                        key={period}
                        className="group hover:bg-white/[0.02] transition-colors"
                      >
                        {/* Period label */}
                        <td className="px-4 py-2 border-b border-r border-white/[0.05] align-top">
                          <p className="text-xs font-bold text-white/60">
                            P{period}
                          </p>
                          <p className="text-[10px] font-mono text-white/25 mt-0.5">
                            {PERIOD_TIMES[period]}
                          </p>
                        </td>

                        {/* Day cells */}
                        {DAYS.map((_, dayIdx) => {
                          const dayNum = dayIdx + 1;
                          const key = `${dayNum}-${period}`;
                          const cell = grid[key];

                          return (
                            <td
                              key={dayIdx}
                              className="px-2 py-2 border-b border-white/[0.05] text-center align-middle"
                            >
                              {cell ? (
                                <div
                                  className={`rounded-lg border bg-gradient-to-br px-2 py-2 ${subjectColor(cell.subjectCode)}`}
                                >
                                  <p className="text-[10px] font-bold font-mono uppercase tracking-wider mb-0.5">
                                    {cell.subjectCode}
                                  </p>
                                  <p className="text-[10px] leading-tight text-white/70 truncate max-w-[100px] mx-auto">
                                    {cell.subjectName}
                                  </p>
                                  <p className="text-[9px] text-white/35 mt-1 truncate max-w-[100px] mx-auto">
                                    {cell.teacherName.split(" ")[0]}
                                  </p>
                                </div>
                              ) : (
                                <div className="h-14 rounded-lg border border-dashed border-white/[0.05] flex items-center justify-center">
                                  <span className="text-[10px] text-white/10">
                                    —
                                  </span>
                                </div>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
