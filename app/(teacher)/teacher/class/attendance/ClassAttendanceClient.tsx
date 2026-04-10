"use client";

// app/teacher/class/attendance/ClassAttendanceClient.tsx
import {
  AlertTriangle,
  CalendarCheck,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Save,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  useCallback,
  useMemo,
  useState,
  useTransition,
} from "react";

import { bulkRecordAttendanceAction } from "@/lib/actions/teacher";
import type {
  AttendanceClientProps,
  Status,
  StudentRow
} from "./attendance-types";
import {
  DAY_NAMES,
  formatLong,
  getWeekDays,
  shiftWeek,
  toLocalDate,
} from "./attendance-types";

import { RegisterTab } from "./RegisterTab";
import { TrendsTab } from "./TrendsTab";

export function ClassAttendanceClient({
  classId,
  gradeName,
  streamName,
  availableClasses,
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
  const searchParams = useSearchParams();
  const [isPending, startTrans] = useTransition();

  // ── State ──────────────────────────────────────────────────────────────────
  const [tab, setTab] = useState<"register" | "trends">(initialTab);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  
  // Track the version of data we are looking at to handle "prop syncing" without useEffect
  const [prevSyncKey, setPrevSyncKey] = useState(`${classId}-${selectedDate}`);
  const [saved, setSaved] = useState(Object.keys(preFill).length > 0);

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

  // ── Sync Logic (The "Right" way for local state) ──────────────────────────
  // If the class or date changes, we reset the local rows to the new server data.
  // This happens DURING render, avoiding the "cascading effect" warning.
  const currentSyncKey = `${classId}-${selectedDate}`;
  if (currentSyncKey !== prevSyncKey) {
    setPrevSyncKey(currentSyncKey);
    setRows(students.map((s) => ({
      studentId: s.id,
      full_name: s.full_name,
      readable_id: s.readable_id,
      gender: s.gender,
      status: (preFill[s.id]?.status as Status) ?? "Present",
      remarks: preFill[s.id]?.remarks ?? "",
      remarksOpen: false,
    })));
    setSaved(Object.keys(preFill).length > 0);
  }

  // ── Derived Data ────────────────────────────────────────────────────────────
  const { isFuture, weekDays, recorded, nextWeekDisabled } = useMemo(() => {
    const days = getWeekDays(selectedDate);
    const lastDay = days[4];
    const nextMon = lastDay ? new Date(lastDay + "T00:00:00") : new Date();
    nextMon.setDate(nextMon.getDate() + 3);
    
    return {
      isFuture: selectedDate > today,
      weekDays: days,
      recorded: new Set(weekDatesRecorded),
      nextWeekDisabled: toLocalDate(nextMon) > today,
    };
  }, [selectedDate, today, weekDatesRecorded]);

  const todayCounts = useMemo(
    () =>
      rows.reduce<Record<Status, number>>(
        (acc, r) => {
          acc[r.status] = (acc[r.status] ?? 0) + 1;
          return acc;
        },
        { Present: 0, Late: 0, Absent: 0, Excused: 0 },
      ),
    [rows],
  );

  const atRiskCount = useMemo(
    () =>
      students.filter((s) => {
        const h = attendanceHistory[s.id] ?? [];
        if (h.length < 5) return false;
        const rate =
          (h.filter((r) => r.status === "Present" || r.status === "Late")
            .length /
            h.length) *
          100;
        return rate < 75;
      }).length,
    [students, attendanceHistory],
  );

  // ── Navigation ─────────────────────────────────────────────────────────────
  const navTo = useCallback(
    (date: string, targetClassId?: string) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("classId", targetClassId ?? classId);
      params.set("date", date);
      router.push(`/teacher/class/attendance?${params.toString()}`);
    },
    [classId, router, searchParams],
  );

  // ── Mutations ─────────────────────────────────────────────────────────────
  const updateRow = (id: string, updates: Partial<StudentRow>) => {
    setSaved(false);
    setRows((prev) =>
      prev.map((r) => (r.studentId === id ? { ...r, ...updates } : r)),
    );
  };

  const markAll = (status: Status) => {
    setSaved(false);
    setRows((prev) => prev.map((r) => ({ ...r, status })));
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
          ? `Register saved for ${gradeName} ${streamName}.`
          : res.message,
        ok: res.success,
      });
      setTimeout(() => setToast(null), 4000);
    });
  };

  return (
    <div className="min-h-screen bg-[#f5f6fa]">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-sm">
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          <div className="h-14 flex items-center gap-3">
            <CalendarCheck className="h-5 w-5 text-sky-500 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-black text-slate-800 leading-none">
                {gradeName} {streamName}
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

          <div className="pb-2 flex items-center gap-2">
            <button
              aria-label="previous week"
              onClick={() => navTo(shiftWeek(selectedDate, -1))}
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
                    <span className={`text-[9px] font-black uppercase tracking-widest ${isSel ? "text-sky-200" : "text-slate-400"}`}>
                      {DAY_NAMES[i]}
                    </span>
                    <span className={`text-sm font-black leading-none ${isSel ? "text-white" : isToday ? "text-sky-600" : "text-slate-700"}`}>
                      {new Date(date + "T00:00:00").getDate()}
                    </span>
                    {hasRec && !isSel && <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-emerald-500" />}
                    {isToday && !isSel && <span className="absolute top-1 right-1 w-1 h-1 rounded-full bg-sky-400" />}
                  </button>
                );
              })}
            </div>
            <button
            aria-label="next week "
              onClick={() => navTo(shiftWeek(selectedDate, 1))}
              disabled={nextWeekDisabled}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors shrink-0"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <div className="pb-2 flex items-center gap-3 flex-wrap">
            <div className="flex rounded-lg border border-slate-200 bg-slate-50 p-0.5 gap-0.5">
              {(["register", "trends"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`px-3.5 py-1.5 rounded-md text-xs font-bold transition-all ${tab === t ? "bg-white text-slate-800 shadow-sm" : "text-slate-400 hover:text-slate-600"}`}
                >
                  {t === "trends" ? `Trends${atRiskCount > 0 ? ` (${atRiskCount})` : ""}` : "Register"}
                </button>
              ))}
            </div>
            {availableClasses.length > 1 && (
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
                {availableClasses.map((cls) => (
                  <button
                    key={cls.id}
                    onClick={() => navTo(selectedDate, cls.id)}
                    className={`whitespace-nowrap text-[10px] font-bold px-3 py-1 rounded-full border transition-all ${
                      cls.id === classId ? "bg-slate-800 text-white border-slate-800 shadow-sm" : "bg-white text-slate-500 border-slate-200 hover:border-sky-300"
                    }`}
                  >
                    {cls.grade} {cls.stream}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </header>

      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl text-sm font-bold shadow-xl animate-in fade-in slide-in-from-top-2 ${toast.ok ? "bg-emerald-600 text-white" : "bg-rose-500 text-white"}`}>
          {toast.msg}
        </div>
      )}

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-4 space-y-4">
        {isFuture && tab === "register" && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-700 font-semibold flex items-center gap-2">
            <Clock className="h-4 w-4 shrink-0" /> Future date — attendance cannot be recorded yet.
          </div>
        )}

        {tab === "register" ? (
          <RegisterTab
            grade={`${gradeName} ${streamName}`}
            students={students}
            studentsWithParents={studentsWithParents}
            rows={rows}
            isFuture={isFuture}
            isPending={isPending}
            saved={saved}
            selectedDate={selectedDate}
            onSetStatus={(id, status) => updateRow(id, { status })}
            onSetRemarks={(id, remarks) => updateRow(id, { remarks })}
            onToggleRemarks={(id) => {
              const row = rows.find((r) => r.studentId === id);
              updateRow(id, { remarksOpen: !row?.remarksOpen });
            }}
            onMarkAll={markAll}
            onSave={handleSave}
          />
        ) : (
          <TrendsTab
            grade={`${gradeName} ${streamName}`}
            students={students}
            studentsWithParents={studentsWithParents}
            attendanceHistory={attendanceHistory}
            classWeeklyTrend={classWeeklyTrend}
            todayCounts={todayCounts}
            totalStudents={rows.length}
          />
        )}
      </main>
    </div>
  );
}