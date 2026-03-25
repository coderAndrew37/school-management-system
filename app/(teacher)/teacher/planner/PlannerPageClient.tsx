"use client";
// app/teacher/planner/PlannerClient.tsx

import {
  upsertLessonPlanAction,
  updatePlanStatusAction,
  deleteLessonPlanAction,
  type LessonPlan,
  type PlanStatus,
} from "@/lib/actions/planner";
import type { TeacherAllocationSummary } from "@/lib/data/assessment";
import { formatStrand } from "@/lib/types/assessment";
import {
  BookOpen,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Circle,
  Clock,
  SkipForward,
  Trash2,
  Plus,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState, useTransition } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Props {
  teacherName: string;
  allocations: TeacherAllocationSummary[];
  initialPlans: LessonPlan[];
  selectedSubject: string;
  selectedGrade: string;
  term: number;
  academicYear: number;
  strandIds: string[];
}

const WEEKS = Array.from({ length: 13 }, (_, i) => i + 1); // 13 teaching weeks per term

const STATUS_CFG: Record<
  PlanStatus,
  {
    label: string;
    icon: React.ReactNode;
    bg: string;
    text: string;
    border: string;
    ring: string;
  }
> = {
  planned: {
    label: "Planned",
    icon: <Circle className="h-3.5 w-3.5" />,
    bg: "bg-slate-100",
    text: "text-slate-500",
    border: "border-slate-200",
    ring: "ring-slate-200",
  },
  in_progress: {
    label: "In Progress",
    icon: <Clock className="h-3.5 w-3.5" />,
    bg: "bg-sky-50",
    text: "text-sky-700",
    border: "border-sky-200",
    ring: "ring-sky-300",
  },
  taught: {
    label: "Taught",
    icon: <CheckCircle2 className="h-3.5 w-3.5" />,
    bg: "bg-emerald-50",
    text: "text-emerald-700",
    border: "border-emerald-200",
    ring: "ring-emerald-300",
  },
  skipped: {
    label: "Skipped",
    icon: <SkipForward className="h-3.5 w-3.5" />,
    bg: "bg-amber-50",
    text: "text-amber-700",
    border: "border-amber-200",
    ring: "ring-amber-300",
  },
};

const STATUS_ORDER: PlanStatus[] = [
  "planned",
  "in_progress",
  "taught",
  "skipped",
];

// ── Week card ─────────────────────────────────────────────────────────────────

function WeekCard({
  week,
  plan,
  strandIds,
  onSave,
  onStatus,
  onDelete,
  isPending,
}: {
  week: number;
  plan: LessonPlan | undefined;
  strandIds: string[];
  onSave: (week: number, data: Partial<LessonPlan>) => void;
  onStatus: (id: string, status: PlanStatus) => void;
  onDelete: (id: string) => void;
  isPending: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [topic, setTopic] = useState(plan?.topic ?? "");
  const [objectives, setObjectives] = useState(plan?.objectives ?? "");
  const [activities, setActivities] = useState(plan?.activities ?? "");
  const [resources, setResources] = useState(plan?.resources ?? "");
  const [strandId, setStrandId] = useState(plan?.strand_id ?? "");
  const [notes, setNotes] = useState(plan?.notes ?? "");
  const [dirty, setDirty] = useState(false);

  const status = plan?.status ?? "planned";
  const cfg = STATUS_CFG[status];

  function handleSave() {
    if (!topic.trim()) return;
    onSave(week, {
      topic: topic.trim(),
      objectives,
      activities,
      resources,
      strand_id: strandId || null,
      notes,
    });
    setDirty(false);
  }

  const taught = status === "taught";
  const bgRow = taught ? "opacity-70" : "";

  return (
    <div
      className={`bg-white rounded-2xl border shadow-sm overflow-hidden transition-all ${cfg.border} ${bgRow}`}
    >
      {/* Row header */}
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="flex items-center justify-center w-8 h-8 rounded-xl bg-slate-100 text-slate-600 text-xs font-black shrink-0">
          W{week}
        </div>
        <div className="flex-1 min-w-0">
          {plan?.topic ? (
            <p
              className={`text-sm font-bold truncate ${taught ? "line-through text-slate-400" : "text-slate-800"}`}
            >
              {plan.topic}
            </p>
          ) : (
            <p className="text-sm text-slate-300 italic">
              Click to plan week {week}
            </p>
          )}
          {plan?.strand_id && (
            <p className="text-[10px] text-slate-400 mt-0.5">
              {formatStrand(plan.strand_id)}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {plan && (
            <div
              className={`flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-lg border ${cfg.bg} ${cfg.text} ${cfg.border}`}
            >
              {cfg.icon}
              {cfg.label}
            </div>
          )}
          <ChevronRight
            className={`h-4 w-4 text-slate-300 transition-transform ${expanded ? "rotate-90" : ""}`}
          />
        </div>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t border-slate-100 px-4 pb-4 pt-3 space-y-3">
          {/* Status cycle */}
          {plan && (
            <div className="flex gap-1.5 flex-wrap">
              {STATUS_ORDER.map((s) => (
                <button
                  key={s}
                  onClick={() => onStatus(plan.id, s)}
                  disabled={isPending}
                  className={`flex items-center gap-1 text-[10px] font-bold px-2.5 py-1.5 rounded-lg border transition-all ${
                    status === s
                      ? `${STATUS_CFG[s].bg} ${STATUS_CFG[s].text} ${STATUS_CFG[s].border} ring-1 ${STATUS_CFG[s].ring}`
                      : "bg-white text-slate-400 border-slate-200 hover:border-slate-300"
                  }`}
                >
                  {STATUS_CFG[s].icon}
                  {STATUS_CFG[s].label}
                </button>
              ))}
            </div>
          )}

          {/* Strand selector */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
              Strand / Sub-strand
            </p>
            <select
              disabled={isPending}
              aria-label="select strand"
              value={strandId}
              onChange={(e) => {
                setStrandId(e.target.value);
                setDirty(true);
              }}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-400"
            >
              <option value="">— Select strand —</option>
              {strandIds.map((s) => (
                <option key={s} value={s}>
                  {formatStrand(s)}
                </option>
              ))}
            </select>
          </div>

          {/* Topic */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
              Topic / Theme
            </p>
            <input
              type="text"
              value={topic}
              onChange={(e) => {
                setTopic(e.target.value);
                setDirty(true);
              }}
              placeholder="What will be taught this week?"
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-400 placeholder-slate-300"
            />
          </div>

          {/* Objectives */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
              Learning Objectives
            </p>
            <textarea
              value={objectives}
              rows={2}
              onChange={(e) => {
                setObjectives(e.target.value);
                setDirty(true);
              }}
              placeholder="By end of week, learners should be able to…"
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-400 resize-none placeholder-slate-300"
            />
          </div>

          {/* Activities */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
              Activities & Methods
            </p>
            <textarea
              value={activities}
              rows={2}
              onChange={(e) => {
                setActivities(e.target.value);
                setDirty(true);
              }}
              placeholder="Discussion, group work, practical, textbook exercise…"
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-400 resize-none placeholder-slate-300"
            />
          </div>

          {/* Resources */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
              Resources Needed
            </p>
            <input
              type="text"
              value={resources}
              onChange={(e) => {
                setResources(e.target.value);
                setDirty(true);
              }}
              placeholder="Textbook p.45, manila paper, rulers…"
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-400 placeholder-slate-300"
            />
          </div>

          {/* Post-lesson notes (shown after taught/skipped) */}
          {(status === "taught" || status === "skipped") && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                Reflection Notes
              </p>
              <textarea
                value={notes}
                rows={2}
                onChange={(e) => {
                  setNotes(e.target.value);
                  setDirty(true);
                }}
                placeholder="What worked well? What needs revisiting?"
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-400 resize-none placeholder-slate-300"
              />
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-2">
            {dirty && topic.trim() && (
              <button
                onClick={handleSave}
                disabled={isPending}
                className="flex-1 py-2 rounded-xl bg-emerald-600 text-white text-xs font-black hover:bg-emerald-700 disabled:opacity-50 transition-colors"
              >
                {isPending ? "Saving…" : "Save Plan"}
              </button>
            )}
            {!dirty && !plan && topic.trim() && (
              <button
                onClick={handleSave}
                disabled={isPending}
                className="flex-1 py-2 rounded-xl bg-emerald-600 text-white text-xs font-black hover:bg-emerald-700 disabled:opacity-50 transition-colors"
              >
                Create Plan
              </button>
            )}
            {!plan && !topic.trim() && (
              <button
                onClick={() => {
                  setTopic(`Week ${week} — `);
                  setDirty(true);
                }}
                className="flex-1 py-2 rounded-xl border border-dashed border-emerald-300 text-emerald-600 text-xs font-bold hover:bg-emerald-50 transition-colors flex items-center justify-center gap-1"
              >
                <Plus className="h-3.5 w-3.5" /> Add this week
              </button>
            )}
            {plan && (
              <button
                aria-label="Delete plan"
                onClick={() => onDelete(plan.id)}
                disabled={isPending}
                className="h-9 w-9 rounded-xl flex items-center justify-center border border-slate-200 text-slate-300 hover:text-rose-500 hover:border-rose-200 hover:bg-rose-50 transition-colors"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function PlannerClient({
  teacherName,
  allocations,
  initialPlans,
  selectedSubject,
  selectedGrade,
  term,
  academicYear,
  strandIds,
}: Props) {
  const router = useRouter();
  const [plans, setPlans] = useState<LessonPlan[]>(initialPlans);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [isPending, start] = useTransition();

  function flash(msg: string, ok: boolean) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  }

  const navTo = useCallback(
    (subject: string, grade: string) => {
      router.push(
        `/teacher/planner?subject=${encodeURIComponent(subject)}&grade=${encodeURIComponent(grade)}`,
      );
    },
    [router],
  );

  function handleSave(week: number, data: Partial<LessonPlan>) {
    const existing = plans.find((p) => p.week_number === week);
    start(async () => {
      const res = await upsertLessonPlanAction(
        {
          subject_name: selectedSubject,
          grade: selectedGrade,
          academic_year: academicYear,
          term,
          week_number: week,
          topic: data.topic ?? "",
          strand_id: data.strand_id,
          objectives: data.objectives,
          activities: data.activities,
          resources: data.resources,
          assessment_note: data.assessment_note,
          notes: data.notes,
          status: existing?.status ?? "planned",
        },
        existing?.id,
      );
      if (!res.success) {
        flash(res.message, false);
        return;
      }
      flash("Plan saved.", true);
      // Refresh plans
      if (res.id) {
        const merged: LessonPlan = {
          ...(existing ?? {
            id: res.id,
            teacher_id: "",
            subject_name: selectedSubject,
            grade: selectedGrade,
            academic_year: academicYear,
            term,
            week_number: week,
            strand_id: null,
            objectives: null,
            activities: null,
            resources: null,
            assessment_note: null,
            status: "planned",
            taught_at: null,
            notes: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }),
          ...data,
          id: res.id,
          updated_at: new Date().toISOString(),
        } as LessonPlan;
        setPlans((prev) =>
          existing
            ? prev.map((p) => (p.id === existing.id ? merged : p))
            : [...prev, merged].sort((a, b) => a.week_number - b.week_number),
        );
      }
    });
  }

  function handleStatus(id: string, status: PlanStatus) {
    setPlans((prev) => prev.map((p) => (p.id === id ? { ...p, status } : p)));
    start(async () => {
      const res = await updatePlanStatusAction(id, status);
      if (!res.success) {
        setPlans((prev) =>
          prev.map((p) => (p.id === id ? { ...p, status: p.status } : p)),
        );
        flash(res.message, false);
      }
    });
  }

  function handleDelete(id: string) {
    setPlans((prev) => prev.filter((p) => p.id !== id));
    start(async () => {
      const res = await deleteLessonPlanAction(id);
      if (!res.success) flash(res.message, false);
    });
  }

  const taughtCount = plans.filter((p) => p.status === "taught").length;
  const plannedCount = plans.filter((p) => p.status === "planned").length;
  const skippedCount = plans.filter((p) => p.status === "skipped").length;
  const coverageRate = Math.round((taughtCount / WEEKS.length) * 100);

  return (
    <div className="min-h-screen bg-[#f5f6fa]">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-14 flex items-center gap-3">
          <BookOpen className="h-5 w-5 text-emerald-600 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-black text-slate-800 leading-none">
              Lesson Planner
            </p>
            <p className="text-[10px] text-slate-400 mt-0.5">
              {selectedSubject} · {selectedGrade} · Term {term} {academicYear}
            </p>
          </div>
          <Link
            href="/teacher"
            className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-700 transition-colors"
          >
            <ChevronLeft className="h-3.5 w-3.5" /> Dashboard
          </Link>
        </div>

        {/* Subject / grade switcher */}
        {allocations.length > 1 && (
          <div className="max-w-4xl mx-auto px-4 sm:px-6 pb-2 flex items-center gap-2 flex-wrap">
            {allocations.map((a) => (
              <button
                key={a.id}
                onClick={() => navTo(a.subjectName, a.grade)}
                className={`text-xs font-bold px-2.5 py-1.5 rounded-xl border transition-all ${
                  a.subjectName === selectedSubject && a.grade === selectedGrade
                    ? "bg-emerald-600 text-white border-emerald-600"
                    : "bg-white text-slate-500 border-slate-200 hover:border-emerald-300"
                }`}
              >
                {a.subjectName} · {a.grade}
              </button>
            ))}
          </div>
        )}
      </header>

      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl text-sm font-bold shadow-xl ${toast.ok ? "bg-emerald-600 text-white" : "bg-rose-500 text-white"}`}
        >
          {toast.msg}
        </div>
      )}

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-5 space-y-5">
        {/* Progress stats */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-black uppercase tracking-wider text-slate-500">
              Syllabus Coverage — Term {term}
            </p>
            <p className="text-sm font-black text-emerald-600">
              {taughtCount}/{WEEKS.length} weeks
            </p>
          </div>
          <div className="h-3 bg-slate-100 rounded-full overflow-hidden flex">
            <div
              className="h-full bg-emerald-400 transition-all"
              style={{ width: `${(taughtCount / WEEKS.length) * 100}%` }}
            />
            <div
              className="h-full bg-amber-300 transition-all"
              style={{ width: `${(skippedCount / WEEKS.length) * 100}%` }}
            />
          </div>
          <div className="flex items-center gap-5 text-[10px] font-bold">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-emerald-400 shrink-0" />
              Taught ({taughtCount})
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-slate-200 shrink-0" />
              Planned ({plannedCount})
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-amber-300 shrink-0" />
              Skipped ({skippedCount})
            </span>
            <span className="ml-auto text-slate-500">
              {coverageRate}% complete
            </span>
          </div>
        </div>

        {/* No allocations */}
        {allocations.length === 0 && (
          <div className="bg-white rounded-2xl border border-slate-200 p-14 text-center shadow-sm">
            <BookOpen className="h-8 w-8 text-slate-200 mx-auto mb-3" />
            <p className="text-slate-400 text-sm">No subjects allocated.</p>
            <p className="text-slate-300 text-xs mt-1">
              Contact admin to assign you to a subject.
            </p>
          </div>
        )}

        {/* Week grid */}
        {allocations.length > 0 && (
          <div className="space-y-2">
            {WEEKS.map((w) => (
              <WeekCard
                key={w}
                week={w}
                plan={plans.find((p) => p.week_number === w)}
                strandIds={strandIds}
                onSave={handleSave}
                onStatus={handleStatus}
                onDelete={handleDelete}
                isPending={isPending}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
