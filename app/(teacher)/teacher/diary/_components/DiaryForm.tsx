"use client";
// app/teacher/diary/_components/DiaryForm.tsx
// Controlled form for creating and editing diary entries.
// Uses useActionState for server action integration.

import {
  createClassDiaryEntryAction,
  createObservationAction,
  updateDiaryEntryAction,
} from "@/lib/actions/teacher-diary";
import type { ClassStudent } from "@/lib/data/assessment";
import type { ClassOption } from "@/lib/data/diary";
import {
  DIARY_INITIAL_STATE,
  isClassWide,
  isObservation,
  type ClassDiaryEntry,
  type DiaryActionState,
  type ObservationEntry,
  type TeacherDiaryEntry,
} from "@/lib/types/diary";
import { Loader2 } from "lucide-react";
import { useActionState, useEffect, useRef } from "react";

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
    ring: "ring-emerald-400",
    scopeNote: "Parents receive this in the homework feed.",
  },
  notice: {
    label: "Class Notice",
    description: "Announcement for all parents",
    scope: "Whole class",
    activeClasses: "bg-sky-50 border-sky-400 text-sky-800",
    dotColor: "bg-sky-400",
    badge: "bg-sky-50 text-sky-700 border-sky-200",
    ring: "ring-emerald-400",
    scopeNote: "All parents in the class will see this announcement.",
  },
  observation: {
    label: "Observation",
    description: "CBC competency note for one student",
    scope: "Individual student",
    activeClasses: "bg-violet-50 border-violet-400 text-violet-800",
    dotColor: "bg-violet-500",
    badge: "bg-violet-50 text-violet-700 border-violet-200",
    ring: "ring-violet-400",
    scopeNote:
      "Only the selected student's parent will see this — it feeds their child's learning portrait.",
  },
} as const;

const QUICK_TITLES: Record<DiaryMode, string[]> = {
  homework: [
    "Mathematics: complete exercise",
    "English: read and summarise",
    "Science: revision questions",
    "Agriculture project work",
    "Kiswahili: faharasa mpya",
  ],
  notice: [
    "No school tomorrow",
    "Swimming gala — bring kit",
    "Open Day this Friday",
    "Bring: scissors and glue",
    "Term examination timetable",
  ],
  observation: [
    "Demonstrated strong leadership",
    "Excellent critical thinking today",
    "Needs extra support — reading",
    "Outstanding collaboration in group work",
    "Showed great creativity",
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
  grades: string[]; // from teacher allocations
  classOptions: ClassOption[]; // from classes table
  studentsByGrade: Record<string, ClassStudent[]>;
  formState: DiaryFormState;
  onFormChange: (patch: Partial<DiaryFormState>) => void;
  onSuccess: (
    state: DiaryActionState,
    newEntry?: Partial<TeacherDiaryEntry>,
  ) => void;
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
  const { mode, grade, studentId, title, content, dueDate, editEntry } =
    formState;
  const isEditing = editEntry !== null;
  const cfg = MODE_CONFIG[mode];
  const students = studentsByGrade[grade] ?? [];

  // Pick the right action based on mode and edit state
  const serverAction = isEditing
    ? updateDiaryEntryAction
    : mode === "observation"
      ? createObservationAction
      : createClassDiaryEntryAction;

  const [actionState, formAction, isPending] = useActionState(
    serverAction,
    DIARY_INITIAL_STATE,
  );

  // Notify parent on success
  useEffect(() => {
    if (actionState.success) onSuccess(actionState);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actionState]);

  const inp =
    "w-full px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-400 placeholder-slate-300";

  return (
    <div className="space-y-4">
      {/* Mode tabs */}
      <div className="bg-white rounded-xl border border-slate-200 p-1 flex gap-1">
        {(["homework", "notice", "observation"] as DiaryMode[]).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => onFormChange({ mode: m, studentId: "" })}
            disabled={isEditing}
            className={`flex-1 py-2 px-2 rounded-lg text-xs font-medium border transition-all ${
              mode === m
                ? MODE_CONFIG[m].activeClasses + " border"
                : "text-slate-500 border-transparent hover:bg-slate-50"
            }`}
          >
            <div
              className={`w-1.5 h-1.5 rounded-full mx-auto mb-1 ${MODE_CONFIG[m].dotColor}`}
            />
            {MODE_CONFIG[m].label}
          </button>
        ))}
      </div>

      {/* Scope explainer */}
      <div className={`rounded-lg px-4 py-2.5 text-xs border ${cfg.badge}`}>
        <span className="font-medium">{cfg.scope}: </span>
        {cfg.description}. {cfg.scopeNote}
      </div>

      {/* Form */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-700">
            {isEditing ? `Edit ${cfg.label}` : `New ${cfg.label}`}
          </h2>
          {isEditing && (
            <button
              type="button"
              onClick={onCancel}
              className="text-xs text-slate-400 hover:text-slate-600"
            >
              Cancel
            </button>
          )}
        </div>

        <form action={formAction} className="px-5 py-4 space-y-4">
          {/* Hidden fields for edit mode */}
          {isEditing && (
            <input type="hidden" name="entry_id" value={editEntry.id} />
          )}
          <input type="hidden" name="entry_type" value={mode} />

          {/* Grade selector */}
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1.5 uppercase tracking-wide">
              Class
            </label>
            <div className="flex flex-wrap gap-2">
              {grades.map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => onFormChange({ grade: g, studentId: "" })}
                  disabled={isEditing}
                  className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                    grade === g
                      ? "bg-emerald-600 text-white border-emerald-600"
                      : "bg-white text-slate-600 border-slate-200 hover:border-emerald-300"
                  }`}
                >
                  {/* Show stream label if available */}
                  {classOptions.find((c) => c.grade === g)?.label ?? g}
                </button>
              ))}
            </div>
            <input type="hidden" name="grade" value={grade} />
            {actionState.errors?.grade && (
              <p className="text-xs text-rose-500 mt-1">
                {actionState.errors.grade}
              </p>
            )}
          </div>

          {/* Student picker — observations only */}
          {mode === "observation" && (
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1.5 uppercase tracking-wide">
                Student
              </label>
              <select
                name="student_id"
                value={studentId}
                onChange={(e) => onFormChange({ studentId: e.target.value })}
                aria-label="select student for observation"
                className={inp}
              >
                <option value="">— Select student —</option>
                {students.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.full_name}
                  </option>
                ))}
              </select>
              {actionState.errors?.student_id && (
                <p className="text-xs text-rose-500 mt-1">
                  {actionState.errors.student_id}
                </p>
              )}
            </div>
          )}

          {/* Title */}
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1.5 uppercase tracking-wide">
              Title
            </label>
            <input
              type="text"
              name="title"
              value={title}
              onChange={(e) => onFormChange({ title: e.target.value })}
              placeholder={
                mode === "homework"
                  ? "e.g. Mathematics: page 45 exercise"
                  : mode === "notice"
                    ? "e.g. Swimming gala — bring kit"
                    : "e.g. Showed great leadership today"
              }
              className={inp}
            />
            <div className="flex flex-wrap gap-1 mt-2">
              {QUICK_TITLES[mode].map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => onFormChange({ title: t })}
                  className="px-2 py-1 text-xs rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors"
                >
                  {t}
                </button>
              ))}
            </div>
            {actionState.errors?.title && (
              <p className="text-xs text-rose-500 mt-1">
                {actionState.errors.title}
              </p>
            )}
          </div>

          {/* Content */}
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1.5 uppercase tracking-wide">
              {mode === "observation" ? "Observation notes" : "Details"}
            </label>
            <textarea
              name="content"
              value={content}
              onChange={(e) => onFormChange({ content: e.target.value })}
              rows={mode === "observation" ? 5 : 3}
              placeholder={
                mode === "homework"
                  ? "Specific instructions, pages, materials needed…"
                  : mode === "notice"
                    ? "More details for parents…"
                    : "Describe the competency or behaviour observed in detail…"
              }
              className={`${inp} resize-none`}
            />
          </div>

          {/* Due date — homework only */}
          {mode === "homework" && (
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1.5 uppercase tracking-wide">
                Due date
              </label>
              <input
                type="date"
                name="due_date"
                value={dueDate}
                min={new Date().toISOString().split("T")[0]}
                onChange={(e) => onFormChange({ dueDate: e.target.value })}
                aria-label="homework due date"
                className="px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-400"
              />
            </div>
          )}

          {/* Server error */}
          {!actionState.success && actionState.message && (
            <p className="text-xs text-rose-500 bg-rose-50 border border-rose-100 px-3 py-2 rounded-lg">
              {actionState.message}
            </p>
          )}

          {/* Submit */}
          <div className="pt-1">
            <button
              type="submit"
              disabled={isPending}
              className="w-full py-2.5 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
            >
              {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {isPending
                ? "Saving…"
                : isEditing
                  ? "Update entry"
                  : mode === "homework"
                    ? `Post homework to ${grade || "class"}`
                    : mode === "notice"
                      ? `Post notice to ${grade || "class"}`
                      : "Save observation"}
            </button>
          </div>
        </form>
      </div>

      {/* Contextual help */}
      <div
        className={`rounded-xl px-4 py-3 border text-xs leading-relaxed ${cfg.badge}`}
      >
        {mode === "homework" && (
          <>
            <strong>Homework entries</strong> are broadcast to all parents in{" "}
            {grade || "the class"}. Mark as submitted once the class hands in
            their work — parents will see the confirmation.
          </>
        )}
        {mode === "notice" && (
          <>
            <strong>Class notices</strong> appear in the announcements section
            of every parent's portal for {grade || "the class"}. Use these for
            events, reminders, and school-wide updates.
          </>
        )}
        {mode === "observation" && (
          <>
            <strong>Observations</strong> are private to the individual
            student's parent. They build the CBC "learning portrait" — a
            narrative record of competencies and character growth across the
            term.
          </>
        )}
      </div>
    </div>
  );
}
