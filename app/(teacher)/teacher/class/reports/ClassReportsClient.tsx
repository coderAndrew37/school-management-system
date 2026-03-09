"use client";

import {
  FileText,
  ChevronDown,
  Check,
  Loader2,
  Eye,
  AlertTriangle,
} from "lucide-react";
import { useState, useTransition } from "react";
import Link from "next/link";
import {
  saveReportCardAction,
  publishReportCardAction,
} from "@/lib/actions/report-card";
import { StudentReport, CbcScore, SubjectScore } from "./types";

interface Props {
  students: StudentReport[];
  grade: string;
  academicYear: number;
  classTeacherId: string;
}

const SCORE_STYLE: Record<
  CbcScore,
  { bg: string; text: string; border: string; numeric: number }
> = {
  EE: {
    bg: "bg-emerald-50",
    text: "text-emerald-700",
    border: "border-emerald-200",
    numeric: 4,
  },
  ME: {
    bg: "bg-blue-50",
    text: "text-blue-700",
    border: "border-blue-200",
    numeric: 3,
  },
  AE: {
    bg: "bg-amber-50",
    text: "text-amber-700",
    border: "border-amber-200",
    numeric: 2,
  },
  BE: {
    bg: "bg-rose-50",
    text: "text-rose-700",
    border: "border-rose-200",
    numeric: 1,
  },
};

const CONDUCT_OPTS = [
  "Excellent",
  "Good",
  "Satisfactory",
  "Needs Improvement",
] as const;
type ConductOpt = (typeof CONDUCT_OPTS)[number];

function avgScore(scores: SubjectScore[]): number {
  if (scores.length === 0) return 0;
  return (
    scores.reduce((s, x) => s + SCORE_STYLE[x.score].numeric, 0) / scores.length
  );
}

function overallLabel(avg: number): { label: string; score: CbcScore } {
  if (avg >= 3.5) return { label: "Exceeding Expectations", score: "EE" };
  if (avg >= 2.5) return { label: "Meeting Expectations", score: "ME" };
  if (avg >= 1.5) return { label: "Approaching Expectations", score: "AE" };
  return { label: "Below Expectations", score: "BE" };
}

function calcAge(dob: string) {
  if (!dob) return "—";
  const b = new Date(dob),
    n = new Date();
  let a = n.getFullYear() - b.getFullYear();
  if (
    n.getMonth() < b.getMonth() ||
    (n.getMonth() === b.getMonth() && n.getDate() < b.getDate())
  )
    a--;
  return a;
}

function groupBySubject(scores: SubjectScore[]) {
  const map = new Map<string, SubjectScore[]>();
  for (const s of scores) {
    const list = map.get(s.subject_name) ?? [];
    list.push(s);
    map.set(s.subject_name, list);
  }
  return map;
}

export function ClassReportsClient({
  students,
  grade,
  academicYear,
  classTeacherId,
}: Props) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [remarks, setRemarks] = useState<Record<string, string>>({});
  const [conduct, setConduct] = useState<Record<string, string>>({});
  const [effort, setEffort] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState<Record<string, boolean>>({});
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [isPending, startTrans] = useTransition();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<
    "all" | "pending" | "published"
  >("all");

  function showToast(msg: string, ok: boolean) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  }

  function openStudent(s: StudentReport) {
    if (!(s.id in remarks)) {
      setRemarks((r) => ({ ...r, [s.id]: s.class_teacher_remarks ?? "" }));
      setConduct((c) => ({ ...c, [s.id]: s.conduct_grade ?? "" }));
      setEffort((e) => ({ ...e, [s.id]: s.effort_grade ?? "" }));
    }
    setExpanded((prev) => (prev === s.id ? null : s.id));
  }

  function handleSave(s: StudentReport) {
    setPendingId(s.id);
    startTrans(async () => {
      const result = await saveReportCardAction({
        studentId: s.id,
        academicYear,
        classTeacherId,
        classTeacherRemarks: remarks[s.id] ?? "",
        conductGrade: (conduct[s.id] as ConductOpt) || null,
        effortGrade: (effort[s.id] as ConductOpt) || null,
        existingId: s.report_card_id,
      });
      if (result.success) {
        setSaved((sv) => ({ ...sv, [s.id]: true }));
        showToast(`${s.full_name.split(" ")[0]}'s report saved`, true);
      } else {
        showToast(result.error ?? "Save failed", false);
      }
      setPendingId(null);
    });
  }

  function handlePublish(s: StudentReport) {
    if (
      !confirm(
        `Publish ${s.full_name}'s report? Parents will see it immediately.`,
      )
    )
      return;
    setPendingId(s.id);
    startTrans(async () => {
      const result = await publishReportCardAction(s.id, academicYear);
      if (result.success) {
        showToast(
          `${s.full_name.split(" ")[0]}'s report published to parents`,
          true,
        );
      } else {
        showToast(result.error ?? "Publish failed", false);
      }
      setPendingId(null);
    });
  }

  const published = students.filter((s) => s.status === "published").length;
  const drafted = students.filter((s) => s.status === "draft").length;
  const noScores = students.filter((s) => s.scores.length === 0).length;

  const filtered = students.filter((s) => {
    if (filterStatus === "published") return s.status === "published";
    if (filterStatus === "pending") return s.status !== "published";
    return true;
  });

  return (
    <div className="min-h-screen bg-[#f5f6fa]">
      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl text-sm font-bold shadow-lg flex items-center gap-2 ${
            toast.ok ? "bg-emerald-600 text-white" : "bg-rose-500 text-white"
          }`}
        >
          {toast.ok && <Check className="h-4 w-4" />}
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-14 flex items-center gap-3">
          <Link
            href="/teacher"
            className="text-slate-400 hover:text-slate-600 transition-colors"
          >
            <ChevronDown className="h-5 w-5 rotate-90" />
          </Link>
          <FileText className="h-5 w-5 text-sky-500 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-black text-slate-800">
              Report Cards · {grade}
            </p>
            <p className="text-[10px] text-slate-400 font-semibold">
              {published} published · {drafted} draft ·{" "}
              {students.length - published - drafted} not started
            </p>
          </div>
          <Link
            href="/teacher/class/students"
            className="text-xs font-bold border border-slate-200 text-slate-600 hover:bg-slate-50 px-3 py-1.5 rounded-xl transition-colors"
          >
            My Class
          </Link>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-5 space-y-4">
        {/* Stat cards */}
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: "Total", value: students.length, cls: "text-slate-800" },
            {
              label: "Published",
              value: published,
              cls: published > 0 ? "text-emerald-600" : "text-slate-400",
            },
            {
              label: "Draft",
              value: drafted,
              cls: drafted > 0 ? "text-blue-600" : "text-slate-400",
            },
            {
              label: "No Scores",
              value: noScores,
              cls: noScores > 0 ? "text-amber-600" : "text-slate-400",
            },
          ].map(({ label, value, cls }) => (
            <div
              key={label}
              className="bg-white rounded-2xl border border-slate-200 p-3.5 shadow-sm text-center"
            >
              <p className={`text-2xl font-black ${cls}`}>{value}</p>
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mt-0.5">
                {label}
              </p>
            </div>
          ))}
        </div>

        {/* Progress bar */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
          <div className="flex justify-between items-center mb-2">
            <p className="text-xs font-bold text-slate-600">
              Publishing progress
            </p>
            <p className="text-xs font-black text-slate-700">
              {published} / {students.length}
            </p>
          </div>
          <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-400 rounded-full transition-all"
              style={{
                width:
                  students.length > 0
                    ? `${(published / students.length) * 100}%`
                    : "0%",
              }}
            />
          </div>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-2">
          {(["all", "pending", "published"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilterStatus(f)}
              className={`text-xs font-bold px-3 py-2 rounded-xl border capitalize transition-all ${
                filterStatus === f
                  ? "bg-sky-600 text-white border-sky-600"
                  : "bg-white text-slate-500 border-slate-200"
              }`}
            >
              {f === "all"
                ? `All (${students.length})`
                : f === "published"
                  ? `Published (${published})`
                  : `Pending (${students.length - published})`}
            </button>
          ))}
        </div>

        {/* Student cards */}
        <div className="space-y-3">
          {filtered.length === 0 && (
            <div className="text-center py-16 bg-white rounded-2xl border border-slate-200">
              <p className="text-3xl mb-2">📋</p>
              <p className="text-slate-500 font-semibold">
                No students in this view
              </p>
            </div>
          )}

          {filtered.map((s) => {
            const isOpen = expanded === s.id;
            const avg = avgScore(s.scores);
            const ol = overallLabel(avg);
            const ss = SCORE_STYLE[ol.score];
            const bySubject = groupBySubject(s.scores);
            const isLoading = pendingId === s.id && isPending;

            return (
              <div
                key={s.id}
                className={`bg-white rounded-2xl border shadow-sm overflow-hidden transition-all ${
                  s.status === "published"
                    ? "border-emerald-200"
                    : s.status === "draft"
                      ? "border-blue-200"
                      : "border-slate-200"
                }`}
              >
                {/* Collapsed row */}
                <button
                  onClick={() => openStudent(s)}
                  className="w-full flex items-center gap-3 px-4 py-4 hover:bg-slate-50 transition-colors text-left"
                >
                  <div className="h-10 w-10 rounded-xl bg-slate-100 flex items-center justify-center text-sm font-black text-slate-600 shrink-0">
                    {s.full_name
                      .split(" ")
                      .slice(0, 2)
                      .map((n: string) => n[0])
                      .join("")
                      .toUpperCase()}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-800">
                      {s.full_name}
                    </p>
                    <p className="text-[10px] text-slate-400">
                      {s.gender ?? "—"} · Age {calcAge(s.date_of_birth)}
                      {s.readable_id && (
                        <span className="font-mono text-amber-600 ml-1.5">
                          #{s.readable_id}
                        </span>
                      )}
                    </p>
                  </div>

                  {/* Overall CBC grade */}
                  <div className="text-center shrink-0">
                    {s.scores.length > 0 ? (
                      <>
                        <span
                          className={`text-xs font-black px-2.5 py-1 rounded-xl border ${ss.bg} ${ss.text} ${ss.border}`}
                        >
                          {ol.score}
                        </span>
                        <p className="text-[9px] text-slate-400 mt-0.5">
                          {s.scores.length} scores
                        </p>
                      </>
                    ) : (
                      <span className="text-[10px] text-slate-400 italic">
                        No scores
                      </span>
                    )}
                  </div>

                  {/* Attendance */}
                  <div className="text-center shrink-0 w-16">
                    <p
                      className={`text-sm font-black ${
                        s.attendance_rate >= 90
                          ? "text-emerald-600"
                          : s.attendance_rate >= 75
                            ? "text-amber-600"
                            : "text-rose-600"
                      }`}
                    >
                      {s.total_days > 0 ? `${s.attendance_rate}%` : "—"}
                    </p>
                    <p className="text-[9px] text-slate-400">Attend</p>
                  </div>

                  {/* Status badge */}
                  <div className="shrink-0">
                    {s.status === "published" ? (
                      <span className="text-[10px] font-black bg-emerald-50 text-emerald-600 border border-emerald-200 px-2.5 py-1 rounded-xl">
                        ✓ Published
                      </span>
                    ) : s.status === "draft" ? (
                      <span className="text-[10px] font-black bg-blue-50 text-blue-600 border border-blue-200 px-2.5 py-1 rounded-xl">
                        Draft
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold text-slate-400">
                        Not started
                      </span>
                    )}
                  </div>

                  <ChevronDown
                    className={`h-4 w-4 text-slate-300 shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`}
                  />
                </button>

                {/* Expanded editor */}
                {isOpen && (
                  <div className="border-t border-slate-100 px-5 pb-5 pt-4 space-y-5">
                    {/* Subject scores */}
                    {bySubject.size > 0 ? (
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-2.5">
                          Subject Scores
                        </p>
                        <div className="space-y-2">
                          {Array.from(bySubject.entries()).map(
                            ([subject, scores]) => {
                              const subAvg =
                                scores.reduce(
                                  (sum, x) =>
                                    sum + SCORE_STYLE[x.score].numeric,
                                  0,
                                ) / scores.length;
                              const subOl = overallLabel(subAvg);
                              const subSs = SCORE_STYLE[subOl.score];
                              const remark =
                                scores.find((sc) => sc.teacher_remarks)
                                  ?.teacher_remarks ?? null;
                              return (
                                <div
                                  key={subject}
                                  className="flex items-start gap-3 bg-slate-50 rounded-xl p-3 border border-slate-100"
                                >
                                  <div className="flex-1 min-w-0">
                                    <p className="text-xs font-bold text-slate-700">
                                      {subject}
                                    </p>
                                    <div className="flex flex-wrap gap-1 mt-1">
                                      {scores.map((sc) => {
                                        const scSs = SCORE_STYLE[sc.score];
                                        return (
                                          <span
                                            key={sc.strand_id}
                                            className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md border ${scSs.bg} ${scSs.text} ${scSs.border}`}
                                            title={sc.strand_id}
                                          >
                                            {sc.score}
                                          </span>
                                        );
                                      })}
                                    </div>
                                    {remark && (
                                      <p className="text-[10px] text-slate-500 mt-1 italic line-clamp-1">
                                        "{remark}"
                                      </p>
                                    )}
                                  </div>
                                  <span
                                    className={`shrink-0 text-xs font-black px-2.5 py-1 rounded-xl border ${subSs.bg} ${subSs.text} ${subSs.border}`}
                                  >
                                    {subOl.score}
                                  </span>
                                </div>
                              );
                            },
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
                        <p className="text-xs text-amber-700 font-semibold">
                          No subject scores yet — subject teachers need to enter
                          assessments first.
                        </p>
                      </div>
                    )}

                    {/* Attendance */}
                    <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-100">
                      <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-2">
                        Attendance
                      </p>
                      <div className="flex items-center gap-4">
                        <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              s.attendance_rate >= 90
                                ? "bg-emerald-400"
                                : s.attendance_rate >= 75
                                  ? "bg-amber-400"
                                  : "bg-rose-400"
                            }`}
                            style={{
                              width: `${Math.min(s.attendance_rate, 100)}%`,
                            }}
                          />
                        </div>
                        <p
                          className={`text-sm font-black tabular-nums ${
                            s.attendance_rate >= 90
                              ? "text-emerald-600"
                              : s.attendance_rate >= 75
                                ? "text-amber-600"
                                : "text-rose-600"
                          }`}
                        >
                          {s.total_days > 0
                            ? `${s.attendance_rate}%`
                            : "No data"}
                        </p>
                      </div>
                      {s.total_days > 0 && (
                        <p className="text-[10px] text-slate-400 mt-1.5">
                          {s.present} Present · {s.absent} Absent · {s.late}{" "}
                          Late · {s.total_days} total days
                        </p>
                      )}
                    </div>

                    {/* Conduct + Effort */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5">
                          Conduct
                        </label>
                        <select
                          aria-label="select conduct grade"
                          value={conduct[s.id] ?? ""}
                          onChange={(e) => {
                            setConduct((c) => ({
                              ...c,
                              [s.id]: e.target.value,
                            }));
                            setSaved((sv) => ({ ...sv, [s.id]: false }));
                          }}
                          className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-400"
                        >
                          <option value="">— Select —</option>
                          {CONDUCT_OPTS.map((o) => (
                            <option key={o} value={o}>
                              {o}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5">
                          Effort
                        </label>
                        <select
                          aria-label="select efforts grade"
                          value={effort[s.id] ?? ""}
                          onChange={(e) => {
                            setEffort((ef) => ({
                              ...ef,
                              [s.id]: e.target.value,
                            }));
                            setSaved((sv) => ({ ...sv, [s.id]: false }));
                          }}
                          className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-400"
                        >
                          <option value="">— Select —</option>
                          {CONDUCT_OPTS.map((o) => (
                            <option key={o} value={o}>
                              {o}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Class teacher remarks */}
                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5">
                        Class Teacher Remarks
                      </label>
                      <textarea
                        value={remarks[s.id] ?? ""}
                        onChange={(e) => {
                          setRemarks((r) => ({ ...r, [s.id]: e.target.value }));
                          setSaved((sv) => ({ ...sv, [s.id]: false }));
                        }}
                        rows={4}
                        placeholder="Write your remarks for this student's term performance…"
                        className="w-full text-sm border border-slate-200 rounded-xl px-4 py-3 bg-white text-slate-700 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-sky-400 resize-none leading-relaxed"
                      />
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleSave(s)}
                        disabled={isLoading}
                        className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-sm font-bold transition-colors disabled:opacity-50"
                      >
                        {isLoading && pendingId === s.id ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" /> Saving…
                          </>
                        ) : saved[s.id] ? (
                          <>
                            <Check className="h-4 w-4" /> Saved
                          </>
                        ) : (
                          "Save Draft"
                        )}
                      </button>

                      {s.status !== "published" && (
                        <button
                          onClick={() => handlePublish(s)}
                          disabled={isLoading}
                          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold transition-colors disabled:opacity-50"
                        >
                          <Eye className="h-4 w-4" />
                          Publish to Parents
                        </button>
                      )}

                      {s.status === "published" && (
                        <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-600">
                          <Check className="h-4 w-4" /> Live on parent portal
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
