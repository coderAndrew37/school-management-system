"use client";

/**
 * app/teacher/diary/_components/DiaryForm.tsx
 * Controlled form for creating and editing diary entries.
 * Uses useActionState for server action integration.
 */

import {
  createClassDiaryEntryAction,
  createObservationAction,
  updateDiaryEntryAction,
} from "@/lib/actions/teacher-diary";
import type { ClassStudent } from "@/lib/data/assessment";
import type { ClassOption } from "@/lib/data/diary";
import {
  DIARY_INITIAL_STATE,
  isHomework,
  type DiaryActionState,
  type TeacherDiaryEntry,
} from "@/lib/types/diary";
import { 
  Loader2, 
  BookOpen, 
  Megaphone, 
  UserRound, 
  X, 
  Calendar,
  CheckCircle2,
} from "lucide-react";
import { useActionState, useEffect } from "react";

// ── Mode config ───────────────────────────────────────────────────────────────

export type DiaryMode = "homework" | "notice" | "observation";

const MODE_CONFIG = {
  homework: {
    label: "Homework",
    description: "Assign work to the whole class",
    scope: "Whole class",
    activeClasses: "bg-amber-50 border-amber-400 text-amber-800",
    dotColor: "bg-amber-400",
    badge: "bg-amber-50 text-amber-700 border-amber-200",
    icon: BookOpen,
    scopeNote: "Parents receive this in the homework feed.",
  },
  notice: {
    label: "Class Notice",
    description: "Announcement for all parents",
    scope: "Whole class",
    activeClasses: "bg-sky-50 border-sky-400 text-sky-800",
    dotColor: "bg-sky-400",
    badge: "bg-sky-50 text-sky-700 border-sky-200",
    icon: Megaphone,
    scopeNote: "All parents in the class will see this announcement.",
  },
  observation: {
    label: "Observation",
    description: "CBC competency note for one student",
    scope: "Individual student",
    activeClasses: "bg-violet-50 border-violet-400 text-violet-800",
    dotColor: "bg-violet-500",
    badge: "bg-violet-50 text-violet-700 border-violet-200",
    icon: UserRound,
    scopeNote: "Only the selected student's parent will see this.",
  },
} as const;

const QUICK_TITLES: Record<DiaryMode, string[]> = {
  homework: [
    "Math: Complete exercises",
    "English: Summary writing",
    "Science: Revision questions",
    "Agriculture project",
    "Kiswahili: Insha",
  ],
  notice: [
    "No school tomorrow",
    "Swimming gala — bring kit",
    "Open Day reminder",
    "Art: Bring materials",
    "Exam Timetable",
  ],
  observation: [
    "Strong leadership skills",
    "Excellent critical thinking",
    "Needs support in reading",
    "Creative problem solver",
    "Great collaboration",
  ],
};

// ── Props ─────────────────────────────────────────────────────────────────────

export interface DiaryFormState {
  mode: DiaryMode;
  grade: string;
  studentId: string;
  title: string;
  content: string;
  dueDate: string;
  editEntry: TeacherDiaryEntry | null;
}

export interface DiaryFormProps {
  grades: string[];
  classOptions: ClassOption[];
  studentsByGrade: Record<string, ClassStudent[]>;
  formState: DiaryFormState;
  onFormChange: (patch: Partial<DiaryFormState>) => void;
  onSuccess: (state: DiaryActionState) => void;
  onCancel: () => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function DiaryForm({
  grades,
  classOptions,
  studentsByGrade,
  formState,
  onFormChange,
  onSuccess,
  onCancel,
}: DiaryFormProps) {
  const { mode, grade, studentId, title, content, dueDate, editEntry } = formState;
  const isEditing = !!editEntry;
  const cfg = MODE_CONFIG[mode];
  const students = studentsByGrade[grade] ?? [];
  const Icon = cfg.icon;

  const serverAction = isEditing
    ? updateDiaryEntryAction
    : mode === "observation"
    ? createObservationAction
    : createClassDiaryEntryAction;

  const [actionState, formAction, isPending] = useActionState(
    serverAction,
    DIARY_INITIAL_STATE
  );

  useEffect(() => {
    if (actionState.success) onSuccess(actionState);
  }, [actionState, onSuccess]);

  const inpBase = "w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-700 bg-white transition-all focus:outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 placeholder-slate-300";

  return (
    <div className="space-y-6">
      {/* Mode Selector */}
      <div className="bg-slate-100 p-1.5 rounded-2xl flex gap-1.5" role="tablist">
        {(["homework", "notice", "observation"] as DiaryMode[]).map((m) => {
          const MIcon = MODE_CONFIG[m].icon;
          const isActive = mode === m;
          return (
            <button
              key={m}
              type="button"
              role="tab"
              aria-label={`Switch to ${MODE_CONFIG[m].label} mode`}
              onClick={() => onFormChange({ mode: m, studentId: "" })}
              disabled={isEditing}
              className={`flex-1 py-3 rounded-xl flex flex-col items-center justify-center gap-1.5 transition-all ${
                isActive
                  ? "bg-white shadow-sm ring-1 ring-slate-200 text-slate-900"
                  : "text-slate-500 hover:bg-white/50"
              } ${isEditing ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              <MIcon className={`h-4 w-4 ${isActive ? MODE_CONFIG[m].dotColor.replace('bg-', 'text-') : ""}`} />
              <span className="text-[10px] font-black uppercase tracking-wider">{MODE_CONFIG[m].label}</span>
            </button>
          );
        })}
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 shadow-xl shadow-slate-200/50 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${cfg.dotColor}`} />
            <h2 className="text-xs font-black uppercase tracking-widest text-slate-700">
              {isEditing ? "Modify Entry" : `Post ${cfg.label}`}
            </h2>
          </div>
          {isEditing && (
            <button
              type="button"
              onClick={onCancel}
              aria-label="Cancel editing"
              className="p-2 hover:bg-slate-200 rounded-full transition-colors"
            >
              <X className="h-4 w-4 text-slate-400" />
            </button>
          )}
        </div>

        <form action={formAction} className="p-6 space-y-5">
          {isEditing && <input type="hidden" name="entry_id" value={editEntry.id} />}
          <input type="hidden" name="entry_type" value={mode} />

          {/* Grade Selector */}
          <div className="space-y-2">
            <label id="grade-label" className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Target Class</label>
            <div className="flex flex-wrap gap-2" role="group" aria-labelledby="grade-label">
              {grades.map((g) => {
                const label = classOptions.find((c) => c.grade === g)?.label ?? g;
                const isSelected = grade === g;
                return (
                  <button
                    key={g}
                    type="button"
                    aria-label={`Select class ${label}`}
                    onClick={() => onFormChange({ grade: g, studentId: "" })}
                    disabled={isEditing}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                      isSelected
                        ? "bg-slate-800 text-white shadow-lg shadow-slate-200"
                        : "bg-slate-50 text-slate-500 hover:bg-slate-100"
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
            <input type="hidden" name="grade" value={grade} />
          </div>

          {/* Student picker — observations only */}
          {mode === "observation" && (
            <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
              <label htmlFor="student-select" className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Student</label>
              <select
                id="student-select"
                name="student_id"
                aria-label="Select student for observation"
                value={studentId}
                onChange={(e) => onFormChange({ studentId: e.target.value })}
                className={inpBase}
              >
                <option value="">Select individual student...</option>
                {students.map((s) => (
                  <option key={s.id} value={s.id}>{s.full_name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Title with Quick Picks */}
          <div className="space-y-2">
            <label htmlFor="title-input" className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Title</label>
            <input
              id="title-input"
              type="text"
              name="title"
              value={title}
              autoComplete="off"
              aria-label="Entry title"
              onChange={(e) => onFormChange({ title: e.target.value })}
              placeholder="Give this entry a clear heading..."
              className={inpBase}
            />
            <div className="flex flex-wrap gap-1.5 mt-2" aria-label="Quick title suggestions">
              {QUICK_TITLES[mode].map((t) => (
                <button
                  key={t}
                  type="button"
                  aria-label={`Use title: ${t}`}
                  onClick={() => onFormChange({ title: t })}
                  className="px-3 py-1 text-[10px] font-bold rounded-lg bg-slate-50 text-slate-500 hover:bg-emerald-50 hover:text-emerald-600 transition-colors"
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Content */}
          <div className="space-y-2">
            <label htmlFor="content-textarea" className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
              {mode === "observation" ? "Notes & Context" : "Description"}
            </label>
            <textarea
              id="content-textarea"
              name="content"
              aria-label="Entry details"
              value={content}
              onChange={(e) => onFormChange({ content: e.target.value })}
              rows={4}
              placeholder="Write the details here..."
              className={`${inpBase} resize-none`}
            />
          </div>

          {/* Due date — homework only */}
          {mode === "homework" && (
            <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
              <label htmlFor="due-date-input" className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Due Date</label>
              <div className="relative">
                <Calendar className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" aria-hidden="true" />
                <input
                  id="due-date-input"
                  type="date"
                  name="due_date"
                  aria-label="Homework due date"
                  value={dueDate}
                  min={new Date().toISOString().split("T")[0]}
                  onChange={(e) => onFormChange({ dueDate: e.target.value })}
                  className={`${inpBase} pl-10`}
                />
              </div>
            </div>
          )}

          {/* Error Banner */}
          {!actionState.success && actionState.message && (
            <div 
              role="alert"
              className="p-3 rounded-xl bg-rose-50 border border-rose-100 flex items-center gap-2 text-rose-600 text-[11px] font-bold uppercase tracking-tight"
            >
              <X className="h-3 w-3" aria-hidden="true" />
              {actionState.message}
            </div>
          )}

          {/* Submit Button */}
          <button
          aria-label="submit diary"
            type="submit"
            disabled={isPending}
            className="w-full py-4 rounded-2xl bg-emerald-600 text-white text-xs font-black uppercase tracking-[0.2em] shadow-lg shadow-emerald-200 hover:bg-emerald-700 hover:shadow-emerald-300 disabled:opacity-50 transition-all active:scale-[0.98] flex items-center justify-center gap-3"
          >
            {isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
            )}
            {isPending ? "Syncing..." : isEditing ? "Update Diary" : "Post to Portal"}
          </button>
        </form>
      </div>

     {/* Help Footer */}
      <div className={`p-4 rounded-2xl border text-[11px] font-medium leading-relaxed flex gap-3 ${cfg.badge}`}>
        <div className="mt-0.5">
          <Icon className="h-4 w-4 opacity-50" aria-hidden="true" />
        </div>
        <div>
          <span className="font-black uppercase tracking-widest mr-1 underline">Note:</span>
          {cfg.scopeNote} 
          {(isHomework(editEntry) || mode === "homework") && 
            " Homework status updates help parents track student progress."}
        </div>
      </div>
    </div>
  );
}