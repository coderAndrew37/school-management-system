"use client";

// app/admin/heatmap/_components/HeatmapClient.tsx

import type { HeatmapData, CbcScore, HeatmapCell } from "@/lib/data/heatmap";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import { ChevronLeft, Info } from "lucide-react";

interface Props {
  data: HeatmapData;
}

// ── Score styling ──────────────────────────────────────────────────────────────
const SCORE_META: Record<
  CbcScore,
  {
    label: string;
    bg: string;
    text: string;
    border: string;
    ring: string;
    intensity: number;
  }
> = {
  EE: {
    label: "Exceeding",
    bg: "bg-emerald-500",
    text: "text-white",
    border: "border-emerald-600",
    ring: "ring-emerald-300",
    intensity: 1.0,
  },
  ME: {
    label: "Meeting",
    bg: "bg-sky-400",
    text: "text-white",
    border: "border-sky-500",
    ring: "ring-sky-300",
    intensity: 0.75,
  },
  AE: {
    label: "Approaching",
    bg: "bg-amber-400",
    text: "text-amber-950",
    border: "border-amber-500",
    ring: "ring-amber-300",
    intensity: 0.5,
  },
  BE: {
    label: "Below",
    bg: "bg-rose-500",
    text: "text-white",
    border: "border-rose-600",
    ring: "ring-rose-300",
    intensity: 0.25,
  },
};

// Tailwind opacity classes mapped to avg (1–4)
function cellBg(score: CbcScore, avg: number): string {
  // Gradient within each band — slightly lighter at the lower end
  const base = {
    EE: "bg-emerald-500",
    ME: "bg-sky-400",
    AE: "bg-amber-400",
    BE: "bg-rose-500",
  }[score];
  return base;
}

function Tooltip({ cell }: { cell: HeatmapCell }) {
  const meta = SCORE_META[cell.cbcScore];
  return (
    <div className="absolute z-30 bottom-full left-1/2 -translate-x-1/2 mb-2 w-44 rounded-xl bg-slate-900 border border-slate-700 shadow-2xl p-3 text-left pointer-events-none">
      <p className="text-xs font-black text-white mb-1">{cell.subject}</p>
      <p className="text-[10px] text-slate-400 mb-2">{cell.grade}</p>
      <div className="flex items-center gap-2 mb-1.5">
        <span
          className={`text-xs font-black px-2 py-0.5 rounded-lg ${meta.bg} ${meta.text}`}
        >
          {cell.cbcScore}
        </span>
        <span className="text-xs font-bold text-white">{meta.label}</span>
      </div>
      <p className="text-[10px] text-slate-400">
        Avg: {cell.avg.toFixed(2)} / 4.0
      </p>
      <p className="text-[10px] text-slate-400">
        {cell.studentCount} students assessed
      </p>
      <p className="text-[10px] text-slate-400">{cell.count} records total</p>
      {/* Arrow */}
      <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-slate-700" />
    </div>
  );
}

function Cell({ cell }: { cell: HeatmapCell }) {
  const [hovered, setHovered] = useState(false);
  const meta = SCORE_META[cell.cbcScore];

  return (
    <td
      className="relative p-0.5 cursor-default"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div
        className={`
          w-full h-10 rounded-lg flex items-center justify-center
          text-[11px] font-black border transition-all duration-150
          ${cellBg(cell.cbcScore, cell.avg)} ${meta.text} ${meta.border}
          ${hovered ? `ring-2 ${meta.ring} scale-110 z-10 relative` : ""}
        `}
      >
        {cell.cbcScore}
      </div>
      {hovered && <Tooltip cell={cell} />}
    </td>
  );
}

function EmptyCell() {
  return (
    <td className="p-0.5">
      <div className="w-full h-10 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center">
        <span className="text-slate-300 text-[10px] font-bold">—</span>
      </div>
    </td>
  );
}

export function HeatmapClient({ data }: Props) {
  const router = useRouter();
  const sp = useSearchParams();
  const [term, setTerm] = useState(data.term);

  function changeTerm(t: number) {
    setTerm(t);
    const params = new URLSearchParams(sp.toString());
    params.set("term", String(t));
    router.push(`?${params.toString()}`);
  }

  // Build lookup: grade+subject → cell
  const cellMap = new Map<string, HeatmapCell>();
  for (const c of data.cells) cellMap.set(`${c.grade}||${c.subject}`, c);

  // Column-level averages (per subject)
  const subjectAvgs = data.subjects.map((subject) => {
    const cells = data.cells.filter((c) => c.subject === subject);
    if (cells.length === 0) return null;
    const avg = cells.reduce((s, c) => s + c.avg, 0) / cells.length;
    return {
      avg,
      score:
        avg >= 3.5
          ? "EE"
          : avg >= 2.5
            ? "ME"
            : avg >= 1.5
              ? "AE"
              : ("BE" as CbcScore),
    };
  });

  // Row-level averages (per grade)
  const gradeAvgs = data.grades.map((grade) => {
    const cells = data.cells.filter((c) => c.grade === grade);
    if (cells.length === 0) return null;
    const avg = cells.reduce((s, c) => s + c.avg, 0) / cells.length;
    return {
      avg,
      score:
        avg >= 3.5
          ? "EE"
          : avg >= 2.5
            ? "ME"
            : avg >= 1.5
              ? "AE"
              : ("BE" as CbcScore),
    };
  });

  const isEmpty = data.grades.length === 0 || data.subjects.length === 0;

  return (
    <div className="min-h-screen bg-[#f5f6fa]">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 h-14 flex items-center gap-3">
          <Link
            href="/admin"
            className="text-slate-400 hover:text-slate-600 transition-colors"
          >
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <div className="flex-1">
            <p className="text-sm font-black text-slate-800">
              Class Performance Heatmap
            </p>
            <p className="text-[10px] text-slate-400 font-semibold">
              CBC score averages per grade × subject · Term {term} · {data.year}
            </p>
          </div>

          {/* Term selector */}
          <div className="flex gap-1.5 bg-slate-100 rounded-xl p-1">
            {[1, 2, 3].map((t) => (
              <button
                key={t}
                onClick={() => changeTerm(t)}
                className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-all ${
                  term === t
                    ? "bg-white text-slate-800 shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                Term {t}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6 space-y-5">
        {/* Legend */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm flex items-center gap-6 flex-wrap">
          <div className="flex items-center gap-1.5">
            <Info className="h-3.5 w-3.5 text-slate-400" />
            <span className="text-xs text-slate-500 font-semibold">
              Hover cells for details
            </span>
          </div>
          <div className="h-4 w-px bg-slate-200" />
          {(["EE", "ME", "AE", "BE"] as CbcScore[]).map((s) => {
            const m = SCORE_META[s];
            return (
              <div key={s} className="flex items-center gap-2">
                <div
                  className={`h-5 w-8 rounded-md ${m.bg} flex items-center justify-center`}
                >
                  <span className={`text-[9px] font-black ${m.text}`}>{s}</span>
                </div>
                <span className="text-xs text-slate-600">{m.label}</span>
              </div>
            );
          })}
        </div>

        {isEmpty ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-16 text-center shadow-sm">
            <p className="text-4xl mb-3">📊</p>
            <p className="text-slate-600 font-bold text-lg">
              No assessments yet
            </p>
            <p className="text-slate-400 text-sm mt-1">
              Teachers need to enter CBC scores for Term {term} · {data.year}{" "}
              first.
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table
                className="w-full border-collapse"
                style={{ minWidth: `${data.subjects.length * 80 + 160}px` }}
              >
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    {/* Grade header */}
                    <th className="text-left px-4 py-3 text-xs font-black uppercase tracking-wider text-slate-500 w-36 sticky left-0 bg-slate-50 z-10 border-r border-slate-200">
                      Grade
                    </th>
                    {/* Subject headers */}
                    {data.subjects.map((subject, i) => (
                      <th
                        key={subject}
                        className="px-1 py-3 text-center text-[10px] font-black uppercase tracking-wider text-slate-500"
                        style={{ minWidth: "72px" }}
                      >
                        <div className="flex flex-col items-center gap-1">
                          <span
                            className="truncate max-w-[68px]"
                            title={subject}
                          >
                            {subject.length > 10
                              ? subject.slice(0, 9) + "…"
                              : subject}
                          </span>
                          {/* Subject avg chip */}
                          {subjectAvgs[i] && (
                            <span
                              className={`text-[9px] font-black px-1.5 py-0.5 rounded-md ${SCORE_META[subjectAvgs[i]!.score as CbcScore].bg} ${SCORE_META[subjectAvgs[i]!.score as CbcScore].text}`}
                            >
                              {subjectAvgs[i]!.score}
                            </span>
                          )}
                        </div>
                      </th>
                    ))}
                    {/* Row avg header */}
                    <th className="px-2 py-3 text-center text-[10px] font-black uppercase tracking-wider text-slate-500 sticky right-0 bg-slate-50 border-l border-slate-200">
                      Avg
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.grades.map((grade, gi) => {
                    const rowAvg = gradeAvgs[gi];
                    return (
                      <tr
                        key={grade}
                        className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors"
                      >
                        {/* Grade label */}
                        <td className="px-4 py-1.5 sticky left-0 bg-white z-10 border-r border-slate-200">
                          <p className="text-xs font-black text-slate-700 whitespace-nowrap">
                            {grade}
                          </p>
                        </td>
                        {/* Score cells */}
                        {data.subjects.map((subject) => {
                          const cell = cellMap.get(`${grade}||${subject}`);
                          return cell ? (
                            <Cell key={subject} cell={cell} />
                          ) : (
                            <EmptyCell key={subject} />
                          );
                        })}
                        {/* Row avg */}
                        <td className="px-2 py-1.5 sticky right-0 bg-white border-l border-slate-200">
                          {rowAvg ? (
                            <div
                              className={`h-10 w-14 mx-auto rounded-lg flex flex-col items-center justify-center ${SCORE_META[rowAvg.score as CbcScore].bg} ${SCORE_META[rowAvg.score as CbcScore].text}`}
                            >
                              <span className="text-[11px] font-black">
                                {rowAvg.score}
                              </span>
                              <span className="text-[9px] opacity-80">
                                {rowAvg.avg.toFixed(1)}
                              </span>
                            </div>
                          ) : (
                            <div className="h-10 w-14 mx-auto rounded-lg bg-slate-100 flex items-center justify-center">
                              <span className="text-slate-300 text-[10px]">
                                —
                              </span>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-3 border-t border-slate-100 bg-slate-50">
              <p className="text-[10px] text-slate-400 font-semibold">
                {data.cells.length} grade–subject combinations ·{" "}
                {data.grades.length} grades · {data.subjects.length} subjects
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
