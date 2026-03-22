"use client";

// app/teacher/class/attendance/ClassAttendanceClient.tsx
// Enhanced with: week nav, attendance trends, at-risk detection, parent contact (SMS + email)

import { bulkRecordAttendanceAction } from "@/lib/actions/teacher";
import type { ClassStudent } from "@/lib/data/assessment";
import {
  AlertTriangle,
  CalendarCheck,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Clock,
  FileText,
  Mail,
  MessageSquare,
  Phone,
  Save,
  TrendingDown,
  Users,
  XCircle,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useState, useTransition } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

type Status = "Present" | "Absent" | "Late" | "Excused";

interface StudentRow {
  studentId: string;
  full_name: string;
  readable_id: string | null;
  gender: "Male" | "Female" | null;
  status: Status;
  remarks: string;
  remarksOpen: boolean;
}

interface AttendanceStat {
  studentId: string;
  present: number;
  absent: number;
  late: number;
  excused: number;
  total: number;
  rate: number; // 0-100
  trend: "improving" | "declining" | "stable";
}

interface ParentContact {
  full_name: string;
  email: string;
  phone_number: string | null;
}

interface Props {
  teacherName: string;
  grade: string;
  grades: string[];
  students: ClassStudent[];
  studentsWithParents: (ClassStudent & { parents: ParentContact[] })[];
  selectedDate: string;
  today: string;
  preFill: Record<string, { status: string; remarks: string }>;
  weekDatesRecorded: string[];
  attendanceHistory: Record<string, { date: string; status: Status }[]>; // studentId → last 30d
  activeTab: "register" | "trends";
}

// ── Constants ─────────────────────────────────────────────────────────────────

const S: Record<
  Status,
  {
    icon: React.ReactNode;
    active: string;
    inactive: string;
    text: string;
    dot: string;
    label: string;
    short: string;
  }
> = {
  Present: {
    label: "Present",
    short: "P",
    icon: <CheckCircle2 className="h-4 w-4" />,
    active:
      "bg-emerald-500 text-white ring-2 ring-emerald-300 scale-105 shadow-sm shadow-emerald-200",
    inactive:
      "bg-slate-100 text-slate-400 hover:bg-emerald-50 hover:text-emerald-600",
    text: "text-emerald-600",
    dot: "bg-emerald-500",
  },
  Late: {
    label: "Late",
    short: "L",
    icon: <Clock className="h-4 w-4" />,
    active:
      "bg-amber-400 text-white ring-2 ring-amber-300 scale-105 shadow-sm shadow-amber-200",
    inactive:
      "bg-slate-100 text-slate-400 hover:bg-amber-50 hover:text-amber-600",
    text: "text-amber-600",
    dot: "bg-amber-400",
  },
  Absent: {
    label: "Absent",
    short: "A",
    icon: <XCircle className="h-4 w-4" />,
    active:
      "bg-rose-500 text-white ring-2 ring-rose-300 scale-105 shadow-sm shadow-rose-200",
    inactive:
      "bg-slate-100 text-slate-400 hover:bg-rose-50 hover:text-rose-600",
    text: "text-rose-600",
    dot: "bg-rose-500",
  },
  Excused: {
    label: "Excused",
    short: "E",
    icon: <FileText className="h-4 w-4" />,
    active:
      "bg-sky-500 text-white ring-2 ring-sky-300 scale-105 shadow-sm shadow-sky-200",
    inactive: "bg-slate-100 text-slate-400 hover:bg-sky-50 hover:text-sky-600",
    text: "text-sky-600",
    dot: "bg-sky-500",
  },
};

const STATUSES: Status[] = ["Present", "Late", "Absent", "Excused"];
const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri"];
const AT_RISK_THRESHOLD = 75; // below this attendance % = at risk

// ── Date helpers ──────────────────────────────────────────────────────────────

function toLocalDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function getWeekDays(anyDate: string): string[] {
  const d = new Date(anyDate + "T00:00:00");
  const mon = new Date(d);
  mon.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return Array.from({ length: 5 }, (_, i) => {
    const day = new Date(mon);
    day.setDate(mon.getDate() + i);
    return toLocalDate(day);
  });
}

function shiftWeek(date: string, dir: -1 | 1): string {
  const d = new Date(date + "T00:00:00");
  d.setDate(d.getDate() + dir * 7);
  return toLocalDate(d);
}

function formatLong(iso: string) {
  return new Date(iso + "T00:00:00").toLocaleDateString("en-KE", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatShort(iso: string) {
  return new Date(iso + "T00:00:00").toLocaleDateString("en-KE", {
    day: "numeric",
    month: "short",
  });
}

function getInitials(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase();
}

// ── Compute trends from history ───────────────────────────────────────────────

function computeStats(
  students: ClassStudent[],
  history: Record<string, { date: string; status: Status }[]>,
): AttendanceStat[] {
  return students.map((s) => {
    const records = history[s.id] ?? [];
    const total = records.length;
    if (total === 0)
      return {
        studentId: s.id,
        present: 0,
        absent: 0,
        late: 0,
        excused: 0,
        total: 0,
        rate: 100,
        trend: "stable",
      };

    const present = records.filter((r) => r.status === "Present").length;
    const absent = records.filter((r) => r.status === "Absent").length;
    const late = records.filter((r) => r.status === "Late").length;
    const excused = records.filter((r) => r.status === "Excused").length;
    const rate = Math.round(((present + late) / total) * 100);

    // Trend: compare first half vs second half of records
    const half = Math.floor(total / 2);
    const older = records.slice(0, half);
    const newer = records.slice(half);
    const olderRate =
      older.length > 0
        ? older.filter((r) => r.status === "Present" || r.status === "Late")
            .length / older.length
        : 1;
    const newerRate =
      newer.length > 0
        ? newer.filter((r) => r.status === "Present" || r.status === "Late")
            .length / newer.length
        : 1;
    const diff = newerRate - olderRate;
    const trend: AttendanceStat["trend"] =
      diff > 0.05 ? "improving" : diff < -0.05 ? "declining" : "stable";

    return {
      studentId: s.id,
      present,
      absent,
      late,
      excused,
      total,
      rate,
      trend,
    };
  });
}

// ── Contact popover ───────────────────────────────────────────────────────────

function ContactPopover({
  student,
  parents,
  grade,
  onClose,
}: {
  student: ClassStudent;
  parents: ParentContact[];
  grade: string;
  onClose: () => void;
}) {
  if (parents.length === 0) {
    return (
      <div className="absolute right-0 top-full mt-1 z-50 w-64 rounded-xl border border-slate-200 bg-white shadow-xl p-4">
        <p className="text-xs text-slate-400 text-center">
          No parent contacts on file.
        </p>
        <button
          onClick={onClose}
          className="mt-2 w-full text-xs text-slate-400 hover:text-slate-600"
        >
          Close
        </button>
      </div>
    );
  }

  return (
    <div className="absolute right-0 top-full mt-1 z-50 w-72 rounded-xl border border-slate-200 bg-white shadow-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
        <p className="text-xs font-black text-slate-700">
          Contact Parent — {student.full_name}
        </p>
      </div>
      <div className="p-3 space-y-2">
        {parents.map((p, i) => (
          <div
            key={i}
            className="rounded-lg border border-slate-100 bg-white p-3 space-y-2"
          >
            <p className="text-xs font-bold text-slate-700">{p.full_name}</p>
            <div className="flex gap-2">
              {p.phone_number && (
                <a
                  href={`tel:${p.phone_number}`}
                  className="flex-1 flex items-center justify-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1.5 text-[10px] font-bold text-emerald-700 hover:bg-emerald-100 transition-colors"
                >
                  <Phone className="h-3 w-3" /> Call
                </a>
              )}
              {p.phone_number && (
                <a
                  href={`sms:${p.phone_number}?body=${encodeURIComponent(`Dear Parent, we are following up on ${student.full_name}'s attendance at Kibali Academy. Please contact us at your earliest convenience. Thank you.`)}`}
                  className="flex-1 flex items-center justify-center gap-1.5 rounded-lg border border-sky-200 bg-sky-50 px-2 py-1.5 text-[10px] font-bold text-sky-700 hover:bg-sky-100 transition-colors"
                >
                  <MessageSquare className="h-3 w-3" /> SMS
                </a>
              )}
              <a
                href={`mailto:${p.email}?subject=${encodeURIComponent(`Attendance Follow-up — ${student.full_name}`)}&body=${encodeURIComponent(`Dear ${p.full_name},\n\nWe are writing to follow up on ${student.full_name}'s attendance in ${grade}. We would appreciate your cooperation in ensuring regular school attendance.\n\nPlease contact us if there are any concerns.\n\nKind regards,\nKibali Academy`)}`}
                className="flex-1 flex items-center justify-center gap-1.5 rounded-lg border border-violet-200 bg-violet-50 px-2 py-1.5 text-[10px] font-bold text-violet-700 hover:bg-violet-100 transition-colors"
              >
                <Mail className="h-3 w-3" /> Email
              </a>
            </div>
            <p className="text-[9px] text-slate-400 font-mono truncate">
              {p.email}
            </p>
          </div>
        ))}
      </div>
      <div className="px-3 pb-3">
        <button
          onClick={onClose}
          className="w-full text-[10px] text-slate-400 hover:text-slate-600 py-1"
        >
          Close
        </button>
      </div>
    </div>
  );
}

// ── Mini bar chart (last 10 days) ─────────────────────────────────────────────

function MiniTrendChart({
  records,
}: {
  records: { date: string; status: Status }[];
}) {
  const last10 = records.slice(-10);
  if (last10.length === 0)
    return <span className="text-[10px] text-slate-300">No data</span>;

  return (
    <div className="flex items-end gap-0.5 h-6">
      {last10.map((r, i) => (
        <div
          key={i}
          title={`${formatShort(r.date)}: ${r.status}`}
          className={`w-2 rounded-sm transition-all ${
            r.status === "Present"
              ? "h-6 bg-emerald-400"
              : r.status === "Late"
                ? "h-4 bg-amber-400"
                : r.status === "Excused"
                  ? "h-3 bg-sky-400"
                  : "h-1 bg-rose-400"
          }`}
        />
      ))}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

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
  activeTab: initialTab,
}: Props) {
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
  const [contactId, setContactId] = useState<string | null>(null);
  const [isPending, startTrans] = useTransition();

  const stats = computeStats(students, attendanceHistory);
  const atRisk = stats.filter(
    (s) => s.total >= 5 && s.rate < AT_RISK_THRESHOLD,
  );
  const weekDays = getWeekDays(selectedDate);
  const recordedSet = new Set(weekDatesRecorded);
  const isFuture = selectedDate > today;

  // Next week disabled if next Monday > today
  const nextMon = new Date(weekDays[4]! + "T00:00:00");
  nextMon.setDate(nextMon.getDate() + 3);
  const nextWeekDisabled = toLocalDate(nextMon) > today;

  // ── Navigation ───────────────────────────────────────────────────────────

  const navigateTo = useCallback(
    (date: string, g?: string) => {
      router.push(
        `/teacher/class/attendance?grade=${encodeURIComponent(g ?? grade)}&date=${date}`,
      );
    },
    [grade, router],
  );

  // ── Register handlers ─────────────────────────────────────────────────────

  const setStatus = (studentId: string, status: Status) => {
    setSaved(false);
    setRows((prev) =>
      prev.map((r) => (r.studentId === studentId ? { ...r, status } : r)),
    );
  };

  const setRemarks = (studentId: string, remarks: string) => {
    setRows((prev) =>
      prev.map((r) => (r.studentId === studentId ? { ...r, remarks } : r)),
    );
  };

  const toggleRemarks = (studentId: string) => {
    setRows((prev) =>
      prev.map((r) =>
        r.studentId === studentId ? { ...r, remarksOpen: !r.remarksOpen } : r,
      ),
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
      if (res.success) {
        setSaved(true);
        setToast({
          msg: `Register saved — ${rows.length} students.`,
          ok: true,
        });
      } else {
        setToast({ msg: res.message, ok: false });
      }
      setTimeout(() => setToast(null), 4000);
    });
  };

  // ── Stats ─────────────────────────────────────────────────────────────────

  const counts = rows.reduce<Record<Status, number>>(
    (acc, r) => {
      acc[r.status] = (acc[r.status] ?? 0) + 1;
      return acc;
    },
    { Present: 0, Late: 0, Absent: 0, Excused: 0 },
  );
  const rate =
    rows.length > 0
      ? Math.round(((counts.Present + counts.Late) / rows.length) * 100)
      : 0;
  const absentRows = rows.filter(
    (r) => r.status === "Absent" || r.status === "Late",
  );

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[#f5f6fa]">
      {/* ── Sticky header ── */}
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
              {atRisk.length > 0 && (
                <button
                  onClick={() => setTab("trends")}
                  className="hidden sm:flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1.5 rounded-xl border border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100 transition-colors"
                >
                  <AlertTriangle className="h-3.5 w-3.5" /> {atRisk.length} at
                  risk
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
              onClick={() => navigateTo(shiftWeek(selectedDate, -1))}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors shrink-0"
              aria-label="Previous week"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <div className="flex-1 grid grid-cols-5 gap-1.5">
              {weekDays.map((date, i) => {
                const isSelected = date === selectedDate;
                const isToday = date === today;
                const isFutureDay = date > today;
                const hasRecord = recordedSet.has(date);
                return (
                  <button
                    key={date}
                    onClick={() => !isFutureDay && navigateTo(date)}
                    disabled={isFutureDay}
                    className={[
                      "relative flex flex-col items-center gap-0.5 py-2 rounded-xl border text-center transition-all",
                      isFutureDay
                        ? "opacity-30 cursor-not-allowed border-transparent"
                        : isSelected
                          ? "bg-sky-600 border-sky-600 text-white shadow-sm shadow-sky-200"
                          : "bg-white border-slate-200 text-slate-600 hover:border-sky-300 hover:bg-sky-50",
                    ].join(" ")}
                  >
                    <span
                      className={`text-[9px] font-black uppercase tracking-widest ${isSelected ? "text-sky-200" : "text-slate-400"}`}
                    >
                      {DAY_NAMES[i]}
                    </span>
                    <span
                      className={`text-sm font-black leading-none ${isSelected ? "text-white" : isToday ? "text-sky-600" : "text-slate-700"}`}
                    >
                      {new Date(date + "T00:00:00").getDate()}
                    </span>
                    {hasRecord && !isSelected && (
                      <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-emerald-500" />
                    )}
                    {isToday && !isSelected && (
                      <span className="absolute top-1 right-1 w-1 h-1 rounded-full bg-sky-400" />
                    )}
                  </button>
                );
              })}
            </div>
            <button
              onClick={() => navigateTo(shiftWeek(selectedDate, 1))}
              disabled={nextWeekDisabled}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors shrink-0"
              aria-label="Next week"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {/* Tab bar + grade switcher */}
          <div className="pb-2 flex items-center gap-3 flex-wrap">
            <div className="flex rounded-lg border border-slate-200 bg-slate-50 p-0.5 gap-0.5">
              {(["register", "trends"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all capitalize ${
                    tab === t
                      ? "bg-white text-slate-800 shadow-sm"
                      : "text-slate-400 hover:text-slate-600"
                  }`}
                >
                  {t === "trends"
                    ? `Trends${atRisk.length > 0 ? ` (${atRisk.length})` : ""}`
                    : t}
                </button>
              ))}
            </div>
            {grades.length > 1 && (
              <div className="flex items-center gap-1.5 flex-wrap">
                {grades.map((g) => (
                  <button
                    key={g}
                    onClick={() => navigateTo(selectedDate, g)}
                    className={`text-xs font-bold px-2.5 py-1 rounded-xl border transition-all ${
                      g === grade
                        ? "bg-sky-600 text-white border-sky-600"
                        : "bg-white text-slate-500 border-slate-200 hover:border-sky-300"
                    }`}
                  >
                    {g}
                  </button>
                ))}
              </div>
            )}
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
        {/* ══════════════════ REGISTER TAB ══════════════════════════════════ */}
        {tab === "register" && (
          <>
            {isFuture && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-700 font-semibold flex items-center gap-2">
                <Clock className="h-4 w-4 shrink-0" /> This is a future date —
                attendance cannot be recorded yet.
              </div>
            )}

            {/* Stats */}
            <div className="grid grid-cols-5 gap-2">
              <div className="col-span-1 bg-white rounded-2xl border border-slate-200 p-3 text-center shadow-sm">
                <p className="text-xl font-black text-slate-800">{rate}%</p>
                <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mt-0.5">
                  Rate
                </p>
              </div>
              {STATUSES.map((st) => (
                <div
                  key={st}
                  className="bg-white rounded-2xl border border-slate-200 p-3 text-center shadow-sm"
                >
                  <p className={`text-xl font-black ${S[st].text}`}>
                    {counts[st]}
                  </p>
                  <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mt-0.5">
                    {S[st].label}
                  </p>
                </div>
              ))}
            </div>

            {/* Quick mark */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Mark all:
              </span>
              {STATUSES.map((st) => (
                <button
                  key={st}
                  onClick={() => markAll(st)}
                  disabled={isFuture}
                  className="flex items-center gap-1 text-xs font-bold px-2.5 py-1.5 rounded-xl border transition-all disabled:opacity-40 bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                >
                  <span className={`w-2 h-2 rounded-full ${S[st].dot}`} /> All{" "}
                  {S[st].label}
                </button>
              ))}
              <span className="ml-auto flex items-center gap-1.5 text-xs text-slate-400">
                <Users className="h-3.5 w-3.5" /> {rows.length}
              </span>
            </div>

            {/* Roll */}
            <div className="space-y-2">
              {rows.map((row, idx) => {
                const parentData = studentsWithParents.find(
                  (s) => s.id === row.studentId,
                );
                const parents = parentData?.parents ?? [];
                const isOpen = contactId === row.studentId;

                return (
                  <div
                    key={row.studentId}
                    className={`bg-white rounded-2xl border shadow-sm overflow-hidden transition-all ${
                      row.status === "Absent"
                        ? "border-rose-200"
                        : row.status === "Late"
                          ? "border-amber-200"
                          : "border-slate-200"
                    }`}
                  >
                    <div className="flex items-center gap-3 px-4 py-3">
                      <span className="text-[10px] font-bold text-slate-300 w-5 text-right shrink-0">
                        {idx + 1}
                      </span>
                      <div
                        className={`h-9 w-9 rounded-xl flex items-center justify-center text-xs font-black shrink-0 ${
                          row.gender === "Female"
                            ? "bg-pink-100 text-pink-700"
                            : "bg-blue-100 text-blue-700"
                        }`}
                      >
                        {getInitials(row.full_name)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-slate-800 truncate">
                          {row.full_name}
                        </p>
                        {row.readable_id && (
                          <p className="text-[10px] font-mono text-slate-400">
                            #{row.readable_id}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {STATUSES.map((st) => (
                          <button
                            key={st}
                            onClick={() =>
                              !isFuture && setStatus(row.studentId, st)
                            }
                            disabled={isFuture}
                            title={S[st].label}
                            className={`h-8 w-8 rounded-xl flex items-center justify-center transition-all disabled:cursor-not-allowed ${
                              row.status === st ? S[st].active : S[st].inactive
                            }`}
                          >
                            {S[st].icon}
                          </button>
                        ))}
                        <button
                          onClick={() => toggleRemarks(row.studentId)}
                          title="Note"
                          className="h-8 w-8 rounded-xl flex items-center justify-center text-slate-400 hover:bg-slate-100 transition-colors"
                        >
                          {row.remarksOpen ? (
                            <ChevronUp className="h-3.5 w-3.5" />
                          ) : (
                            <FileText
                              className={`h-3.5 w-3.5 ${row.remarks ? "text-amber-500" : ""}`}
                            />
                          )}
                        </button>
                        {/* Contact parent button */}
                        <div className="relative">
                          <button
                            onClick={() =>
                              setContactId(isOpen ? null : row.studentId)
                            }
                            title="Contact parent"
                            className={`h-8 w-8 rounded-xl flex items-center justify-center transition-colors ${isOpen ? "bg-violet-100 text-violet-600" : "text-slate-300 hover:bg-slate-100 hover:text-slate-500"}`}
                          >
                            <Phone className="h-3.5 w-3.5" />
                          </button>
                          {isOpen && (
                            <ContactPopover
                              student={{
                                id: row.studentId,
                                full_name: row.full_name,
                                readable_id: row.readable_id,
                                gender: row.gender,
                                current_grade: grade,
                              }}
                              parents={parents}
                              grade={grade}
                              onClose={() => setContactId(null)}
                            />
                          )}
                        </div>
                      </div>
                    </div>
                    {row.remarksOpen && (
                      <div className="px-4 pb-3 pt-0 border-t border-slate-100">
                        <input
                          type="text"
                          value={row.remarks}
                          onChange={(e) =>
                            setRemarks(row.studentId, e.target.value)
                          }
                          placeholder="Note (e.g. sick, left early, permission letter)…"
                          className="w-full text-xs px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-300 focus:bg-white"
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Absent summary */}
            {absentRows.length > 0 && (
              <div className="bg-white rounded-2xl border border-rose-200 p-4 shadow-sm space-y-2">
                <p className="text-xs font-black uppercase tracking-wider text-rose-500">
                  ⚠ Follow-up ({absentRows.length})
                </p>
                {absentRows.map((r) => (
                  <div
                    key={r.studentId}
                    className="flex items-center gap-2 flex-wrap"
                  >
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${r.status === "Absent" ? "bg-rose-50 text-rose-600 border-rose-100" : "bg-amber-50 text-amber-600 border-amber-100"}`}
                    >
                      {r.status}
                    </span>
                    <span className="text-xs text-slate-700 font-semibold">
                      {r.full_name}
                    </span>
                    {r.remarks && (
                      <span className="text-xs text-slate-400 truncate">
                        — {r.remarks}
                      </span>
                    )}
                  </div>
                ))}
                <p className="text-[10px] text-slate-400 pt-1">
                  Parent notifications sent automatically on save.
                </p>
              </div>
            )}

            {/* Save footer */}
            <div className="pb-6">
              <button
                onClick={handleSave}
                disabled={isPending || isFuture}
                className="w-full py-3.5 rounded-2xl bg-sky-600 text-white font-black text-sm hover:bg-sky-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-lg shadow-sky-200/50 flex items-center justify-center gap-2"
              >
                <Save className="h-4 w-4" />
                {isPending ? "Saving register…" : `Save ${grade} Register`}
              </button>
              <p className="text-center text-[10px] text-slate-400 mt-2">
                Parents of absent students will be notified automatically
              </p>
            </div>
          </>
        )}

        {/* ══════════════════ TRENDS TAB ══════════════════════════════════ */}
        {tab === "trends" && (
          <div className="space-y-5">
            {/* At-risk banner */}
            {atRisk.length > 0 && (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-rose-500 shrink-0" />
                  <p className="text-sm font-black text-rose-700">
                    {atRisk.length} student{atRisk.length !== 1 ? "s" : ""} at
                    risk
                  </p>
                  <span className="text-[10px] text-rose-400 ml-auto">
                    Below {AT_RISK_THRESHOLD}% attendance
                  </span>
                </div>
                {atRisk.map((stat) => {
                  const student = students.find(
                    (s) => s.id === stat.studentId,
                  )!;
                  const parentData = studentsWithParents.find(
                    (s) => s.id === stat.studentId,
                  );
                  const parents = parentData?.parents ?? [];
                  const isOpen = contactId === stat.studentId;

                  return (
                    <div
                      key={stat.studentId}
                      className="flex items-center gap-3 rounded-xl bg-white border border-rose-100 px-4 py-3"
                    >
                      <div
                        className={`h-9 w-9 rounded-xl flex items-center justify-center text-xs font-black shrink-0 ${
                          student.gender === "Female"
                            ? "bg-pink-100 text-pink-700"
                            : "bg-blue-100 text-blue-700"
                        }`}
                      >
                        {getInitials(student.full_name)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-slate-800">
                          {student.full_name}
                        </p>
                        <p className="text-[10px] text-rose-500 font-semibold">
                          {stat.rate}% · {stat.absent} absent of {stat.total}{" "}
                          days
                          {stat.trend === "declining" && " · ↓ declining"}
                        </p>
                      </div>
                      <div className="relative shrink-0">
                        <button
                          onClick={() =>
                            setContactId(isOpen ? null : stat.studentId)
                          }
                          className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl border transition-all ${
                            isOpen
                              ? "bg-violet-100 border-violet-200 text-violet-700"
                              : "bg-rose-50 border-rose-200 text-rose-600 hover:bg-rose-100"
                          }`}
                        >
                          <Phone className="h-3 w-3" /> Contact
                        </button>
                        {isOpen && (
                          <ContactPopover
                            student={{
                              id: stat.studentId,
                              full_name: student.full_name,
                              readable_id: student.readable_id,
                              gender: student.gender,
                              current_grade: grade,
                            }}
                            parents={parents}
                            grade={grade}
                            onClose={() => setContactId(null)}
                          />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Full stats table */}
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
              <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                <p className="text-xs font-black uppercase tracking-wider text-slate-500">
                  Attendance Overview
                </p>
                <p className="text-[10px] text-slate-400">
                  Last {Math.max(...stats.map((s) => s.total), 0)} recorded days
                </p>
              </div>
              <div className="divide-y divide-slate-100">
                {stats
                  .sort((a, b) => a.rate - b.rate) // worst first
                  .map((stat) => {
                    const student = students.find(
                      (s) => s.id === stat.studentId,
                    )!;
                    const history = attendanceHistory[stat.studentId] ?? [];
                    const isAtRisk =
                      stat.rate < AT_RISK_THRESHOLD && stat.total >= 5;
                    const isOpen = contactId === stat.studentId;
                    const parentData = studentsWithParents.find(
                      (s) => s.id === stat.studentId,
                    );
                    const parents = parentData?.parents ?? [];

                    return (
                      <div
                        key={stat.studentId}
                        className={`px-4 py-3 flex items-center gap-3 ${isAtRisk ? "bg-rose-50/40" : ""}`}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-bold text-slate-800 truncate">
                              {student.full_name}
                            </p>
                            {isAtRisk && (
                              <AlertTriangle className="h-3 w-3 text-rose-400 shrink-0" />
                            )}
                            {stat.trend === "declining" && (
                              <TrendingDown className="h-3 w-3 text-rose-400 shrink-0" />
                            )}
                          </div>
                          <div className="flex items-center gap-3 mt-0.5">
                            <span
                              className={`text-xs font-black ${isAtRisk ? "text-rose-600" : "text-emerald-600"}`}
                            >
                              {stat.rate}%
                            </span>
                            <span className="text-[10px] text-slate-400">
                              {stat.present}P · {stat.absent}A · {stat.late}L ·{" "}
                              {stat.excused}E
                            </span>
                          </div>
                        </div>
                        <MiniTrendChart records={history} />
                        {/* Rate bar */}
                        <div className="w-16 hidden sm:block">
                          <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${isAtRisk ? "bg-rose-400" : "bg-emerald-400"}`}
                              style={{ width: `${stat.rate}%` }}
                            />
                          </div>
                        </div>
                        <div className="relative shrink-0">
                          <button
                            onClick={() =>
                              setContactId(isOpen ? null : stat.studentId)
                            }
                            className={`h-7 w-7 rounded-lg flex items-center justify-center transition-colors ${
                              isOpen
                                ? "bg-violet-100 text-violet-600"
                                : "text-slate-300 hover:bg-slate-100 hover:text-slate-500"
                            }`}
                          >
                            <Phone className="h-3.5 w-3.5" />
                          </button>
                          {isOpen && (
                            <ContactPopover
                              student={{
                                id: stat.studentId,
                                full_name: student.full_name,
                                readable_id: student.readable_id,
                                gender: student.gender,
                                current_grade: grade,
                              }}
                              parents={parents}
                              grade={grade}
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
        )}
      </div>
    </div>
  );
}
