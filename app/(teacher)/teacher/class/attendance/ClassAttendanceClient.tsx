"use client";

import { bulkRecordAttendanceAction } from "@/lib/actions/teacher";
import type { ClassStudent } from "@/lib/data/assessment";
import {
  CalendarCheck,
  CheckCircle2,
  ChevronUp,
  Clock,
  FileText,
  Save,
  Users,
  XCircle,
} from "lucide-react";
import { useState, useTransition } from "react";

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

interface Props {
  teacherName: string;
  grade: string;
  students: ClassStudent[];
  todayDate: string; // "YYYY-MM-DD"
  preFill: Record<string, { status: string; remarks: string }>;
}

const STATUS_CONFIG: Record<
  Status,
  {
    label: string;
    icon: React.ReactNode;
    ring: string;
    bg: string;
    text: string;
  }
> = {
  Present: {
    label: "Present",
    icon: <CheckCircle2 className="h-4 w-4" />,
    ring: "ring-2 ring-emerald-400",
    bg: "bg-emerald-500 text-white",
    text: "text-emerald-600",
  },
  Late: {
    label: "Late",
    icon: <Clock className="h-4 w-4" />,
    ring: "ring-2 ring-amber-400",
    bg: "bg-amber-400 text-white",
    text: "text-amber-600",
  },
  Absent: {
    label: "Absent",
    icon: <XCircle className="h-4 w-4" />,
    ring: "ring-2 ring-rose-400",
    bg: "bg-rose-500 text-white",
    text: "text-rose-600",
  },
  Excused: {
    label: "Excused",
    icon: <FileText className="h-4 w-4" />,
    ring: "ring-2 ring-sky-400",
    bg: "bg-sky-500 text-white",
    text: "text-sky-600",
  },
};

const STATUSES: Status[] = ["Present", "Late", "Absent", "Excused"];

function formatDateLong(iso: string) {
  return new Date(iso + "T00:00:00").toLocaleDateString("en-KE", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
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

export function ClassAttendanceClient({
  teacherName,
  grade,
  students,
  todayDate,
  preFill,
}: Props) {
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

  const [saved, setSaved] = useState(Object.keys(preFill).length > 0); // pre-mark as saved if already recorded
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [isPending, startTransition] = useTransition();

  function showToast(msg: string, ok: boolean) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 4000);
  }

  function setStatus(studentId: string, status: Status) {
    setSaved(false);
    setRows((prev) =>
      prev.map((r) => (r.studentId === studentId ? { ...r, status } : r)),
    );
  }

  function setRemarks(studentId: string, remarks: string) {
    setRows((prev) =>
      prev.map((r) => (r.studentId === studentId ? { ...r, remarks } : r)),
    );
  }

  function toggleRemarks(studentId: string) {
    setRows((prev) =>
      prev.map((r) =>
        r.studentId === studentId ? { ...r, remarksOpen: !r.remarksOpen } : r,
      ),
    );
  }

  // Mark all present at once
  function markAllPresent() {
    setSaved(false);
    setRows((prev) => prev.map((r) => ({ ...r, status: "Present" as Status })));
  }

  function handleSave() {
    startTransition(async () => {
      const records = rows.map((r) => ({
        studentId: r.studentId,
        status: r.status,
        date: todayDate,
        remarks: r.remarks || undefined,
      }));

      const res = await bulkRecordAttendanceAction(records);
      if (res.success) {
        setSaved(true);
        showToast(
          `Register saved — ${records.length} students recorded.`,
          true,
        );
      } else {
        showToast(res.message, false);
      }
    });
  }

  // Stats
  const counts = rows.reduce<Record<Status, number>>(
    (acc, r) => {
      acc[r.status] = (acc[r.status] ?? 0) + 1;
      return acc;
    },
    { Present: 0, Late: 0, Absent: 0, Excused: 0 },
  );
  const attendanceRate =
    rows.length > 0
      ? Math.round(((counts.Present + counts.Late) / rows.length) * 100)
      : 0;

  const absentRows = rows.filter(
    (r) => r.status === "Absent" || r.status === "Late",
  );

  return (
    <div className="min-h-screen bg-[#f5f6fa]">
      {/* ── Header ── */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 h-14 flex items-center gap-3">
          <CalendarCheck className="h-5 w-5 text-sky-500 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-black text-slate-800 truncate">
              {grade} Register
            </p>
            <p className="text-[10px] text-slate-400 font-semibold">
              {formatDateLong(todayDate)}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {saved && (
              <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-1 rounded-lg flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" /> Saved
              </span>
            )}
            <button
              onClick={handleSave}
              disabled={isPending}
              className="flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-xl bg-sky-600 text-white hover:bg-sky-700 disabled:opacity-50 transition-colors"
            >
              <Save className="h-3.5 w-3.5" />
              {isPending ? "Saving…" : "Save Register"}
            </button>
          </div>
        </div>
      </header>

      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl text-sm font-bold shadow-xl ${
            toast.ok ? "bg-emerald-600 text-white" : "bg-rose-500 text-white"
          }`}
        >
          {toast.msg}
        </div>
      )}

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-5 space-y-4">
        {/* ── Stats bar ── */}
        <div className="grid grid-cols-5 gap-2">
          <div className="col-span-1 bg-white rounded-2xl border border-slate-200 p-3 text-center shadow-sm">
            <p className="text-xl font-black text-slate-800">
              {attendanceRate}%
            </p>
            <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mt-0.5">
              Rate
            </p>
          </div>
          {STATUSES.map((s) => {
            const cfg = STATUS_CONFIG[s];
            return (
              <div
                key={s}
                className="bg-white rounded-2xl border border-slate-200 p-3 text-center shadow-sm"
              >
                <p className={`text-xl font-black ${cfg.text}`}>{counts[s]}</p>
                <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mt-0.5">
                  {s}
                </p>
              </div>
            );
          })}
        </div>

        {/* ── Quick actions ── */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={markAllPresent}
            className="flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors"
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            Mark All Present
          </button>
          <div className="flex items-center gap-1.5 text-xs text-slate-400 ml-auto">
            <Users className="h-3.5 w-3.5" />
            {rows.length} students
          </div>
        </div>

        {/* ── Student roster ── */}
        <div className="space-y-2">
          {rows.map((row, idx) => {
            const cfg = STATUS_CONFIG[row.status];
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
                  {/* Number + avatar */}
                  <div className="flex items-center gap-2 w-8 shrink-0">
                    <span className="text-[10px] font-bold text-slate-300 w-4 text-right">
                      {idx + 1}
                    </span>
                  </div>
                  <div
                    className={`h-9 w-9 rounded-xl flex items-center justify-center text-xs font-black shrink-0 ${
                      row.gender === "Female"
                        ? "bg-pink-100 text-pink-700"
                        : "bg-blue-100 text-blue-700"
                    }`}
                  >
                    {getInitials(row.full_name)}
                  </div>

                  {/* Name */}
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

                  {/* Status buttons */}
                  <div className="flex items-center gap-1 shrink-0">
                    {STATUSES.map((s) => {
                      const c = STATUS_CONFIG[s];
                      const active = row.status === s;
                      return (
                        <button
                          key={s}
                          onClick={() => setStatus(row.studentId, s)}
                          title={s}
                          className={`h-8 w-8 rounded-xl flex items-center justify-center transition-all ${
                            active
                              ? `${c.bg} ${c.ring} scale-105 shadow-sm`
                              : "bg-slate-100 text-slate-400 hover:bg-slate-200"
                          }`}
                        >
                          {c.icon}
                        </button>
                      );
                    })}

                    {/* Remarks toggle */}
                    <button
                      onClick={() => toggleRemarks(row.studentId)}
                      className="h-8 w-8 rounded-xl flex items-center justify-center text-slate-400 hover:bg-slate-100 transition-colors"
                      title="Add note"
                    >
                      {row.remarksOpen ? (
                        <ChevronUp className="h-3.5 w-3.5" />
                      ) : (
                        <FileText
                          className={`h-3.5 w-3.5 ${row.remarks ? "text-amber-500" : ""}`}
                        />
                      )}
                    </button>
                  </div>
                </div>

                {/* Expandable remarks */}
                {row.remarksOpen && (
                  <div className="px-4 pb-3 pt-0 border-t border-slate-100">
                    <input
                      type="text"
                      value={row.remarks}
                      onChange={(e) =>
                        setRemarks(row.studentId, e.target.value)
                      }
                      placeholder="Add a note (e.g. sick, left early)…"
                      className="w-full text-xs px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-300 focus:bg-white"
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* ── Absent/Late summary ── */}
        {absentRows.length > 0 && (
          <div className="bg-white rounded-2xl border border-rose-200 p-4 shadow-sm space-y-2">
            <p className="text-xs font-black uppercase tracking-wider text-rose-500">
              ⚠️ Requires Follow-up ({absentRows.length})
            </p>
            {absentRows.map((r) => (
              <div key={r.studentId} className="flex items-center gap-2">
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                    r.status === "Absent"
                      ? "bg-rose-50 text-rose-600 border border-rose-100"
                      : "bg-amber-50 text-amber-600 border border-amber-100"
                  }`}
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
              Parent notifications will be sent automatically when you save the
              register.
            </p>
          </div>
        )}

        {/* ── Save footer ── */}
        <div className="pb-6">
          <button
            onClick={handleSave}
            disabled={isPending}
            className="w-full py-3.5 rounded-2xl bg-sky-600 text-white font-black text-sm hover:bg-sky-700 disabled:opacity-50 transition-colors shadow-lg shadow-sky-200/50 flex items-center justify-center gap-2"
          >
            <Save className="h-4 w-4" />
            {isPending ? "Saving register…" : `Save ${grade} Register`}
          </button>
          <p className="text-center text-[10px] text-slate-400 mt-2">
            Parents of absent students will be notified automatically
          </p>
        </div>
      </div>
    </div>
  );
}
