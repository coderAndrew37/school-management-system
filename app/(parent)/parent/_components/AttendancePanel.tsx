"use client";

import { useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  XCircle,
  Clock,
  BookOpen,
  TrendingUp,
} from "lucide-react";
import type { AttendanceRecord, AttendanceStatus } from "@/lib/types/parent";

const FULL_MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
const DAYS = ["M", "T", "W", "T", "F", "S", "S"];

// Fixed keys to PascalCase to match the AttendanceStatus type definition
const S: Record<
  AttendanceStatus,
  {
    statBg: string;
    statBorder: string;
    statText: string;
    statIcon: string;
    calBg: string;
    calText: string;
    rowBg: string;
    rowBorder: string;
    rowText: string;
    dot: string;
    label: string;
    icon: React.ReactNode;
  }
> = {
  Present: {
    statBg: "bg-emerald-50",
    statBorder: "border-emerald-200",
    statText: "text-emerald-700",
    statIcon: "bg-emerald-100",
    calBg: "bg-emerald-100",
    calText: "text-emerald-700",
    rowBg: "bg-emerald-50",
    rowBorder: "border-emerald-200",
    rowText: "text-emerald-700",
    dot: "bg-emerald-500",
    label: "Present",
    icon: <CheckCircle2 className="h-4 w-4" />,
  },
  Absent: {
    statBg: "bg-red-50",
    statBorder: "border-red-200",
    statText: "text-red-700",
    statIcon: "bg-red-100",
    calBg: "bg-red-100",
    calText: "text-red-700",
    rowBg: "bg-red-50",
    rowBorder: "border-red-200",
    rowText: "text-red-700",
    dot: "bg-red-500",
    label: "Absent",
    icon: <XCircle className="h-4 w-4" />,
  },
  Late: {
    statBg: "bg-amber-50",
    statBorder: "border-amber-200",
    statText: "text-amber-700",
    statIcon: "bg-amber-100",
    calBg: "bg-amber-100",
    calText: "text-amber-700",
    rowBg: "bg-amber-50",
    rowBorder: "border-amber-200",
    rowText: "text-amber-700",
    dot: "bg-amber-500",
    label: "Late",
    icon: <Clock className="h-4 w-4" />,
  },
  Excused: {
    statBg: "bg-cyan-50",
    statBorder: "border-cyan-200",
    statText: "text-cyan-700",
    statIcon: "bg-cyan-100",
    calBg: "bg-cyan-100",
    calText: "text-cyan-700",
    rowBg: "bg-cyan-50",
    rowBorder: "border-cyan-200",
    rowText: "text-cyan-700",
    dot: "bg-cyan-500",
    label: "Excused",
    icon: <BookOpen className="h-4 w-4" />,
  },
};

interface Props {
  records: AttendanceRecord[];
  studentName: string;
}

export function AttendancePanel({ records, studentName }: Props) {
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());

  const byDate: Record<string, AttendanceRecord> = {};
  for (const r of records) byDate[r.date] = r;

  const firstDay = new Date(viewYear, viewMonth, 1);
  const startOffset = (firstDay.getDay() + 6) % 7;
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

  const prevMonth = () =>
    viewMonth === 0
      ? (setViewYear((y) => y - 1), setViewMonth(11))
      : setViewMonth((m) => m - 1);
  const nextMonth = () =>
    viewMonth === 11
      ? (setViewYear((y) => y + 1), setViewMonth(0))
      : setViewMonth((m) => m + 1);

  const monthRecords = records.filter((r) => {
    const d = new Date(r.date);
    return d.getFullYear() === viewYear && d.getMonth() === viewMonth;
  });

  // Updated initialization with PascalCase keys
  const counts = { Present: 0, Late: 0, Absent: 0, Excused: 0 } as Record<
    AttendanceStatus,
    number
  >;
  for (const r of monthRecords) counts[r.status]++;

  // Updated rate calculation to use correct keys
  const rate =
    monthRecords.length > 0
      ? Math.round(((counts.Present + counts.Late) / monthRecords.length) * 100)
      : null;

  // Updated filter with PascalCase
  const issues = records
    .filter((r) => r.status === "Absent" || r.status === "Late")
    .slice(0, 8);

  return (
    <div className="space-y-4">
      {/* ── Stat cards ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-4 gap-2.5">
        {(["Present", "Absent", "Late", "Excused"] as AttendanceStatus[]).map(
          (s) => (
            <div
              key={s}
              className={`rounded-2xl border ${S[s].statBorder} ${S[s].statBg} p-3 text-center shadow-sm`}
            >
              <div
                className={`mx-auto mb-2 flex h-8 w-8 items-center justify-center rounded-xl ${S[s].statIcon} ${S[s].statText}`}
              >
                {S[s].icon}
              </div>
              <p
                className={`text-2xl font-black tabular-nums ${S[s].statText}`}
              >
                {counts[s]}
              </p>
              <p className="mt-0.5 text-[9px] font-bold uppercase tracking-wider text-slate-400">
                {S[s].label}
              </p>
            </div>
          ),
        )}
      </div>

      {/* ── Attendance rate ────────────────────────────────────────────────── */}
      {rate !== null && (
        <div
          className={[
            "flex items-center gap-3 rounded-2xl border px-4 py-3 shadow-sm",
            rate >= 90
              ? "border-emerald-200 bg-emerald-50"
              : rate >= 75
                ? "border-amber-200  bg-amber-50"
                : "border-red-200 bg-red-50",
          ].join(" ")}
        >
          <TrendingUp
            className={`h-5 w-5 flex-shrink-0 ${rate >= 90 ? "text-emerald-600" : rate >= 75 ? "text-amber-600" : "text-red-600"}`}
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Monthly attendance rate
              </p>
              <p
                className={`text-sm font-black tabular-nums ${rate >= 90 ? "text-emerald-700" : rate >= 75 ? "text-amber-700" : "text-red-700"}`}
              >
                {rate}%
              </p>
            </div>
            <div className="h-2 w-full rounded-full bg-white/80 border border-slate-200 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-700 ${rate >= 90 ? "bg-emerald-500" : rate >= 75 ? "bg-amber-500" : "bg-red-500"}`}
                style={{ width: `${rate}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* ── Calendar ──────────────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm">
        {/* Month nav */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50">
          <button
            onClick={prevMonth}
            aria-label="previous month"
            className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition hover:border-blue-300 hover:text-blue-600 hover:bg-blue-50 active:scale-90 shadow-sm"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div className="text-center">
            <p className="text-sm font-black text-slate-800">
              {FULL_MONTHS[viewMonth]} {viewYear}
            </p>
            <p className="text-[10px] font-semibold text-slate-400">
              {monthRecords.length} days recorded
            </p>
          </div>
          <button
            onClick={nextMonth}
            aria-label="next month"
            className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition hover:border-blue-300 hover:text-blue-600 hover:bg-blue-50 active:scale-90 shadow-sm"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        <div className="p-3">
          {/* Day headers */}
          <div className="grid grid-cols-7 mb-1">
            {DAYS.map((d, i) => (
              <div
                key={`${d}${i}`}
                className="text-center text-[10px] font-black uppercase tracking-wider text-slate-400 py-1"
              >
                {d}
              </div>
            ))}
          </div>

          {/* Day cells */}
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: startOffset }).map((_, i) => (
              <div key={`e${i}`} />
            ))}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const ds = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
              const rec = byDate[ds];
              const sc = rec ? S[rec.status] : null;
              const isToday = ds === today.toISOString().slice(0, 10);
              const isWeek = (startOffset + i) % 7 >= 5;
              return (
                <div
                  key={day}
                  title={
                    rec
                      ? `${rec.status}${rec.notes ? ": " + rec.notes : ""}`
                      : ds
                  }
                  className={[
                    "flex flex-col items-center justify-center rounded-lg aspect-square text-[11px] font-bold transition-all",
                    isToday ? "ring-2 ring-blue-500 ring-offset-1" : "",
                    isWeek ? "bg-slate-50 text-slate-300" : "",
                    !isWeek && sc ? `${sc.calBg} ${sc.calText}` : "",
                    !isWeek && !sc ? "text-slate-500 hover:bg-slate-50" : "",
                  ].join(" ")}
                >
                  <span>{day}</span>
                  {rec && !isWeek && (
                    <span className="text-[7px] font-black opacity-60 -mt-0.5">
                      {rec.status[0].toUpperCase()}
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Legend */}
          <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap gap-x-4 gap-y-1">
            {(
              ["Present", "Late", "Absent", "Excused"] as AttendanceStatus[]
            ).map((s) => (
              <span
                key={s}
                className={`flex items-center gap-1.5 text-[10px] font-bold ${S[s].statText}`}
              >
                <span className={`h-2 w-2 rounded-full ${S[s].dot}`} />
                {S[s].label}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* ── Recent issues ──────────────────────────────────────────────────── */}
      {issues.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm">
          <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">
              Absences & Late Arrivals
            </p>
          </div>
          <div className="divide-y divide-slate-100">
            {issues.map((r) => {
              const sc = S[r.status];
              return (
                <div
                  key={r.id}
                  className={`flex items-center gap-3 px-4 py-3 ${sc.rowBg}`}
                >
                  <span
                    className={`flex-shrink-0 flex h-8 w-8 items-center justify-center rounded-xl ${sc.statIcon} ${sc.statText}`}
                  >
                    {sc.icon}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-bold ${sc.rowText}`}>
                      {new Date(r.date + "T00:00:00").toLocaleDateString(
                        "en-KE",
                        { weekday: "short", day: "numeric", month: "long" },
                      )}
                    </p>
                    {r.notes && (
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        {r.notes}
                      </p>
                    )}
                  </div>
                  <span
                    className={`flex-shrink-0 rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${sc.rowBg} ${sc.rowBorder} ${sc.rowText}`}
                  >
                    {sc.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {records.length === 0 && (
        <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 py-14 text-center">
          <p className="text-3xl mb-2">📅</p>
          <p className="text-sm font-bold text-slate-500">
            No attendance records yet
          </p>
        </div>
      )}
    </div>
  );
}
