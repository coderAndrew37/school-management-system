"use client";

import { useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  XCircle,
  Clock,
  BookOpen,
} from "lucide-react";
import type { AttendanceRecord, AttendanceStatus } from "@/lib/types/parent";
import { STATUS_COLOR } from "@/lib/types/parent";

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

interface Props {
  records: AttendanceRecord[];
  studentName: string;
}

export function AttendancePanel({ records, studentName }: Props) {
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());

  // Build date → record map
  const byDate: Record<string, AttendanceRecord> = {};
  for (const r of records) byDate[r.date] = r;

  // Calendar grid
  const firstDay = new Date(viewYear, viewMonth, 1);
  const startOffset = (firstDay.getDay() + 6) % 7; // Monday=0
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

  const prevMonth = () =>
    viewMonth === 0
      ? (setViewYear((y) => y - 1), setViewMonth(11))
      : setViewMonth((m) => m - 1);
  const nextMonth = () =>
    viewMonth === 11
      ? (setViewYear((y) => y + 1), setViewMonth(0))
      : setViewMonth((m) => m + 1);

  // Month stats
  const monthRecords = records.filter((r) => {
    const d = new Date(r.date);
    return d.getFullYear() === viewYear && d.getMonth() === viewMonth;
  });
  const monthCounts = { present: 0, late: 0, absent: 0, excused: 0 } as Record<
    AttendanceStatus,
    number
  >;
  for (const r of monthRecords) monthCounts[r.status]++;
  const attendanceRate =
    monthRecords.length > 0
      ? Math.round(
          ((monthCounts.present + monthCounts.late) / monthRecords.length) *
            100,
        )
      : null;

  // Recent absences (for the list)
  const recentAbsences = records
    .filter((r) => r.status === "absent" || r.status === "late")
    .slice(0, 10);

  return (
    <div className="space-y-6">
      {/* ── Stats strip ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          {
            label: "Present",
            value: monthCounts.present,
            icon: <CheckCircle2 className="h-4 w-4" />,
            cls: "text-emerald-400 border-emerald-400/20 bg-emerald-400/5",
          },
          {
            label: "Absent",
            value: monthCounts.absent,
            icon: <XCircle className="h-4 w-4" />,
            cls: "text-rose-400    border-rose-400/20    bg-rose-400/5",
          },
          {
            label: "Late",
            value: monthCounts.late,
            icon: <Clock className="h-4 w-4" />,
            cls: "text-amber-400  border-amber-400/20  bg-amber-400/5",
          },
          {
            label: "Excused",
            value: monthCounts.excused,
            icon: <BookOpen className="h-4 w-4" />,
            cls: "text-sky-400    border-sky-400/20    bg-sky-400/5",
          },
        ].map(({ label, value, icon, cls }) => (
          <div
            key={label}
            className={`rounded-xl border px-3 py-3 text-center ${cls}`}
          >
            <div className="flex justify-center mb-1">{icon}</div>
            <p className="text-xl font-bold tabular-nums">{value}</p>
            <p className="text-[10px] uppercase tracking-widest opacity-60 mt-0.5">
              {label}
            </p>
          </div>
        ))}
      </div>

      {attendanceRate !== null && (
        <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] px-5 py-3 flex items-center justify-between">
          <p className="text-sm text-white/50">Monthly attendance rate</p>
          <div className="flex items-center gap-3">
            <div className="h-2 w-40 rounded-full bg-white/[0.06] overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-700 ${attendanceRate >= 90 ? "bg-emerald-400" : attendanceRate >= 75 ? "bg-amber-400" : "bg-rose-400"}`}
                style={{ width: `${attendanceRate}%` }}
              />
            </div>
            <span
              className={`text-sm font-bold tabular-nums ${attendanceRate >= 90 ? "text-emerald-400" : attendanceRate >= 75 ? "text-amber-400" : "text-rose-400"}`}
            >
              {attendanceRate}%
            </span>
          </div>
        </div>
      )}

      {/* ── Calendar ──────────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5">
        {/* Month nav */}
        <div className="flex items-center justify-between mb-4">
          <button
            aria-label="previous month"
            onClick={prevMonth}
            className="p-1.5 rounded-lg hover:bg-white/10 text-white/40 hover:text-white transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <p className="text-sm font-bold text-white">
            {MONTHS[viewMonth]} {viewYear}
          </p>
          <button
            aria-label="next month"
            onClick={nextMonth}
            className="p-1.5 rounded-lg hover:bg-white/10 text-white/40 hover:text-white transition-colors"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        {/* Weekday headers */}
        <div className="grid grid-cols-7 mb-1">
          {DAYS.map((d) => (
            <div
              key={d}
              className="text-center text-[10px] font-semibold uppercase tracking-wider text-white/25 py-1"
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
            const d = i + 1;
            const ds = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
            const rec = byDate[ds];
            const isToday = ds === today.toISOString().slice(0, 10);
            const sc = rec ? STATUS_COLOR[rec.status] : null;
            const isWeekend = (startOffset + i) % 7 >= 5;

            return (
              <div
                key={d}
                title={
                  rec ? `${rec.status}${rec.notes ? ": " + rec.notes : ""}` : ds
                }
                className={[
                  "rounded-lg h-9 flex flex-col items-center justify-center transition-colors relative",
                  isToday ? "ring-1 ring-amber-400/60" : "",
                  isWeekend ? "opacity-40" : "",
                  rec
                    ? `${sc!.bg} ${sc!.border} border`
                    : "hover:bg-white/[0.03]",
                ].join(" ")}
              >
                <span
                  className={`text-xs font-medium ${isToday ? "text-amber-400" : rec ? sc!.text : "text-white/40"}`}
                >
                  {d}
                </span>
                {rec && (
                  <span
                    className={`text-[8px] font-bold uppercase ${sc!.text} opacity-80`}
                  >
                    {rec.status.charAt(0).toUpperCase()}
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-4 pt-4 border-t border-white/[0.06]">
          {(["present", "late", "absent", "excused"] as AttendanceStatus[]).map(
            (s) => (
              <span
                key={s}
                className={`flex items-center gap-1.5 text-[10px] ${STATUS_COLOR[s].text}`}
              >
                <span
                  className={`w-2 h-2 rounded-full ${STATUS_COLOR[s].dot}`}
                />
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </span>
            ),
          )}
        </div>
      </div>

      {/* ── Recent absences / late list ────────────────────────────────── */}
      {recentAbsences.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-white/30 mb-3">
            Recent Absences & Late Arrivals
          </p>
          <div className="space-y-2">
            {recentAbsences.map((r) => {
              const sc = STATUS_COLOR[r.status];
              return (
                <div
                  key={r.id}
                  className={`flex items-center gap-3 rounded-xl border ${sc.border} ${sc.bg} px-4 py-3`}
                >
                  <span
                    className={`text-xs font-bold uppercase px-2 py-0.5 rounded-md ${sc.text} ${sc.bg} border ${sc.border}`}
                  >
                    {r.status}
                  </span>
                  <div className="flex-1">
                    <p className={`text-sm font-medium ${sc.text}`}>
                      {new Date(r.date + "T00:00:00").toLocaleDateString(
                        "en-KE",
                        {
                          weekday: "short",
                          day: "numeric",
                          month: "long",
                        },
                      )}
                    </p>
                    {r.notes && (
                      <p className="text-xs text-white/40 mt-0.5">{r.notes}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {records.length === 0 && (
        <div className="rounded-2xl border border-dashed border-white/10 py-12 text-center">
          <p className="text-3xl mb-2">📅</p>
          <p className="text-sm text-white/40">No attendance records yet</p>
        </div>
      )}
    </div>
  );
}
