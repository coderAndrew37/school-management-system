"use client";
// app/teacher/diary/DiaryClient.tsx
// Thin orchestrator — owns shared state, wires form ↔ feed.
// All heavy lifting delegated to focused sub-components.

import {
  deleteDiaryEntryAction,
  toggleHomeworkCompleteAction,
} from "@/lib/actions/teacher-diary";
import type { ClassStudent } from "@/lib/data/assessment";
import type { ClassOption } from "@/lib/data/diary";
import {
  DIARY_INITIAL_STATE,
  isClassWide,
  isObservation,
  type ClassDiaryEntry,
  type DiaryActionState,
  type DiaryEntryType,
  type ObservationEntry,
  type TeacherDiaryEntry,
} from "@/lib/types/diary";
import { useActionState, useCallback, useRef, useState } from "react";
import { DiaryFeed } from "./_components/DiaryFeed";
import {
  DiaryForm,
  type DiaryFormState,
  type DiaryMode,
} from "./_components/DiaryForm";

// ── Props ─────────────────────────────────────────────────────────────────────

interface DiaryClientProps {
  teacherName: string;
  classOptions: ClassOption[]; // Contains both ID (UUID) and Label
  studentsByClass: Record<string, ClassStudent[]>; // Key is classId (UUID)
  initialEntries: TeacherDiaryEntry[];
}

// ── Helper: build optimistic entry ────────────────────────────────────────────

function buildOptimisticEntry(
  formState: DiaryFormState,
  students: ClassStudent[],
): TeacherDiaryEntry {
  const now = new Date().toISOString();
  const base = {
    id: `temp-${Date.now()}`,
    title: formState.title.trim(),
    content: formState.content || null,
    diary_date: now.slice(0, 10),
    created_at: now,
    updated_at: now,
    subject_name: null,
  };

  if (formState.mode === "observation") {
    return {
      ...base,
      entry_type: "observation",
      class_id: null,
      student_id: formState.studentId,
      due_date: null,
      is_completed: false,
      students: {
        full_name: students.find((s) => s.id === formState.studentId)?.full_name ?? "Unknown Student",
        readable_id: null
      }
    } satisfies ObservationEntry;
  }

  return {
    ...base,
    entry_type: formState.mode as "homework" | "notice",
    class_id: formState.classId, // Now correctly using UUID
    student_id: null,
    due_date: formState.mode === "homework" ? formState.dueDate || null : null,
    is_completed: false,
  } satisfies ClassDiaryEntry;
}

// ── Default form state ────────────────────────────────────────────────────────

function defaultFormState(firstClassId: string): DiaryFormState {
  return {
    mode: "homework",
    classId: firstClassId,
    studentId: "",
    title: "",
    content: "",
    dueDate: "",
    editEntry: null,
  };
}

// ── Main component ────────────────────────────────────────────────────────────

export default function DiaryClient({
  teacherName,
  classOptions,
  studentsByClass,
  initialEntries,
}: DiaryClientProps) {
  const firstClassId = classOptions[0]?.id ?? "";

  // ── Shared state ──────────────────────────────────────────────────────────
  const [entries, setEntries] = useState<TeacherDiaryEntry[]>(initialEntries);
  const [formState, setFormState] = useState<DiaryFormState>(
    defaultFormState(firstClassId),
  );
  const [filterClass, setFilterClass] = useState("all");
  const [filterType, setFilterType] = useState<"all" | DiaryEntryType>("all");
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const formRef = useRef<HTMLDivElement>(null);

  // Delete + toggle use useActionState for consistency
  const [, deleteAction, isDeletePending] = useActionState(
    deleteDiaryEntryAction,
    DIARY_INITIAL_STATE,
  );
  const [, toggleAction, isTogglePending] = useActionState(
    toggleHomeworkCompleteAction,
    DIARY_INITIAL_STATE,
  );
  const isPending = isDeletePending || isTogglePending;

  // ── Toast helper ──────────────────────────────────────────────────────────
  const flash = useCallback((msg: string, ok: boolean) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  }, []);

  // ── Form patch ────────────────────────────────────────────────────────────
  function patchForm(patch: Partial<DiaryFormState>) {
    setFormState((prev: DiaryFormState) => ({ ...prev, ...patch }));
  }

  // ── Form success: optimistic insert or update in place ────────────────────
  function handleFormSuccess(state: DiaryActionState) {
    flash(state.message, true);

    if (formState.editEntry) {
      const id = formState.editEntry.id;

      setEntries((prev) =>
        prev.map((e) => {
          if (e.id !== id) return e;

          const updatedBase = {
            ...e,
            title: formState.title.trim(),
            content: formState.content || null,
            updated_at: new Date().toISOString(),
          };

          if (isObservation(e)) {
            return {
              ...updatedBase,
              entry_type: "observation",
              class_id: null,
              due_date: null,
            } as ObservationEntry;
          }

          return {
            ...updatedBase,
            entry_type: e.entry_type,
            student_id: null,
            due_date: e.entry_type === "homework" ? formState.dueDate || null : null,
          } as ClassDiaryEntry;
        }),
      );
    } else {
      const students = studentsByClass[formState.classId] ?? [];
      const newEntry = buildOptimisticEntry(formState, students);
      setEntries((prev) => [newEntry, ...prev]);
    }

    setFormState(defaultFormState(firstClassId));
  }

  // ── Start editing an entry ────────────────────────────────────────────────
  function handleEdit(entry: TeacherDiaryEntry) {
    const cls = isClassWide(entry) ? entry : null;
    const obs = isObservation(entry) ? entry : null;
    
    setFormState({
      mode: entry.entry_type as DiaryMode,
      classId: cls?.class_id ?? firstClassId,
      studentId: obs?.student_id ?? "",
      title: entry.title,
      content: entry.content ?? "",
      dueDate: cls?.due_date ?? "",
      editEntry: entry,
    });
    
    setTimeout(
      () =>
        formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
      50,
    );
  }

  // ── Toggle homework completion ───────────────────
  function handleToggleComplete(id: string, completed: boolean) {
    setEntries((prev) =>
      prev.map((e) =>
        e.id === id && isClassWide(e) ? { ...e, is_completed: completed } : e,
      ),
    );
    const fd = new FormData();
    fd.set("entry_id", id);
    fd.set("completed", String(completed));
    toggleAction(fd);
    flash(completed ? "Marked as submitted." : "Marked as pending.", true);
  }

  // ── Delete (double-click confirm) ─────────────────────────────────────────
  function handleDelete(id: string) {
    if (deleteConfirmId !== id) {
      setDeleteConfirmId(id);
      setTimeout(() => setDeleteConfirmId(null), 3000);
      return;
    }
    setDeleteConfirmId(null);
    setEntries((prev) => prev.filter((e) => e.id !== id));
    const fd = new FormData();
    fd.set("entry_id", id);
    deleteAction(fd);
    flash("Entry deleted.", true);
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-6 py-3.5 flex items-center justify-between">
          <div>
            <h1 className="text-base font-semibold text-slate-800 tracking-tight">
              Class Diary
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              {teacherName} · Digital correspondence book
            </p>
          </div>
          <a
            href="/teacher"
            className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1.5 transition-colors"
          >
            <svg
              className="w-3.5 h-3.5"
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

      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl text-sm font-medium shadow-lg animate-in slide-in-from-right-5 ${
            toast.ok ? "bg-emerald-600 text-white" : "bg-red-500 text-white"
          }`}
        >
          {toast.msg}
        </div>
      )}

      <div className="max-w-6xl mx-auto px-6 py-6 grid grid-cols-1 lg:grid-cols-[420px_1fr] gap-6 items-start">
        {/* Left: form */}
        <div ref={formRef} className="lg:sticky lg:top-[61px]">
          <DiaryForm
            classOptions={classOptions}
            studentsByClass={studentsByClass}
            formState={formState}
            onFormChange={patchForm}
            onSuccess={handleFormSuccess}
            onCancel={() => setFormState(defaultFormState(firstClassId))}
          />
        </div>

        {/* Right: feed */}
        <div className="space-y-6">
          <DiaryFeed
            entries={entries}
            classOptions={classOptions}
            filterClass={filterClass}
            filterType={filterType}
            deleteConfirmId={deleteConfirmId}
            isPending={isPending}
            onFilterClass={setFilterClass}
            onFilterType={setFilterType}
            onEdit={handleEdit}
            onToggleComplete={handleToggleComplete}
            onDelete={handleDelete}
            onCancelDelete={() => setDeleteConfirmId(null)}
          />
        </div>
      </div>
    </div>
  );
}