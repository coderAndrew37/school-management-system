"use client";

import type {
  AttendanceRecord,
  AttendanceStatus,
  ChildWithAssessments,
} from "@/lib/types/parent";
import { STATUS_COLOR } from "@/lib/types/parent";
import {
  CalendarCheck,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
} from "lucide-react";
import { useState } from "react";

interface Props {
  attendance: AttendanceRecord[];
  child: ChildWithAssessments;
  allChildren: ChildWithAssessments[];
}

const STATUS_EMOJI: Record<AttendanceStatus, string> = {
  Present: "✅",
  Late: "🕐",
  Absent: "❌",
  Excused: "📋",
};

function getMonthDays(year: number, month: number) {
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const startDay = first.getDay(); // 0=Sun
  const days: (number | null)[] = Array(startDay).fill(null);
  for (let d = 1; d <= last.getDate(); d++) days.push(d);
  return days;
}

export function AttendancePageClient({ attendance, child, allChildren }: Props) {
  const now = new Date();
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth());

  // Build a lookup: "YYYY-MM-DD" → AttendanceStatus
  const byDate = new Map<string, AttendanceStatus>();
  for (const r of attendance) byDate.set(r.date.slice(0, 10), r.status);

  const days = getMonthDays(viewYear, viewMonth);

  // Stats for currently viewed month
  const monthRecords = attendance.filter((r) => {
    const d = new Date(r.date);
    return d.getFullYear() === viewYear && d.getMonth() === viewMonth;
  });
  const countOf = (s: AttendanceStatus) =>
    monthRecords.filter((r) => r.status === s).length;
  const total = monthRecords.length;
  const rate =
    total > 0
      ? Math.round(((countOf("Present") + countOf("Late")) / total) * 100)
      : null;

  // Overall stats
  const allTotal = attendance.length;
  const allPresent = attendance.filter(
    (r) => r.status === "Present" || r.status === "Late",
  ).length;
  const allRate =
    allTotal > 0 ? Math.round((allPresent / allTotal) * 100) : null;

  function prevMonth() {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else setViewMonth((m) => m - 1);
  }
  function nextMonth() {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else setViewMonth((m) => m + 1);
  }
  const canGoNext =
    viewYear < now.getFullYear() ||
    (viewYear === now.getFullYear() && viewMonth < now.getMonth());

  const monthName = new Date(viewYear, viewMonth).toLocaleDateString("en-KE", {
    month: "long",
    year: "numeric",
  });

  return (
    <div className="min-h-screen bg-[#f5f6fa]">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 h-14 flex items-center gap-3">
          <CalendarCheck className="h-5 w-5 text-sky-500 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-black text-slate-800">Attendance</p>
            <p className="text-[10px] text-slate-400 font-semibold">
              {child.full_name}
            </p>
          </div>
          {allChildren.length > 1 && (
            <div className="flex gap-1.5">
              {allChildren.map((c) => (
                <a
                  key={c.id}
                  href={`/parent/attendance?child=${c.id}`}
                  className={`text-xs font-bold px-2.5 py-1 rounded-lg border transition-all ${
                    c.id === child.id
                      ? "bg-sky-500 text-white border-sky-500"
                      : "bg-white text-slate-500 border-slate-200 hover:border-sky-300"
                  }`}
                >
                  {c.full_name.split(" ")[0]}
                </a>
              ))}
            </div>
          )}
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 space-y-5">
        {/* Overall stat bar */}
        <div className="grid grid-cols-4 gap-3">
          {(["Present", "Late", "Absent", "Excused"] as AttendanceStatus[]).map(
            (s) => {
              const c = STATUS_COLOR[s];
              const n = attendance.filter((r) => r.status === s).length;
              return (
                <div
                  key={s}
                  className={`rounded-2xl border ${c.border} bg-white p-3 text-center shadow-sm`}
                >
                  <p className="text-2xl font-black tabular-nums text-slate-800">
                    {n}
                  </p>
                  <p
                    className={`text-[9px] font-bold uppercase tracking-widest mt-0.5 ${c.text}`}
                  >
                    {s}
                  </p>
                </div>
              );
            },
          )}
        </div>

        {/* Overall rate */}
        {allRate !== null && (
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm flex items-center gap-4">
            <TrendingUp className="h-5 w-5 text-sky-500 shrink-0" />
            <div className="flex-1">
              <div className="flex justify-between items-center mb-1.5">
                <p className="text-xs font-bold text-slate-600">
                  Overall attendance rate
                </p>
                <p
                  className={`text-sm font-black tabular-nums ${allRate >= 90 ? "text-emerald-600" : allRate >= 75 ? "text-amber-600" : "text-rose-600"}`}
                >
                  {allRate}%
                </p>
              </div>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${allRate >= 90 ? "bg-emerald-400" : allRate >= 75 ? "bg-amber-400" : "bg-rose-400"}`}
                  style={{ width: `${allRate}%` }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Calendar */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {/* Month nav */}
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100">
            <button
              aria-label="previous month"
              onClick={prevMonth}
              className="h-8 w-8 rounded-xl border border-slate-200 flex items-center justify-center hover:bg-slate-50 text-slate-500 transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <div className="text-center">
              <p className="text-sm font-black text-slate-800">{monthName}</p>
              {rate !== null && (
                <p
                  className={`text-xs font-bold ${rate >= 90 ? "text-emerald-500" : rate >= 75 ? "text-amber-500" : "text-rose-500"}`}
                >
                  {rate}% this month
                </p>
              )}
            </div>
            <button
              aria-label="next month"
              onClick={nextMonth}
              disabled={!canGoNext}
              className="h-8 w-8 rounded-xl border border-slate-200 flex items-center justify-center hover:bg-slate-50 text-slate-500 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {/* Day names */}
          <div className="grid grid-cols-7 px-3 pt-2">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
              <div
                key={d}
                className="text-center text-[9px] font-black uppercase tracking-wider text-slate-300 py-1"
              >
                {d}
              </div>
            ))}
          </div>

          {/* Day cells */}
          <div className="grid grid-cols-7 gap-0.5 p-3 pt-0">
            {days.map((day, idx) => {
              if (!day) return <div key={`empty-${idx}`} />;

              const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
              const status = byDate.get(dateStr);
              const isToday =
                day === now.getDate() &&
                viewMonth === now.getMonth() &&
                viewYear === now.getFullYear();
              const isWeekend = [0, 6].includes(
                new Date(viewYear, viewMonth, day).getDay(),
              );

              return (
                <div
                  key={dateStr}
                  className={`aspect-square rounded-xl flex flex-col items-center justify-center transition-all ${
                    isWeekend
                      ? "opacity-30"
                      : status === "Present"
                        ? "bg-emerald-50"
                        : status === "Late"
                          ? "bg-amber-50"
                          : status === "Absent"
                            ? "bg-rose-50"
                            : status === "Excused"
                              ? "bg-sky-50"
                              : "bg-transparent"
                  } ${isToday ? "ring-2 ring-blue-400 ring-offset-1" : ""}`}
                >
                  <span
                    className={`text-xs font-bold ${
                      status === "Present"
                        ? "text-emerald-600"
                        : status === "Late"
                          ? "text-amber-600"
                          : status === "Absent"
                            ? "text-rose-600"
                            : status === "Excused"
                              ? "text-sky-600"
                              : "text-slate-400"
                    }`}
                  >
                    {day}
                  </span>
                  {status && (
                    <span className="text-[8px] leading-none mt-0.5">
                      {STATUS_EMOJI[status]}
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Legend */}
          <div className="flex items-center gap-4 px-5 py-3 border-t border-slate-100 flex-wrap">
            {(
              ["Present", "Late", "Absent", "Excused"] as AttendanceStatus[]
            ).map((s) => (
              <div
                key={s}
                className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-500"
              >
                <span>{STATUS_EMOJI[s]}</span>
                <span>{s}</span>
                <span className={`font-black ${STATUS_COLOR[s].text}`}>
                  ({monthRecords.filter((r) => r.status === s).length})
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Recent records list */}
        {attendance.length > 0 && (
          <div className="space-y-2">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">
              Recent Records
            </p>
            {attendance.slice(0, 15).map((r) => {
              const sc = STATUS_COLOR[r.status];
              return (
                <div
                  key={r.id}
                  className="bg-white rounded-xl border border-slate-200 px-4 py-3 flex items-center gap-3 shadow-sm"
                >
                  <span className="text-lg">{STATUS_EMOJI[r.status]}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-slate-700">
                      {new Date(r.date + "T00:00:00").toLocaleDateString(
                        "en-KE",
                        { weekday: "long", day: "numeric", month: "long" },
                      )}
                    </p>
                    {r.notes && (
                      <p className="text-xs text-slate-400 truncate">
                        {r.notes}
                      </p>
                    )}
                  </div>
                  <span
                    className={`text-xs font-bold px-2.5 py-1 rounded-xl border ${sc.bg} ${sc.text} ${sc.border}`}
                  >
                    {r.status}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {attendance.length === 0 && (
          <div className="text-center py-20 bg-white rounded-2xl border border-slate-200">
            <p className="text-3xl mb-2">📅</p>
            <p className="text-slate-500 font-semibold">
              No attendance records yet
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
