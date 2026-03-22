"use client";

// app/teacher/class/attendance/ClassAttendanceClient.tsx
// Thin orchestrator — owns shared state, header, week nav, tab routing.
// All rendering is delegated to RegisterTab and TrendsTab.

import { bulkRecordAttendanceAction } from "@/lib/actions/teacher";
import type { ClassStudent } from "@/lib/data/assessment";
import type {
  Status,
  StudentRow,
  ParentContact,
  AttendanceClientProps,
} from "./attendance-types";
import {
  STATUSES,
  STATUS_CFG,
  DAY_NAMES,
  toLocalDate,
  getWeekDays,
  shiftWeek,
  formatLong,
} from "./attendance-types";
import { RegisterTab } from "./RegisterTab";
import { TrendsTab } from "./TrendsTab";
import {
  AlertTriangle,
  CalendarCheck,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Save,
} from "lucide-react";
import { useCallback, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export function ClassAttendanceClient({
  teacherName,
  grade,
  grades,
  students,
  studentsWithParents,
  selectedDate,
  today,
  preFill,
  weekDatesRecorded,
  attendanceHistory,
  classWeeklyTrend = [],
  activeTab: initialTab,
}: AttendanceClientProps) {
  const router = useRouter();

  const [tab, setTab] = useState<"register" | "trends">(initialTab);
  const [rows, setRows] = useState<StudentRow[]>(() =>
    students.map((s) => ({
      studentId: s.id,
      full_name: s.full_name,
      readable_id: s.readable_id,
      gender: s.gender,
      status: (preFill[s.id]?.status as Status) ?? "Present",
      remarks: preFill[s.id]?.remarks ?? "",
      remarksOpen: false,
    })),
  );
  const [saved, setSaved] = useState(Object.keys(preFill).length > 0);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [isPending, startTrans] = useTransition();

  const isFuture = selectedDate > today;
  const weekDays = getWeekDays(selectedDate);
  const recorded = new Set(weekDatesRecorded);

  // Disable next-week nav when next Monday is in the future
  const nextMon = new Date(weekDays[4]! + "T00:00:00");
  nextMon.setDate(nextMon.getDate() + 3);
  const nextWeekDisabled = toLocalDate(nextMon) > today;

  // ── Navigation ─────────────────────────────────────────────────────────────
  const navTo = useCallback(
    (date: string, g?: string) => {
      router.push(
        `/teacher/class/attendance?grade=${encodeURIComponent(g ?? grade)}&date=${date}`,
      );
    },
    [grade, router],
  );

  // ── Register mutations ─────────────────────────────────────────────────────
  const setStatus = (id: string, status: Status) => {
    setSaved(false);
    setRows((p) => p.map((r) => (r.studentId === id ? { ...r, status } : r)));
  };
  const setRemarks = (id: string, remarks: string) =>
    setRows((p) => p.map((r) => (r.studentId === id ? { ...r, remarks } : r)));
  const toggleRemarks = (id: string) =>
    setRows((p) =>
      p.map((r) =>
        r.studentId === id ? { ...r, remarksOpen: !r.remarksOpen } : r,
      ),
    );
  const markAll = (status: Status) => {
    setSaved(false);
    setRows((p) => p.map((r) => ({ ...r, status })));
  };

  const handleSave = () => {
    startTrans(async () => {
      const res = await bulkRecordAttendanceAction(
        rows.map((r) => ({
          studentId: r.studentId,
          status: r.status,
          date: selectedDate,
          remarks: r.remarks || undefined,
        })),
      );
      setSaved(res.success);
      setToast({
        msg: res.success
          ? `Register saved — ${rows.length} students.`
          : res.message,
        ok: res.success,
      });
      setTimeout(() => setToast(null), 4000);
    });
  };

  // ── Derived: today's counts (passed to TrendsTab donut) ───────────────────
  const todayCounts = rows.reduce<Record<Status, number>>(
    (acc, r) => {
      acc[r.status] = (acc[r.status] ?? 0) + 1;
      return acc;
    },
    { Present: 0, Late: 0, Absent: 0, Excused: 0 },
  );

  // At-risk count for header badge
  const atRiskCount = students.filter((s) => {
    const h = attendanceHistory[s.id] ?? [];
    if (h.length < 5) return false;
    const rate = Math.round(
      (h.filter((r) => r.status === "Present" || r.status === "Late").length /
        h.length) *
        100,
    );
    return rate < 75;
  }).length;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#f5f6fa]">
      {/* ── Sticky header ─────────────────────────────────────────────────── */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-sm">
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          {/* Top bar */}
          <div className="h-14 flex items-center gap-3">
            <CalendarCheck className="h-5 w-5 text-sky-500 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-black text-slate-800 leading-none">
                {grade} Register
              </p>
              <p className="text-[10px] text-slate-400 font-medium mt-0.5">
                {formatLong(selectedDate)}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {atRiskCount > 0 && (
                <button
                  onClick={() => setTab("trends")}
                  className="hidden sm:flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1.5 rounded-xl border border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100 transition-colors"
                >
                  <AlertTriangle className="h-3 w-3" /> {atRiskCount} at risk
                </button>
              )}
              {saved && !isFuture && tab === "register" && (
                <span className="hidden sm:flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-1 rounded-lg">
                  <CheckCircle2 className="h-3 w-3" /> Saved
                </span>
              )}
              {tab === "register" && (
                <button
                  onClick={handleSave}
                  disabled={isPending || isFuture}
                  className="flex items-center gap-1.5 text-xs font-bold px-3.5 py-2 rounded-xl bg-sky-600 text-white hover:bg-sky-700 disabled:opacity-40 transition-all"
                >
                  <Save className="h-3.5 w-3.5" />
                  {isPending ? "Saving…" : "Save"}
                </button>
              )}
            </div>
          </div>

          {/* Week strip */}
          <div className="pb-2 flex items-center gap-2">
            <button
              onClick={() => navTo(shiftWeek(selectedDate, -1))}
              aria-label="Previous week"
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors shrink-0"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <div className="flex-1 grid grid-cols-5 gap-1.5">
              {weekDays.map((date, i) => {
                const isSel = date === selectedDate;
                const isToday = date === today;
                const isFutDay = date > today;
                const hasRec = recorded.has(date);
                return (
                  <button
                    key={date}
                    onClick={() => !isFutDay && navTo(date)}
                    disabled={isFutDay}
                    className={[
                      "relative flex flex-col items-center gap-0.5 py-2 rounded-xl border text-center transition-all",
                      isFutDay
                        ? "opacity-30 cursor-not-allowed border-transparent"
                        : isSel
                          ? "bg-sky-600 border-sky-600 text-white shadow-sm"
                          : "bg-white border-slate-200 text-slate-600 hover:border-sky-300 hover:bg-sky-50",
                    ].join(" ")}
                  >
                    <span
                      className={`text-[9px] font-black uppercase tracking-widest ${isSel ? "text-sky-200" : "text-slate-400"}`}
                    >
                      {DAY_NAMES[i]}
                    </span>
                    <span
                      className={`text-sm font-black leading-none ${isSel ? "text-white" : isToday ? "text-sky-600" : "text-slate-700"}`}
                    >
                      {new Date(date + "T00:00:00").getDate()}
                    </span>
                    {hasRec && !isSel && (
                      <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-emerald-500" />
                    )}
                    {isToday && !isSel && (
                      <span className="absolute top-1 right-1 w-1 h-1 rounded-full bg-sky-400" />
                    )}
                  </button>
                );
              })}
            </div>
            <button
              onClick={() => navTo(shiftWeek(selectedDate, 1))}
              disabled={nextWeekDisabled}
              aria-label="Next week"
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors shrink-0"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {/* Tabs + grade switcher */}
          <div className="pb-2 flex items-center gap-3 flex-wrap">
            <div className="flex rounded-lg border border-slate-200 bg-slate-50 p-0.5 gap-0.5">
              {(["register", "trends"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`px-3.5 py-1.5 rounded-md text-xs font-bold transition-all ${tab === t ? "bg-white text-slate-800 shadow-sm" : "text-slate-400 hover:text-slate-600"}`}
                >
                  {t === "trends"
                    ? `Trends${atRiskCount > 0 ? ` (${atRiskCount})` : ""}`
                    : "Register"}
                </button>
              ))}
            </div>
            {grades.length > 1 &&
              grades.map((g) => (
                <button
                  key={g}
                  onClick={() => navTo(selectedDate, g)}
                  className={`text-xs font-bold px-2.5 py-1 rounded-xl border transition-all ${g === grade ? "bg-sky-600 text-white border-sky-600" : "bg-white text-slate-500 border-slate-200 hover:border-sky-300"}`}
                >
                  {g}
                </button>
              ))}
          </div>
        </div>
      </header>

      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl text-sm font-bold shadow-xl ${toast.ok ? "bg-emerald-600 text-white" : "bg-rose-500 text-white"}`}
        >
          {toast.msg}
        </div>
      )}

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-4 space-y-4">
        {/* Future date warning */}
        {isFuture && tab === "register" && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-700 font-semibold flex items-center gap-2">
            <Clock className="h-4 w-4 shrink-0" /> Future date — attendance
            cannot be recorded yet.
          </div>
        )}

        {tab === "register" && (
          <RegisterTab
            grade={grade}
            students={students}
            studentsWithParents={studentsWithParents}
            rows={rows}
            isFuture={isFuture}
            isPending={isPending}
            saved={saved}
            selectedDate={selectedDate}
            onSetStatus={setStatus}
            onSetRemarks={setRemarks}
            onToggleRemarks={toggleRemarks}
            onMarkAll={markAll}
            onSave={handleSave}
          />
        )}

        {tab === "trends" && (
          <TrendsTab
            grade={grade}
            students={students}
            studentsWithParents={studentsWithParents}
            attendanceHistory={attendanceHistory}
            classWeeklyTrend={classWeeklyTrend}
            todayCounts={todayCounts}
            totalStudents={rows.length}
          />
        )}
      </div>
    </div>
  );
}
