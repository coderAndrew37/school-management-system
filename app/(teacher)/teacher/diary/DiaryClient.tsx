"use client";

// app/teacher/diary/DiaryClient.tsx

import { useState, useTransition, useRef, useCallback } from "react";
import {
  createClassDiaryEntryAction,
  createObservationAction,
  updateDiaryEntryAction,
  toggleHomeworkCompleteAction,
  deleteDiaryEntryAction,
} from "@/lib/actions/teacher-diary";
import type { ClassStudent } from "@/lib/data/assessment";
import {
  DiaryEntryType,
  isObservation,
  isClassWide,
  ClassDiaryEntry,
  ObservationEntry,
  TeacherDiaryEntry,
} from "@/lib/types/diary";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Props {
  teacherName: string;
  grades: string[];
  studentsByGrade: Record<string, ClassStudent[]>;
  initialEntries: TeacherDiaryEntry[];
}

type Mode = "homework" | "notice" | "observation";

interface FormState {
  mode: Mode;
  grade: string;
  studentId: string;
  title: string;
  content: string;
  dueDate: string;
}

// ── Config ────────────────────────────────────────────────────────────────────

const MODE_CONFIG: Record<
  Mode,
  {
    label: string;
    description: string;
    scope: string;
    color: string;
    activeClasses: string;
    dotColor: string;
    badge: string;
  }
> = {
  homework: {
    label: "Homework",
    description: "Assign work to the whole class",
    scope: "Whole class",
    color: "amber",
    activeClasses: "bg-amber-50 border-amber-400 text-amber-800",
    dotColor: "bg-amber-400",
    badge: "bg-amber-50 text-amber-700 border-amber-200",
  },
  notice: {
    label: "Class Notice",
    description: "Announcement for all parents",
    scope: "Whole class",
    color: "sky",
    activeClasses: "bg-sky-50 border-sky-400 text-sky-800",
    dotColor: "bg-sky-400",
    badge: "bg-sky-50 text-sky-700 border-sky-200",
  },
  observation: {
    label: "Observation",
    description: "CBC competency note for one student",
    scope: "Individual student",
    color: "violet",
    activeClasses: "bg-violet-50 border-violet-400 text-violet-800",
    dotColor: "bg-violet-500",
    badge: "bg-violet-50 text-violet-700 border-violet-200",
  },
};

const QUICK_TITLES: Record<Mode, string[]> = {
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

// ── Helpers ───────────────────────────────────────────────────────────────────

function today() {
  return new Date().toISOString().split("T")[0];
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-KE", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const h = diff / 3_600_000;
  if (h < 1) return "Just now";
  if (h < 24) return `${Math.floor(h)}h ago`;
  if (h < 48) return "Yesterday";
  return formatDate(iso);
}

function entryTypeOf(e: TeacherDiaryEntry): DiaryEntryType {
  return e.entry_type;
}

// ── Subcomponents ─────────────────────────────────────────────────────────────

function EntryCard({
  entry,
  onEdit,
  onToggleComplete,
  onDelete,
  isPending,
}: {
  entry: TeacherDiaryEntry;
  onEdit: (e: TeacherDiaryEntry) => void;
  onToggleComplete: (id: string, completed: boolean) => void;
  onDelete: (id: string) => void;
  isPending: boolean;
}) {
  const cfg = MODE_CONFIG[entry.entry_type as Mode];
  const obs = isObservation(entry);
  const cls = isClassWide(entry) ? (entry as ClassDiaryEntry) : null;

  return (
    <div
      className={`bg-white rounded-xl border transition-all hover:border-slate-300 ${
        cls?.is_completed ? "border-slate-100 opacity-70" : "border-slate-200"
      }`}
    >
      <div className="px-4 py-3.5 flex items-start gap-3">
        {/* Type dot */}
        <div
          className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${cfg.dotColor}`}
        />

        <div className="flex-1 min-w-0">
          {/* Header row */}
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p
                className={`text-sm font-medium leading-snug ${
                  cls?.is_completed
                    ? "line-through text-slate-400"
                    : "text-slate-800"
                }`}
              >
                {entry.title}
              </p>
              <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                {/* Scope badge */}
                <span
                  className={`inline-flex items-center text-xs px-1.5 py-0.5 rounded border font-medium ${cfg.badge}`}
                >
                  {cfg.label}
                </span>
                {/* Student name (observations only) */}
                {obs && (
                  <span className="text-xs text-slate-400">
                    {(entry as ObservationEntry).student_name}
                  </span>
                )}
                {/* Grade */}
                <span className="text-xs text-slate-400">· {entry.grade}</span>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-1 shrink-0">
              {/* Completion toggle — only for homework */}
              {entry.entry_type === "homework" && (
                <button
                  onClick={() =>
                    onToggleComplete(
                      entry.id,
                      !(entry as ClassDiaryEntry).is_completed,
                    )
                  }
                  disabled={isPending}
                  title={
                    (entry as ClassDiaryEntry).is_completed
                      ? "Mark as pending"
                      : "Mark homework submitted"
                  }
                  className={`p-1.5 rounded-lg transition-colors ${
                    (entry as ClassDiaryEntry).is_completed
                      ? "text-emerald-500 bg-emerald-50 hover:bg-emerald-100"
                      : "text-slate-300 hover:text-emerald-500 hover:bg-emerald-50"
                  }`}
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
                      strokeWidth={2}
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </button>
              )}

              {/* Edit */}
              <button
                onClick={() => onEdit(entry)}
                className="p-1.5 rounded-lg text-slate-300 hover:text-slate-600 hover:bg-slate-50 transition-colors"
                title="Edit"
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
                    d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z"
                  />
                </svg>
              </button>

              {/* Delete */}
              <button
                onClick={() => onDelete(entry.id)}
                className="p-1.5 rounded-lg text-slate-300 hover:text-red-400 hover:bg-red-50 transition-colors"
                title="Delete"
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
                    d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"
                  />
                </svg>
              </button>
            </div>
          </div>

          {/* Content preview */}
          {entry.content && (
            <p className="text-sm text-slate-500 mt-1.5 leading-relaxed line-clamp-2">
              {entry.content}
            </p>
          )}

          {/* Footer row */}
          <div className="flex items-center gap-3 mt-2">
            <span className="text-xs text-slate-300">
              {timeAgo(entry.created_at)}
            </span>
            {cls?.due_date && !cls.is_completed && (
              <span className="text-xs bg-amber-50 text-amber-600 border border-amber-100 px-2 py-0.5 rounded-full">
                Due {formatDate(cls.due_date)}
              </span>
            )}
            {cls?.is_completed && (
              <span className="text-xs bg-emerald-50 text-emerald-600 border border-emerald-100 px-2 py-0.5 rounded-full flex items-center gap-1">
                <svg
                  className="w-3 h-3"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
                Submitted
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function DiaryClient({
  teacherName,
  grades,
  studentsByGrade,
  initialEntries,
}: Props) {
  const firstGrade = grades[0] ?? "";

  const [form, setForm] = useState<FormState>({
    mode: "homework",
    grade: firstGrade,
    studentId: "",
    title: "",
    content: "",
    dueDate: "",
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [entries, setEntries] = useState<TeacherDiaryEntry[]>(initialEntries);
  const [filterGrade, setFilterGrade] = useState("all");
  const [filterType, setFilterType] = useState<"all" | DiaryEntryType>("all");
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [isPending, startTransition] = useTransition();
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const formRef = useRef<HTMLDivElement>(null);

  const students = studentsByGrade[form.grade] ?? [];
  const isEditing = editingId !== null;

  // ── Toast ──────────────────────────────────────────────────────────────────

  const showToast = useCallback((msg: string, ok: boolean) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  }, []);

  // ── Form helpers ───────────────────────────────────────────────────────────

  function setMode(mode: Mode) {
    setForm((f) => ({
      ...f,
      mode,
      studentId: "",
      // Clear due date when switching away from homework
      dueDate: mode === "homework" ? f.dueDate : "",
    }));
    setEditingId(null);
  }

  function resetForm() {
    setForm({
      mode: "homework",
      grade: firstGrade,
      studentId: "",
      title: "",
      content: "",
      dueDate: "",
    });
    setEditingId(null);
  }

  function startEdit(entry: TeacherDiaryEntry) {
    const mode = entry.entry_type as Mode;
    const obs = isObservation(entry) ? (entry as ObservationEntry) : null;
    const cls = isClassWide(entry) ? (entry as ClassDiaryEntry) : null;

    setForm({
      mode,
      grade: entry.grade,
      studentId: obs?.student_id ?? "",
      title: entry.title,
      content: entry.content ?? "",
      dueDate: cls?.due_date ?? "",
    });
    setEditingId(entry.id);
    setTimeout(
      () =>
        formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
      50,
    );
  }

  // ── Submit ─────────────────────────────────────────────────────────────────

  function handleSubmit() {
    if (!form.grade) {
      showToast("Select a class first.", false);
      return;
    }
    if (!form.title.trim()) {
      showToast("Enter a title.", false);
      return;
    }
    if (form.mode === "observation" && !form.studentId) {
      showToast("Select a student for the observation.", false);
      return;
    }

    startTransition(async () => {
      const fd = new FormData();
      fd.set("grade", form.grade);
      fd.set("entry_type", form.mode);
      fd.set("title", form.title.trim());
      fd.set("content", form.content);
      fd.set("due_date", form.dueDate);
      if (form.mode === "observation") fd.set("student_id", form.studentId);

      let result;
      if (isEditing) {
        result = await updateDiaryEntryAction(editingId!, fd);
      } else if (form.mode === "observation") {
        result = await createObservationAction(fd);
      } else {
        result = await createClassDiaryEntryAction(fd);
      }

      if (result.success) {
        showToast(result.message, true);

        if (isEditing) {
          // Update in place
          setEntries((prev) =>
            prev.map((e) =>
              e.id === editingId
                ? {
                    ...e,
                    title: form.title.trim(),
                    content: form.content || null,
                    ...(e.entry_type === "homework"
                      ? { due_date: form.dueDate || null }
                      : {}),
                  }
                : e,
            ),
          );
        } else {
          // Optimistic insert at top
          const base = {
            id: `temp-${Date.now()}`,
            grade: form.grade,
            title: form.title.trim(),
            content: form.content || null,
            is_completed: false,
            created_at: new Date().toISOString(),
          };

          const newEntry: TeacherDiaryEntry =
            form.mode === "observation"
              ? {
                  ...base,
                  entry_type: "observation",
                  student_id: form.studentId,
                  student_name:
                    students.find((s) => s.id === form.studentId)?.full_name ??
                    "Unknown",
                }
              : {
                  ...base,
                  entry_type: form.mode,
                  due_date:
                    form.mode === "homework" ? form.dueDate || null : null,
                };

          setEntries((prev) => [newEntry, ...prev]);
        }

        resetForm();
      } else {
        showToast(result.message, false);
      }
    });
  }

  // ── Complete toggle ────────────────────────────────────────────────────────

  function handleToggleComplete(id: string, completed: boolean) {
    startTransition(async () => {
      const result = await toggleHomeworkCompleteAction(id, completed);
      if (result.success) {
        setEntries((prev) =>
          prev.map((e) =>
            e.id === id && isClassWide(e)
              ? { ...e, is_completed: completed }
              : e,
          ),
        );
        showToast(result.message, true);
      } else {
        showToast(result.message, false);
      }
    });
  }

  // ── Delete ─────────────────────────────────────────────────────────────────

  function handleDelete(id: string) {
    if (deleteConfirm !== id) {
      setDeleteConfirm(id);
      setTimeout(() => setDeleteConfirm(null), 3000);
      return;
    }
    setDeleteConfirm(null);
    startTransition(async () => {
      const result = await deleteDiaryEntryAction(id);
      if (result.success) {
        setEntries((prev) => prev.filter((e) => e.id !== id));
        showToast("Entry deleted.", true);
      } else {
        showToast(result.message, false);
      }
    });
  }

  // ── Filtered entries ───────────────────────────────────────────────────────

  const filtered = entries.filter((e) => {
    if (filterGrade !== "all" && e.grade !== filterGrade) return false;
    if (filterType !== "all" && e.entry_type !== filterType) return false;
    return true;
  });

  const counts = {
    homework: entries.filter((e) => e.entry_type === "homework").length,
    notice: entries.filter((e) => e.entry_type === "notice").length,
    observation: entries.filter((e) => e.entry_type === "observation").length,
    pending: entries.filter(
      (e) =>
        e.entry_type === "homework" && !(e as ClassDiaryEntry).is_completed,
    ).length,
  };

  // ── Render ─────────────────────────────────────────────────────────────────

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
          className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl text-sm font-medium shadow-lg ${
            toast.ok ? "bg-emerald-600 text-white" : "bg-red-500 text-white"
          }`}
        >
          {toast.msg}
        </div>
      )}

      <div className="max-w-6xl mx-auto px-6 py-6 grid grid-cols-1 lg:grid-cols-[420px_1fr] gap-6 items-start">
        {/* ── LEFT: Form ── */}
        <div ref={formRef} className="space-y-4 lg:sticky lg:top-[61px]">
          {/* Mode selector — the three entry types */}
          <div className="bg-white rounded-xl border border-slate-200 p-1 flex gap-1">
            {(["homework", "notice", "observation"] as Mode[]).map((m) => {
              const cfg = MODE_CONFIG[m];
              const active =
                (form.mode === m && !isEditing) ||
                (isEditing && /* keep current */ false);
              return (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  disabled={isEditing}
                  className={`flex-1 py-2 px-2 rounded-lg text-xs font-medium border transition-all ${
                    form.mode === m
                      ? cfg.activeClasses + " border"
                      : "text-slate-500 border-transparent hover:bg-slate-50"
                  }`}
                >
                  <div
                    className={`w-1.5 h-1.5 rounded-full mx-auto mb-1 ${cfg.dotColor}`}
                  />
                  {cfg.label}
                </button>
              );
            })}
          </div>

          {/* Scope explainer */}
          <div
            className={`rounded-lg px-4 py-2.5 text-xs border ${MODE_CONFIG[form.mode].badge}`}
          >
            <span className="font-medium">
              {MODE_CONFIG[form.mode].scope}:{" "}
            </span>
            {MODE_CONFIG[form.mode].description}.{" "}
            {form.mode === "homework" &&
              "Parents receive this in the homework feed."}
            {form.mode === "notice" &&
              "All parents in the class will see this announcement."}
            {form.mode === "observation" &&
              "Only the selected student's parent will see this — it feeds their child's learning portrait."}
          </div>

          {/* Form card */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-700">
                {isEditing
                  ? `Edit ${MODE_CONFIG[form.mode].label}`
                  : `New ${MODE_CONFIG[form.mode].label}`}
              </h2>
              {isEditing && (
                <button
                  onClick={resetForm}
                  className="text-xs text-slate-400 hover:text-slate-600"
                >
                  Cancel
                </button>
              )}
            </div>

            <div className="px-5 py-4 space-y-4">
              {/* Grade selector */}
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1.5 uppercase tracking-wide">
                  Class
                </label>
                <div className="flex flex-wrap gap-2">
                  {grades.map((g) => (
                    <button
                      key={g}
                      onClick={() =>
                        setForm((f) => ({ ...f, grade: g, studentId: "" }))
                      }
                      disabled={isEditing}
                      className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                        form.grade === g
                          ? "bg-emerald-600 text-white border-emerald-600"
                          : "bg-white text-slate-600 border-slate-200 hover:border-emerald-300"
                      }`}
                    >
                      {g}
                    </button>
                  ))}
                </div>
              </div>

              {/* Student picker — observations only */}
              {form.mode === "observation" && (
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1.5 uppercase tracking-wide">
                    Student
                  </label>
                  <select
                    value={form.studentId}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, studentId: e.target.value }))
                    }
                    aria-label="select student for observation"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-violet-400"
                  >
                    <option value="">— Select student —</option>
                    {students.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.full_name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Title */}
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1.5 uppercase tracking-wide">
                  Title
                </label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, title: e.target.value }))
                  }
                  placeholder={
                    form.mode === "homework"
                      ? "e.g. Mathematics: page 45 exercise"
                      : form.mode === "notice"
                        ? "e.g. Swimming gala — bring kit"
                        : "e.g. Showed great leadership today"
                  }
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-400 placeholder-slate-300"
                />
                {/* Quick titles */}
                <div className="flex flex-wrap gap-1 mt-2">
                  {QUICK_TITLES[form.mode].map((t) => (
                    <button
                      key={t}
                      onClick={() => setForm((f) => ({ ...f, title: t }))}
                      className="px-2 py-1 text-xs rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors"
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              {/* Content */}
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1.5 uppercase tracking-wide">
                  {form.mode === "observation"
                    ? "Observation notes"
                    : "Details"}
                </label>
                <textarea
                  value={form.content}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, content: e.target.value }))
                  }
                  placeholder={
                    form.mode === "homework"
                      ? "Specific instructions, pages, materials needed…"
                      : form.mode === "notice"
                        ? "More details for parents…"
                        : "Describe the competency or behaviour observed in detail…"
                  }
                  rows={form.mode === "observation" ? 5 : 3}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-400 resize-none placeholder-slate-300"
                />
              </div>

              {/* Due date — homework only */}
              {form.mode === "homework" && (
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1.5 uppercase tracking-wide">
                    Due date
                  </label>
                  <input
                    type="date"
                    value={form.dueDate}
                    min={today()}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, dueDate: e.target.value }))
                    }
                    aria-label="homework due date"
                    className="px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-400"
                  />
                </div>
              )}
            </div>

            {/* Submit */}
            <div className="px-5 py-4 bg-slate-50 border-t border-slate-100">
              <button
                onClick={handleSubmit}
                disabled={isPending}
                className="w-full py-2.5 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 transition-colors"
              >
                {isPending
                  ? "Saving…"
                  : isEditing
                    ? "Update entry"
                    : form.mode === "homework"
                      ? `Post homework to ${form.grade || "class"}`
                      : form.mode === "notice"
                        ? `Post notice to ${form.grade || "class"}`
                        : "Save observation"}
              </button>
            </div>
          </div>

          {/* Contextual info */}
          <div
            className={`rounded-xl px-4 py-3 border text-xs leading-relaxed ${MODE_CONFIG[form.mode].badge}`}
          >
            {form.mode === "homework" && (
              <>
                <strong>Homework entries</strong> are broadcast to all parents
                in {form.grade || "the class"}. Mark as submitted once the class
                hands in their work — parents will see the confirmation.
              </>
            )}
            {form.mode === "notice" && (
              <>
                <strong>Class notices</strong> appear in the announcements
                section of every parent's portal for {form.grade || "the class"}
                . Use these for events, reminders, and school-wide updates.
              </>
            )}
            {form.mode === "observation" && (
              <>
                <strong>Observations</strong> are private to the individual
                student's parent. They build the CBC "learning portrait" — a
                narrative record of competencies and character growth across the
                term.
              </>
            )}
          </div>
        </div>

        {/* ── RIGHT: Feed ── */}
        <div className="space-y-4">
          {/* Stats strip */}
          <div className="grid grid-cols-4 gap-2">
            {[
              {
                label: "Homework",
                count: counts.homework,
                dot: "bg-amber-400",
              },
              { label: "Notices", count: counts.notice, dot: "bg-sky-400" },
              {
                label: "Observations",
                count: counts.observation,
                dot: "bg-violet-500",
              },
              { label: "HW pending", count: counts.pending, dot: "bg-red-400" },
            ].map(({ label, count, dot }) => (
              <div
                key={label}
                className="bg-white rounded-xl border border-slate-200 px-3 py-2.5 text-center"
              >
                <div className={`w-2 h-2 rounded-full mx-auto mb-1 ${dot}`} />
                <p className="text-lg font-semibold text-slate-800">{count}</p>
                <p className="text-xs text-slate-400">{label}</p>
              </div>
            ))}
          </div>

          {/* Filter bar */}
          <div className="bg-white rounded-xl border border-slate-200 px-4 py-3 flex flex-wrap items-center gap-3">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wide">
              Filter
            </span>
            <select
              value={filterGrade}
              onChange={(e) => setFilterGrade(e.target.value)}
              aria-label="filter by class"
              className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-600 bg-white focus:outline-none focus:ring-1 focus:ring-emerald-400"
            >
              <option value="all">All classes</option>
              {grades.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>

            <div className="flex gap-1">
              {(["all", "homework", "notice", "observation"] as const).map(
                (t) => (
                  <button
                    key={t}
                    onClick={() => setFilterType(t)}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                      filterType === t
                        ? "bg-slate-800 text-white border-slate-800"
                        : "bg-white text-slate-500 border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    {t === "all" ? "All" : MODE_CONFIG[t as Mode].label}
                  </button>
                ),
              )}
            </div>

            <span className="ml-auto text-xs text-slate-400">
              {filtered.length} entries
            </span>
          </div>

          {/* Entry cards */}
          {filtered.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
              <p className="text-slate-400 text-sm">No entries yet.</p>
              <p className="text-slate-300 text-xs mt-1">
                Post a homework, notice, or observation using the form.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map((entry) => (
                <div key={entry.id}>
                  {deleteConfirm === entry.id && (
                    <div className="mb-1 px-4 py-2 bg-red-50 border border-red-100 rounded-lg text-xs text-red-600 flex items-center justify-between">
                      <span>Click delete again to confirm.</span>
                      <button
                        onClick={() => setDeleteConfirm(null)}
                        className="text-red-400 hover:text-red-600 underline"
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                  <EntryCard
                    entry={entry}
                    onEdit={startEdit}
                    onToggleComplete={handleToggleComplete}
                    onDelete={handleDelete}
                    isPending={isPending}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
