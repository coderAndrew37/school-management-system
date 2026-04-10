"use client";

import type { ClassStudent } from "@/lib/data/assessment";
import { AlertTriangle, Phone, TrendingDown, TrendingUp } from "lucide-react";
import { useState } from "react";
import type { ParentContact, Status, WeekPoint } from "./attendance-types";
import {
  AT_RISK_THRESHOLD,
  computeStats,
  getInitials,
} from "./attendance-types";
import { DonutChart, Sparkline, WeeklyBarChart } from "./AttendanceCharts";
import { ContactPopover } from "./ContactPopover";

interface Props {
  // Swapped legacy grade string for specific class metadata
  classId: string; 
  gradeName: string; 
  streamName: string;
  students: ClassStudent[];
  studentsWithParents: (ClassStudent & { parents: ParentContact[] })[];
  attendanceHistory: Record<string, { date: string; status: Status }[]>;
  classWeeklyTrend: WeekPoint[];
  todayCounts: Record<Status, number>;
  totalStudents: number;
}

export function TrendsTab({
  classId,
  gradeName,
  streamName,
  students,
  studentsWithParents,
  attendanceHistory,
  classWeeklyTrend,
  todayCounts,
  totalStudents,
}: Props) {
  const [contactId, setContactId] = useState<string | null>(null);

  // Combine names for UI display consistent with RegisterTab
  const fullClassName = `${gradeName} ${streamName}`;

  // Compute individual stats for all students
  const stats = computeStats(students, attendanceHistory);

  // Filter students who have enough data (at least 5 days) and are below the threshold
  const atRisk = stats
    .filter((s) => s.total >= 5 && s.rate < AT_RISK_THRESHOLD)
    .sort((a, b) => a.rate - b.rate);

  // Calculate 30-day class performance
  const allRecords = Object.values(attendanceHistory).flat();
  const totalRecords = allRecords.length;
  const totalAttended = allRecords.filter(
    (r) => r.status === "Present" || r.status === "Late",
  ).length;

  const classRate30d =
    totalRecords > 0 ? Math.round((totalAttended / totalRecords) * 100) : 0;

  // Calculate Week-on-Week trend
  const safeLastWeek =
    classWeeklyTrend.length > 0
      ? classWeeklyTrend[classWeeklyTrend.length - 1]
      : null;
  const safePrevWeek =
    classWeeklyTrend.length > 1
      ? classWeeklyTrend[classWeeklyTrend.length - 2]
      : null;
  const weekTrendDiff =
    safeLastWeek && safePrevWeek
      ? Math.round(safeLastWeek.rate - safePrevWeek.rate)
      : 0;

  return (
    <div className="space-y-5">
      {/* ── Overview Stats ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm text-center">
          <p
            className={`text-3xl font-black ${
              classRate30d >= 90
                ? "text-emerald-600"
                : classRate30d >= 75
                  ? "text-amber-500"
                  : "text-rose-600"
            }`}
          >
            {classRate30d}%
          </p>
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mt-1">
            Class Rate (30d)
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm text-center">
          <div className="flex items-center justify-center gap-1">
            <p
              className={`text-3xl font-black ${atRisk.length === 0 ? "text-emerald-600" : "text-rose-600"}`}
            >
              {atRisk.length}
            </p>
            {atRisk.length > 0 && (
              <AlertTriangle className="h-5 w-5 text-rose-500" />
            )}
          </div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mt-1">
            At Risk (&lt;{AT_RISK_THRESHOLD}%)
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm text-center">
          <div className="flex items-center justify-center gap-1">
            {weekTrendDiff > 0 && (
              <TrendingUp className="h-5 w-5 text-emerald-500" />
            )}
            {weekTrendDiff < 0 && (
              <TrendingDown className="h-5 w-5 text-rose-500" />
            )}
            <p
              className={`text-3xl font-black ${weekTrendDiff >= 0 ? "text-emerald-600" : "text-rose-600"}`}
            >
              {weekTrendDiff >= 0 ? "+" : ""}
              {weekTrendDiff}%
            </p>
          </div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mt-1">
            vs. Last Week
          </p>
        </div>
      </div>

      {/* ── Today's Distribution ─────────────────────────────────────────── */}
      {totalStudents > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <p className="text-xs font-black uppercase tracking-wider text-slate-500 mb-4">
            Today&apos;s Attendance Breakdown
          </p>
          <DonutChart counts={todayCounts} total={totalStudents} />
        </div>
      )}

      {/* ── Weekly Class Chart ────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <p className="text-xs font-black uppercase tracking-wider text-slate-500">
            Term Attendance History
          </p>
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
            Last 6 weeks
          </p>
        </div>
        <WeeklyBarChart data={classWeeklyTrend} />
      </div>

      {/* ── Critical Focus Panel (At-Risk Students) ───────────────────────── */}
      {atRisk.length > 0 && (
        <div className="bg-white rounded-2xl border border-rose-200 shadow-sm overflow-hidden">
          <div className="px-5 py-3.5 bg-rose-50 border-b border-rose-100 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-rose-500" />
            <p className="text-sm font-black text-rose-700">
              {atRisk.length} Student{atRisk.length !== 1 ? "s" : ""} Requiring
              Intervention
            </p>
          </div>
          <div className="divide-y divide-slate-100">
            {atRisk.map((stat) => {
              const student = students.find((s) => s.id === stat.studentId)!;
              const parentData = studentsWithParents.find(
                (s) => s.id === stat.studentId,
              );
              const parents = parentData?.parents ?? [];
              const history = attendanceHistory[stat.studentId] ?? [];
              const isOpen = contactId === stat.studentId;

              return (
                <div
                  key={stat.studentId}
                  className="px-5 py-4 flex items-center gap-3"
                >
                  <div
                    className={`h-10 w-10 rounded-xl flex items-center justify-center text-xs font-black shrink-0 ${
                      student.gender === "Female"
                        ? "bg-pink-100 text-pink-700"
                        : "bg-blue-100 text-blue-700"
                    }`}
                  >
                    {getInitials(student.full_name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold text-slate-800 truncate">
                        {student.full_name}
                      </p>
                      {stat.trend === "declining" && (
                        <TrendingDown className="h-3.5 w-3.5 text-rose-500" />
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-rose-500"
                          style={{ width: `${stat.rate}%` }}
                        />
                      </div>
                      <span className="text-[10px] font-black text-rose-600">
                        {stat.rate}%
                      </span>
                    </div>
                  </div>
                  <Sparkline records={history} />
                  <div className="relative shrink-0">
                    <button
                      onClick={() =>
                        setContactId(isOpen ? null : stat.studentId)
                      }
                      className={`flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-xl border transition-all ${
                        isOpen
                          ? "bg-violet-100 border-violet-200 text-violet-700"
                          : "bg-rose-50 border-rose-200 text-rose-600"
                      }`}
                      aria-label="contact button"
                    >
                      <Phone className="h-3.5 w-3.5" />
                    </button>
                    {isOpen && (
                      <ContactPopover
                        studentName={student.full_name}
                        parents={parents}
                        grade={fullClassName}
                        onClose={() => setContactId(null)}
                      />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Complete Class List (Sorted by Attendance Rate) ────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
          <p className="text-xs font-black uppercase tracking-wider text-slate-500">
            Attendance Ranking
          </p>
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
            Sorted Ascending ↑
          </p>
        </div>
        <div className="divide-y divide-slate-100">
          {stats
            .sort((a, b) => a.rate - b.rate)
            .map((stat) => {
              const student = students.find((s) => s.id === stat.studentId)!;
              const isAtRisk = stat.total >= 5 && stat.rate < AT_RISK_THRESHOLD;
              const history = attendanceHistory[stat.studentId] ?? [];
              const isOpen = contactId === stat.studentId;
              const parentData = studentsWithParents.find(
                (s) => s.id === stat.studentId,
              );
              const parents = parentData?.parents ?? [];

              return (
                <div
                  key={stat.studentId}
                  className={`px-5 py-3 flex items-center gap-3 ${isAtRisk ? "bg-rose-50/30" : ""}`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="text-sm font-bold text-slate-800 truncate">
                        {student.full_name}
                      </p>
                      {stat.trend === "improving" && (
                        <TrendingUp className="h-3 w-3 text-emerald-500" />
                      )}
                      {stat.trend === "declining" && (
                        <TrendingDown className="h-3 w-3 text-rose-500" />
                      )}
                    </div>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      {stat.total > 0
                        ? `${stat.present}P · ${stat.absent}A · ${stat.late}L of ${stat.total} days`
                        : "No data recorded"}
                    </p>
                  </div>
                  <Sparkline records={history} />
                  <div className="w-16 flex items-center justify-end">
                    <span
                      className={`text-xs font-black ${isAtRisk ? "text-rose-600" : "text-emerald-600"}`}
                    >
                      {stat.total > 0 ? `${stat.rate}%` : "—"}
                    </span>
                  </div>
                  <div className="relative">
                    <button
                    aria-label="contact button"
                      onClick={() =>
                        setContactId(isOpen ? null : stat.studentId)
                      }
                      className={`h-8 w-8 rounded-xl flex items-center justify-center transition-colors ${
                        isOpen
                          ? "bg-violet-100 text-violet-600"
                          : "text-slate-300 hover:bg-slate-100"
                      }`}
                    >
                      <Phone className="h-3.5 w-3.5" />
                    </button>
                    {isOpen && (
                      <ContactPopover
                        studentName={student.full_name}
                        parents={parents}
                        grade={fullClassName}
                        onClose={() => setContactId(null)}
                      />
                    )}
                  </div>
                </div>
              );
            })}
        </div>
      </div>
    </div>
  );
}