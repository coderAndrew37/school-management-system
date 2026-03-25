"use client";
// app/teacher/conduct/ConductClient.tsx

import {
  createConductRecordAction,
  deleteConductRecordAction,
  notifyParentConductAction,
  updateConductRecordAction,
  type ConductRecord,
  type ConductType,
  type ConductCategory,
  type Severity,
} from "@/lib/actions/conduct";
import type { ClassStudent } from "@/lib/data/assessment";
import {
  AlertTriangle,
  Award,
  Bell,
  BookOpen,
  ChevronLeft,
  Minus,
  Plus,
  Shield,
  Trash2,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Props {
  teacherName: string;
  grades: string[];
  studentsByGrade: Record<string, ClassStudent[]>;
  initialRecords: ConductRecord[];
  term: number;
  academicYear: number;
}

interface FormState {
  grade: string;
  studentId: string;
  type: ConductType;
  category: ConductCategory;
  points: number;
  description: string;
  actionTaken: string;
  severity: Severity;
}

// ── Config ────────────────────────────────────────────────────────────────────

const TYPE_CFG: Record<
  ConductType,
  {
    label: string;
    icon: React.ReactNode;
    bg: string;
    text: string;
    border: string;
    dot: string;
    pointSign: 1 | -1 | 0;
  }
> = {
  merit: {
    label: "Merit",
    icon: <Award className="h-4 w-4" />,
    bg: "bg-emerald-50",
    text: "text-emerald-700",
    border: "border-emerald-200",
    dot: "bg-emerald-500",
    pointSign: 1,
  },
  demerit: {
    label: "Demerit",
    icon: <Minus className="h-4 w-4" />,
    bg: "bg-amber-50",
    text: "text-amber-700",
    border: "border-amber-200",
    dot: "bg-amber-400",
    pointSign: -1,
  },
  incident: {
    label: "Incident",
    icon: <AlertTriangle className="h-4 w-4" />,
    bg: "bg-rose-50",
    text: "text-rose-700",
    border: "border-rose-200",
    dot: "bg-rose-500",
    pointSign: 0,
  },
};

const CATEGORIES: ConductCategory[] = [
  "academic",
  "behaviour",
  "leadership",
  "sport",
  "community",
  "other",
];

const QUICK_DESCRIPTIONS: Record<ConductType, string[]> = {
  merit: [
    "Helped a classmate without being asked",
    "Outstanding performance in class activity",
    "Showed excellent leadership in group work",
    "Consistently punctual and prepared this week",
    "Went above and beyond on their assignment",
  ],
  demerit: [
    "Disrupted the class during lesson",
    "Failed to submit homework three times",
    "Disrespectful to a fellow student",
    "Using phone during class time",
    "Persistent late arrival without explanation",
  ],
  incident: [
    "Physical altercation with another student",
    "Bullying behaviour reported by peers",
    "Vandalism of school property",
    "Extreme defiance towards teacher instruction",
    "Absent without permission or parent note",
  ],
};

const SEVERITY_CFG: Record<Severity, { label: string; cls: string }> = {
  low: { label: "Low", cls: "bg-slate-100 text-slate-600" },
  medium: { label: "Medium", cls: "bg-amber-100 text-amber-700" },
  high: { label: "High", cls: "bg-rose-100 text-rose-700" },
};

function getInitials(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase();
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-KE", {
    day: "numeric",
    month: "short",
  });
}

// ── Student score summary ─────────────────────────────────────────────────────

function ScoreSummary({
  records,
  studentId,
}: {
  records: ConductRecord[];
  studentId: string;
}) {
  const mine = records.filter((r) => r.student_id === studentId);
  const net = mine.reduce((s, r) => s + r.points, 0);
  const merits = mine.filter((r) => r.type === "merit").length;
  const dems = mine.filter((r) => r.type === "demerit").length;
  const incs = mine.filter((r) => r.type === "incident").length;
  return (
    <div className="flex items-center gap-2 text-[10px] font-bold flex-wrap">
      <span
        className={`px-1.5 py-0.5 rounded-md ${net >= 0 ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}
      >
        {net >= 0 ? "+" : ""}
        {net} pts
      </span>
      {merits > 0 && <span className="text-emerald-600">{merits}M</span>}
      {dems > 0 && <span className="text-amber-600">{dems}D</span>}
      {incs > 0 && (
        <span className="text-rose-600">
          {incs} incident{incs !== 1 ? "s" : ""}
        </span>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function ConductClient({
  teacherName,
  grades,
  studentsByGrade,
  initialRecords,
  term,
  academicYear,
}: Props) {
  const firstGrade = grades[0] ?? "";

  const [records, setRecords] = useState<ConductRecord[]>(initialRecords);
  const [form, setForm] = useState<FormState>({
    grade: firstGrade,
    studentId: "",
    type: "merit",
    category: "behaviour",
    points: 1,
    description: "",
    actionTaken: "",
    severity: "low",
  });
  const [filterGrade, setFilterGrade] = useState("all");
  const [filterType, setFilterType] = useState<"all" | ConductType>("all");
  const [showForm, setShowForm] = useState(false);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [isPending, start] = useTransition();

  const students = studentsByGrade[form.grade] ?? [];

  function flash(msg: string, ok: boolean) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  }

  function handleSubmit() {
    if (!form.studentId) {
      flash("Select a student.", false);
      return;
    }
    if (!form.description.trim()) {
      flash("Enter a description.", false);
      return;
    }
    start(async () => {
      const res = await createConductRecordAction({
        student_id: form.studentId,
        grade: form.grade,
        academic_year: academicYear,
        term,
        type: form.type,
        category: form.category,
        points: form.points,
        description: form.description.trim(),
        action_taken: form.actionTaken || null,
        severity: form.type === "incident" ? form.severity : null,
      });
      if (!res.success) {
        flash(res.message, false);
        return;
      }
      flash(res.message, true);
      // Optimistic insert
      const student = students.find((s) => s.id === form.studentId);
      const pts =
        form.type === "merit"
          ? Math.abs(form.points)
          : form.type === "demerit"
            ? -Math.abs(form.points)
            : 0;
      setRecords((prev) => [
        {
          id: res.id ?? `temp-${Date.now()}`,
          student_id: form.studentId,
          student_name: student?.full_name ?? "Unknown",
          teacher_id: "",
          grade: form.grade,
          academic_year: academicYear,
          term,
          type: form.type,
          category: form.category,
          points: pts,
          description: form.description.trim(),
          action_taken: form.actionTaken || null,
          parent_notified: false,
          parent_ack_at: null,
          severity: form.type === "incident" ? form.severity : null,
          is_resolved: false,
          created_at: new Date().toISOString(),
        },
        ...prev,
      ]);
      setForm((f) => ({
        ...f,
        studentId: "",
        description: "",
        actionTaken: "",
      }));
      setShowForm(false);
    });
  }

  function handleNotify(id: string) {
    start(async () => {
      const res = await notifyParentConductAction(id);
      if (res.success) {
        setRecords((prev) =>
          prev.map((r) => (r.id === id ? { ...r, parent_notified: true } : r)),
        );
        flash("Parent notified.", true);
      } else {
        flash(res.message, false);
      }
    });
  }

  function handleDelete(id: string) {
    start(async () => {
      const res = await deleteConductRecordAction(id);
      if (res.success) {
        setRecords((prev) => prev.filter((r) => r.id !== id));
        flash("Record deleted.", true);
      } else {
        flash(res.message, false);
      }
    });
  }

  function handleResolve(id: string) {
    start(async () => {
      const res = await updateConductRecordAction(id, { is_resolved: true });
      if (res.success) {
        setRecords((prev) =>
          prev.map((r) => (r.id === id ? { ...r, is_resolved: true } : r)),
        );
        flash("Marked as resolved.", true);
      } else flash(res.message, false);
    });
  }

  const filtered = records.filter((r) => {
    if (filterGrade !== "all" && r.grade !== filterGrade) return false;
    if (filterType !== "all" && r.type !== filterType) return false;
    return true;
  });

  const totalPoints = records.reduce((s, r) => s + r.points, 0);
  const meritCount = records.filter((r) => r.type === "merit").length;
  const demeritCount = records.filter((r) => r.type === "demerit").length;
  const incidentCount = records.filter(
    (r) => r.type === "incident" && !r.is_resolved,
  ).length;

  // Top students by merit points
  const studentTotals = new Map<
    string,
    { name: string; pts: number; grade: string }
  >();
  for (const r of records) {
    const cur = studentTotals.get(r.student_id) ?? {
      name: r.student_name,
      pts: 0,
      grade: r.grade,
    };
    cur.pts += r.points;
    studentTotals.set(r.student_id, cur);
  }
  const topStudents = [...studentTotals.entries()]
    .sort(([, a], [, b]) => b.pts - a.pts)
    .slice(0, 5);

  return (
    <div className="min-h-screen bg-[#f5f6fa]">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center gap-3">
          <Shield className="h-5 w-5 text-violet-600 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-black text-slate-800 leading-none">
              Conduct & Merits
            </p>
            <p className="text-[10px] text-slate-400 mt-0.5">
              {teacherName} · Term {term} {academicYear}
            </p>
          </div>
          <Link
            href="/teacher"
            className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-700 transition-colors"
          >
            <ChevronLeft className="h-3.5 w-3.5" /> Dashboard
          </Link>
          <button
            onClick={() => setShowForm((v) => !v)}
            className="flex items-center gap-1.5 text-xs font-bold px-3.5 py-2 rounded-xl bg-violet-600 text-white hover:bg-violet-700 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" /> Log Record
          </button>
        </div>
      </header>

      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl text-sm font-bold shadow-xl ${toast.ok ? "bg-emerald-600 text-white" : "bg-rose-500 text-white"}`}
        >
          {toast.msg}
        </div>
      )}

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-5 space-y-5">
        {/* Summary cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            {
              label: "Net Points",
              value: totalPoints >= 0 ? `+${totalPoints}` : `${totalPoints}`,
              cls: totalPoints >= 0 ? "text-emerald-600" : "text-rose-600",
            },
            { label: "Merits", value: meritCount, cls: "text-emerald-600" },
            { label: "Demerits", value: demeritCount, cls: "text-amber-600" },
            {
              label: "Open Incidents",
              value: incidentCount,
              cls: incidentCount > 0 ? "text-rose-600" : "text-slate-400",
            },
          ].map(({ label, value, cls }) => (
            <div
              key={label}
              className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm text-center"
            >
              <p className={`text-3xl font-black ${cls}`}>{value}</p>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mt-1">
                {label}
              </p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-5 items-start">
          {/* Left: form + leaderboard */}
          <div className="space-y-4">
            {/* Form */}
            {showForm && (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
                  <p className="text-sm font-black text-slate-700">
                    New Record
                  </p>
                  <button
                    onClick={() => setShowForm(false)}
                    className="text-xs text-slate-400 hover:text-slate-600"
                  >
                    Cancel
                  </button>
                </div>
                <div className="px-5 py-4 space-y-4">
                  {/* Type selector */}
                  <div className="grid grid-cols-3 gap-1.5">
                    {(["merit", "demerit", "incident"] as ConductType[]).map(
                      (t) => {
                        const cfg = TYPE_CFG[t];
                        return (
                          <button
                            key={t}
                            onClick={() => setForm((f) => ({ ...f, type: t }))}
                            className={`flex flex-col items-center gap-1 py-2.5 rounded-xl border text-xs font-bold transition-all ${form.type === t ? `${cfg.bg} ${cfg.text} ${cfg.border}` : "bg-slate-50 text-slate-500 border-slate-200 hover:border-slate-300"}`}
                          >
                            {cfg.icon}
                            {cfg.label}
                          </button>
                        );
                      },
                    )}
                  </div>

                  {/* Grade */}
                  {grades.length > 1 && (
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                        Class
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {grades.map((g) => (
                          <button
                            key={g}
                            onClick={() =>
                              setForm((f) => ({
                                ...f,
                                grade: g,
                                studentId: "",
                              }))
                            }
                            className={`px-3 py-1.5 rounded-lg border text-xs font-bold transition-all ${form.grade === g ? "bg-emerald-600 text-white border-emerald-600" : "bg-white text-slate-600 border-slate-200 hover:border-emerald-300"}`}
                          >
                            {g}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Student */}
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                      Student
                    </p>
                    <select
                      value={form.studentId}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, studentId: e.target.value }))
                      }
                      aria-label="select student"
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-violet-400"
                    >
                      <option value="">— Select student —</option>
                      {students.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.full_name}
                          {records.some((r) => r.student_id === s.id)
                            ? " ●"
                            : ""}
                        </option>
                      ))}
                    </select>
                    {form.studentId && (
                      <div className="mt-1">
                        <ScoreSummary
                          records={records}
                          studentId={form.studentId}
                        />
                      </div>
                    )}
                  </div>

                  {/* Category */}
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                      Category
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {CATEGORIES.map((cat) => (
                        <button
                          key={cat}
                          onClick={() =>
                            setForm((f) => ({ ...f, category: cat }))
                          }
                          className={`px-2.5 py-1 rounded-lg text-xs font-bold border capitalize transition-all ${form.category === cat ? "bg-slate-800 text-white border-slate-800" : "bg-white text-slate-500 border-slate-200 hover:border-slate-300"}`}
                        >
                          {cat}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Points (not for incidents) */}
                  {form.type !== "incident" && (
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                        Points
                      </p>
                      <div className="flex items-center gap-2">
                        <button
                          aria-label="points"
                          onClick={() =>
                            setForm((f) => ({
                              ...f,
                              points: Math.max(1, f.points - 1),
                            }))
                          }
                          className="h-8 w-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-50"
                        >
                          <Minus className="h-3.5 w-3.5" />
                        </button>
                        <span className="text-lg font-black text-slate-800 w-8 text-center">
                          {form.points}
                        </span>
                        <button
                          aria-label="points"
                          onClick={() =>
                            setForm((f) => ({
                              ...f,
                              points: Math.min(10, f.points + 1),
                            }))
                          }
                          className="h-8 w-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-50"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Severity (incidents only) */}
                  {form.type === "incident" && (
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                        Severity
                      </p>
                      <div className="flex gap-2">
                        {(["low", "medium", "high"] as Severity[]).map((s) => (
                          <button
                            key={s}
                            aria-label={`severity-${s}`}
                            onClick={() =>
                              setForm((f) => ({ ...f, severity: s }))
                            }
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold border capitalize transition-all ${form.severity === s ? SEVERITY_CFG[s].cls + " border-current" : "bg-white text-slate-500 border-slate-200"}`}
                          >
                            {s}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Description */}
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                      Description
                    </p>
                    <textarea
                      value={form.description}
                      rows={3}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, description: e.target.value }))
                      }
                      placeholder="What happened / what did the student do?"
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-violet-400 resize-none placeholder-slate-300"
                    />
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {QUICK_DESCRIPTIONS[form.type].map((d) => (
                        <button
                          key={d}
                          onClick={() =>
                            setForm((f) => ({ ...f, description: d }))
                          }
                          className="px-2 py-0.5 text-[10px] rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors"
                        >
                          {d}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Action taken */}
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                      Action Taken{" "}
                      <span className="font-normal normal-case">
                        (optional)
                      </span>
                    </p>
                    <input
                      type="text"
                      value={form.actionTaken}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, actionTaken: e.target.value }))
                      }
                      placeholder="e.g. Letter sent home, counselling, detention…"
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-violet-400 placeholder-slate-300"
                    />
                  </div>
                </div>

                <div className="px-5 py-4 border-t border-slate-100 bg-slate-50">
                  <button
                    onClick={handleSubmit}
                    disabled={isPending}
                    className="w-full py-2.5 rounded-xl bg-violet-600 text-white text-sm font-black hover:bg-violet-700 disabled:opacity-50 transition-colors"
                  >
                    {isPending
                      ? "Saving…"
                      : `Save ${TYPE_CFG[form.type].label} Record`}
                  </button>
                </div>
              </div>
            )}

            {/* Leaderboard */}
            {topStudents.length > 0 && (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-5 py-3.5 border-b border-slate-100">
                  <p className="text-xs font-black uppercase tracking-wider text-slate-500">
                    Term Leaderboard
                  </p>
                </div>
                <div className="divide-y divide-slate-100">
                  {topStudents.map(([id, { name, pts, grade }], i) => (
                    <div key={id} className="flex items-center gap-3 px-5 py-3">
                      <span className="text-sm font-black text-slate-300 w-5">
                        {i + 1}
                      </span>
                      <div
                        className={`h-8 w-8 rounded-xl flex items-center justify-center text-[10px] font-black shrink-0 ${pts >= 0 ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}
                      >
                        {getInitials(name)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-slate-800 truncate">
                          {name}
                        </p>
                        <p className="text-[10px] text-slate-400">{grade}</p>
                      </div>
                      <span
                        className={`text-sm font-black ${pts >= 0 ? "text-emerald-600" : "text-rose-600"}`}
                      >
                        {pts >= 0 ? "+" : ""}
                        {pts}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right: Records feed */}
          <div className="space-y-4">
            {/* Filters */}
            <div className="bg-white rounded-2xl border border-slate-200 px-4 py-3 shadow-sm flex flex-wrap items-center gap-3">
              {grades.length > 1 && (
                <select
                  aria-label="filter grades"
                  value={filterGrade}
                  onChange={(e) => setFilterGrade(e.target.value)}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-600 bg-white focus:outline-none"
                >
                  <option value="all">All classes</option>
                  {grades.map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </select>
              )}
              <div className="flex gap-1">
                {(["all", "merit", "demerit", "incident"] as const).map((t) => (
                  <button
                    key={t}
                    aria-label={`filter-${t}`}
                    onClick={() => setFilterType(t)}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-bold border capitalize transition-all ${filterType === t ? "bg-slate-800 text-white border-slate-800" : "bg-white text-slate-500 border-slate-200 hover:border-slate-300"}`}
                  >
                    {t === "all"
                      ? `All (${records.length})`
                      : TYPE_CFG[t].label}
                  </button>
                ))}
              </div>
              <span className="ml-auto text-xs text-slate-400">
                {filtered.length} records
              </span>
            </div>

            {/* Cards */}
            {filtered.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-14 text-center shadow-sm">
                <Shield className="h-8 w-8 text-slate-200 mx-auto mb-3" />
                <p className="text-slate-400 text-sm">No records yet.</p>
                <p className="text-slate-300 text-xs mt-1">
                  Log a merit, demerit, or incident above.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {filtered.map((r) => {
                  const cfg = TYPE_CFG[r.type];
                  return (
                    <div
                      key={r.id}
                      className={`bg-white rounded-2xl border shadow-sm transition-all ${cfg.border} ${r.is_resolved ? "opacity-60" : ""}`}
                    >
                      <div className="flex items-start gap-3 px-4 py-3.5">
                        <div
                          className={`mt-0.5 w-2 h-2 rounded-full shrink-0 ${cfg.dot}`}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span
                                  className={`text-xs font-black px-2 py-0.5 rounded-lg border ${cfg.bg} ${cfg.text} ${cfg.border}`}
                                >
                                  {cfg.label}
                                  {r.points !== 0
                                    ? ` · ${r.points > 0 ? "+" : ""}${r.points}pts`
                                    : ""}
                                </span>
                                {r.type === "incident" && r.severity && (
                                  <span
                                    className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${SEVERITY_CFG[r.severity].cls}`}
                                  >
                                    {SEVERITY_CFG[r.severity].label}
                                  </span>
                                )}
                                {r.is_resolved && (
                                  <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-md">
                                    Resolved
                                  </span>
                                )}
                              </div>
                              <p className="text-sm font-bold text-slate-800 mt-1">
                                {r.student_name}
                              </p>
                              <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                                {r.description}
                              </p>
                              {r.action_taken && (
                                <p className="text-[10px] text-slate-400 mt-1 italic">
                                  Action: {r.action_taken}
                                </p>
                              )}
                              <p className="text-[10px] text-slate-300 mt-1.5">
                                {fmtDate(r.created_at)} · {r.category}
                              </p>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              {!r.parent_notified && (
                                <button
                                  onClick={() => handleNotify(r.id)}
                                  disabled={isPending}
                                  title="Notify parent"
                                  className="h-7 w-7 rounded-lg flex items-center justify-center text-slate-300 hover:text-violet-600 hover:bg-violet-50 transition-colors"
                                >
                                  <Bell className="h-3.5 w-3.5" />
                                </button>
                              )}
                              {r.parent_notified && !r.parent_ack_at && (
                                <span
                                  title="Parent notified — awaiting acknowledgement"
                                  className="h-7 w-7 rounded-lg flex items-center justify-center text-violet-400"
                                >
                                  <Bell className="h-3.5 w-3.5" />
                                </span>
                              )}
                              {r.type === "incident" && !r.is_resolved && (
                                <button
                                  onClick={() => handleResolve(r.id)}
                                  disabled={isPending}
                                  title="Mark resolved"
                                  className="h-7 w-7 rounded-lg flex items-center justify-center text-slate-300 hover:text-emerald-600 hover:bg-emerald-50 transition-colors"
                                >
                                  <Shield className="h-3.5 w-3.5" />
                                </button>
                              )}
                              <button
                                onClick={() => handleDelete(r.id)}
                                disabled={isPending}
                                title="Delete"
                                className="h-7 w-7 rounded-lg flex items-center justify-center text-slate-300 hover:text-rose-500 hover:bg-rose-50 transition-colors"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                          {r.parent_ack_at && (
                            <p className="text-[10px] text-emerald-600 mt-1.5">
                              ✓ Parent acknowledged {fmtDate(r.parent_ack_at)}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
