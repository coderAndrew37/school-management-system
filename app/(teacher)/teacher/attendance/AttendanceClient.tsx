"use client";

import { useState, useTransition, useCallback } from "react";
import { bulkRecordAttendanceAction } from "@/lib/actions/teacher";
import type { ClassStudent } from "@/lib/data/assessment";

// ── Types ─────────────────────────────────────────────────────────────────────

type AttendanceStatus = "Present" | "Absent" | "Late";

interface AttendanceRow {
  studentId: string;
  status: AttendanceStatus;
  remarks: string;
}

interface Props {
  teacherName: string;
  grades: string[];
  studentsByGrade: Record<string, ClassStudent[]>;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function today(): string {
  return new Date().toISOString().split("T")[0];
}

const STATUS_CONFIG: Record<
  AttendanceStatus,
  { label: string; bg: string; activeBg: string; ring: string; dot: string }
> = {
  Present: {
    label: "P",
    bg: "bg-white hover:bg-emerald-50 text-slate-400 border-slate-200",
    activeBg:
      "bg-emerald-500 text-white border-emerald-500 shadow-sm shadow-emerald-200",
    ring: "ring-emerald-400",
    dot: "bg-emerald-500",
  },
  Late: {
    label: "L",
    bg: "bg-white hover:bg-amber-50 text-slate-400 border-slate-200",
    activeBg:
      "bg-amber-400 text-white border-amber-400 shadow-sm shadow-amber-200",
    ring: "ring-amber-400",
    dot: "bg-amber-400",
  },
  Absent: {
    label: "A",
    bg: "bg-white hover:bg-red-50 text-slate-400 border-slate-200",
    activeBg: "bg-red-500 text-white border-red-500 shadow-sm shadow-red-200",
    ring: "ring-red-400",
    dot: "bg-red-500",
  },
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function AttendanceClient({
  teacherName,
  grades,
  studentsByGrade,
}: Props) {
  const [selectedGrade, setSelectedGrade] = useState<string>(grades[0] ?? "");
  const [selectedDate, setSelectedDate] = useState<string>(today());
  const [rows, setRows] = useState<Record<string, AttendanceRow>>({});
  const [showRemarks, setShowRemarks] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const students = studentsByGrade[selectedGrade] ?? [];

  // Initialise rows when grade changes
  const initRows = useCallback(
    (grade: string) => {
      const fresh: Record<string, AttendanceRow> = {};
      for (const s of studentsByGrade[grade] ?? []) {
        fresh[s.id] = { studentId: s.id, status: "Present", remarks: "" };
      }
      setRows(fresh);
      setSaved(false);
      setError(null);
    },
    [studentsByGrade],
  );

  const handleGradeChange = (grade: string) => {
    setSelectedGrade(grade);
    initRows(grade);
  };

  // Set status for one student
  const setStatus = (studentId: string, status: AttendanceStatus) => {
    setRows((prev) => ({
      ...prev,
      [studentId]: { ...prev[studentId], studentId, status },
    }));
    setSaved(false);
  };

  // Mark all as one status
  const markAll = (status: AttendanceStatus) => {
    const next: Record<string, AttendanceRow> = {};
    for (const s of students) {
      next[s.id] = {
        ...(rows[s.id] ?? { studentId: s.id, remarks: "" }),
        status,
      };
    }
    setRows(next);
    setSaved(false);
  };

  const setRemarks = (studentId: string, remarks: string) => {
    setRows((prev) => ({
      ...prev,
      [studentId]: { ...prev[studentId], studentId, remarks },
    }));
  };

  // Stats
  const statuses = students.map((s) => rows[s.id]?.status ?? "Present");
  const counts = {
    Present: statuses.filter((s) => s === "Present").length,
    Late: statuses.filter((s) => s === "Late").length,
    Absent: statuses.filter((s) => s === "Absent").length,
  };

  // Save
  const handleSave = () => {
    setError(null);
    const records = students.map((s) => ({
      studentId: s.id,
      status: rows[s.id]?.status ?? "Present",
      date: selectedDate,
      remarks: rows[s.id]?.remarks || undefined,
    }));

    startTransition(async () => {
      const result = await bulkRecordAttendanceAction(records);
      if (result.success) {
        setSaved(true);
      } else {
        setError(result.message);
      }
    });
  };

  if (grades.length === 0) {
    return (
      <div className="min-h-screen bg-[#F8F7F2] flex items-center justify-center">
        <div className="text-center">
          <p className="text-slate-500 text-lg">No classes allocated yet.</p>
          <p className="text-slate-400 text-sm mt-1">
            Contact the administrator to assign you a class.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8F7F2]">
      {/* ── Header ── */}
      <div className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-slate-800 tracking-tight">
              Attendance Register
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">{teacherName}</p>
          </div>
          <a
            href="/teacher"
            className="text-sm text-slate-500 hover:text-slate-700 flex items-center gap-1.5"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18"
              />
            </svg>
            Dashboard
          </a>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-6 space-y-5">
        {/* ── Controls ── */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex flex-col sm:flex-row gap-4">
            {/* Grade picker */}
            <div className="flex-1">
              <label className="block text-xs font-medium text-slate-500 mb-1.5 uppercase tracking-wide">
                Class / Grade
              </label>
              <div className="flex flex-wrap gap-2">
                {grades.map((g) => (
                  <button
                    key={g}
                    onClick={() => handleGradeChange(g)}
                    className={`px-4 py-2 rounded-lg border text-sm font-medium transition-all ${
                      selectedGrade === g
                        ? "bg-emerald-600 text-white border-emerald-600 shadow-sm"
                        : "bg-white text-slate-600 border-slate-200 hover:border-emerald-300 hover:text-emerald-700"
                    }`}
                  >
                    {g}
                  </button>
                ))}
              </div>
            </div>

            {/* Date picker */}
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1.5 uppercase tracking-wide">
                Date
              </label>
              <input
                aria-label="select attendance date"
                type="date"
                value={selectedDate}
                max={today()}
                onChange={(e) => {
                  setSelectedDate(e.target.value);
                  setSaved(false);
                }}
                className="px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent"
              />
            </div>
          </div>
        </div>

        {/* ── Stats bar ── */}
        <div className="grid grid-cols-3 gap-3">
          {(["Present", "Late", "Absent"] as AttendanceStatus[]).map(
            (status) => (
              <div
                key={status}
                className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-3"
              >
                <div
                  className={`w-3 h-3 rounded-full ${STATUS_CONFIG[status].dot}`}
                />
                <div>
                  <div className="text-2xl font-bold text-slate-800 leading-none">
                    {counts[status]}
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5">{status}</div>
                </div>
              </div>
            ),
          )}
        </div>

        {/* ── Quick mark all ── */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400 uppercase tracking-wide font-medium mr-1">
            Mark all:
          </span>
          {(["Present", "Late", "Absent"] as AttendanceStatus[]).map(
            (status) => (
              <button
                key={status}
                onClick={() => markAll(status)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${STATUS_CONFIG[status].bg}`}
              >
                All {status}
              </button>
            ),
          )}
        </div>

        {/* ── Roll list ── */}
        {students.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-10 text-center">
            <p className="text-slate-400">No students in {selectedGrade}.</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="divide-y divide-slate-100">
              {students.map((student, idx) => {
                const row = rows[student.id];
                const currentStatus: AttendanceStatus =
                  row?.status ?? "Present";
                return (
                  <div
                    key={student.id}
                    className="px-5 py-3 flex items-center gap-4"
                  >
                    {/* Number */}
                    <span className="text-xs text-slate-300 w-6 text-right shrink-0">
                      {idx + 1}
                    </span>

                    {/* Name */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">
                        {student.full_name}
                      </p>
                      {student.readable_id && (
                        <p className="text-xs text-slate-400">
                          {student.readable_id}
                        </p>
                      )}
                    </div>

                    {/* Status buttons */}
                    <div className="flex gap-1.5 shrink-0">
                      {(
                        ["Present", "Late", "Absent"] as AttendanceStatus[]
                      ).map((status) => {
                        const cfg = STATUS_CONFIG[status];
                        const isActive = currentStatus === status;
                        return (
                          <button
                            key={status}
                            onClick={() => setStatus(student.id, status)}
                            title={status}
                            className={`w-8 h-8 rounded-lg border text-xs font-bold transition-all ${
                              isActive ? cfg.activeBg : cfg.bg
                            }`}
                          >
                            {cfg.label}
                          </button>
                        );
                      })}
                    </div>

                    {/* Remarks toggle */}
                    <button
                      onClick={() =>
                        setShowRemarks(
                          showRemarks === student.id ? null : student.id,
                        )
                      }
                      className={`shrink-0 p-1.5 rounded-lg transition-colors ${
                        row?.remarks
                          ? "text-indigo-500 bg-indigo-50"
                          : "text-slate-300 hover:text-slate-400 hover:bg-slate-50"
                      }`}
                      title="Add remarks"
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1.5}
                          d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z"
                        />
                      </svg>
                    </button>
                  </div>
                );
              })}

              {/* Inline remarks panels */}
              {showRemarks && (
                <div className="px-5 py-3 bg-slate-50 border-t border-slate-100">
                  <textarea
                    autoFocus
                    value={rows[showRemarks]?.remarks ?? ""}
                    onChange={(e) => setRemarks(showRemarks, e.target.value)}
                    placeholder="Add a remark for this student…"
                    rows={2}
                    className="w-full text-sm px-3 py-2 rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none placeholder-slate-300"
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Save bar ── */}
        <div className="sticky bottom-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-lg shadow-slate-200/60 px-5 py-4 flex items-center justify-between">
            <div className="text-sm text-slate-500">
              {students.length} students · {selectedGrade} · {selectedDate}
            </div>
            <div className="flex items-center gap-3">
              {saved && (
                <span className="text-sm text-emerald-600 flex items-center gap-1.5">
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  Saved
                </span>
              )}
              {error && <span className="text-sm text-red-500">{error}</span>}
              <button
                onClick={handleSave}
                disabled={isPending || students.length === 0}
                className="px-5 py-2.5 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isPending ? "Saving…" : "Save Attendance"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
