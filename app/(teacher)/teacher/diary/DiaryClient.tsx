"use client";

// app/teacher/diary/DiaryClient.tsx

import { useState, useTransition, useRef } from "react";
import {
  createDiaryEntryAction,
  updateDiaryEntryAction,
} from "@/lib/actions/teacher";
import type { ClassStudent, TeacherDiaryEntry } from "@/lib/data/assessment";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Props {
  teacherName: string;
  grades: string[];
  studentsByGrade: Record<string, ClassStudent[]>;
  initialEntries: TeacherDiaryEntry[];
}

interface FormState {
  studentId: string;
  title: string;
  content: string;
  homework: boolean;
  dueDate: string;
}

const EMPTY_FORM: FormState = {
  studentId: "",
  title: "",
  content: "",
  homework: false,
  dueDate: "",
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-KE", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function today() {
  return new Date().toISOString().split("T")[0];
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function DiaryClient({
  teacherName,
  grades,
  studentsByGrade,
  initialEntries,
}: Props) {
  const [selectedGrade, setSelectedGrade] = useState(grades[0] ?? "");
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [entries, setEntries] = useState<TeacherDiaryEntry[]>(initialEntries);
  const [filterGrade, setFilterGrade] = useState<string>("all");
  const [filterType, setFilterType] = useState<"all" | "homework" | "note">(
    "all",
  );
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLDivElement>(null);

  const students = studentsByGrade[selectedGrade] ?? [];

  function showToast(msg: string, ok: boolean) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  }

  function resetForm() {
    setForm(EMPTY_FORM);
    setEditingId(null);
  }

  function startEdit(entry: TeacherDiaryEntry) {
    // Find which grade this student is in
    let grade = grades[0] ?? "";
    for (const g of grades) {
      if (studentsByGrade[g]?.some((s) => s.id === entry.student_id)) {
        grade = g;
        break;
      }
    }
    setSelectedGrade(grade);
    setForm({
      studentId: entry.student_id,
      title: entry.title,
      content: entry.content ?? "",
      homework: entry.homework,
      dueDate: entry.due_date ?? "",
    });
    setEditingId(entry.id);
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function handleSubmit() {
    if (!form.studentId || !form.title.trim()) {
      showToast("Please select a student and enter a title.", false);
      return;
    }

    startTransition(async () => {
      const fd = new FormData();
      fd.set("studentId", form.studentId);
      fd.set("title", form.title);
      fd.set("content", form.content);
      fd.set("homework", String(form.homework));
      fd.set("dueDate", form.dueDate);

      let result;
      if (editingId) {
        fd.set("isCompleted", "false");
        result = await updateDiaryEntryAction(editingId, fd);
      } else {
        result = await createDiaryEntryAction(fd);
      }

      if (result.success) {
        showToast(editingId ? "Entry updated." : "Entry saved.", true);

        // Optimistically update local list
        if (editingId) {
          setEntries((prev) =>
            prev.map((e) =>
              e.id === editingId
                ? {
                    ...e,
                    title: form.title,
                    content: form.content || null,
                    homework: form.homework,
                    due_date: form.dueDate || null,
                  }
                : e,
            ),
          );
        } else {
          // Add optimistic entry at top
          const student = students.find((s) => s.id === form.studentId);
          const newEntry: TeacherDiaryEntry = {
            id: `temp-${Date.now()}`,
            student_id: form.studentId,
            student_name: student?.full_name ?? "Unknown",
            grade: selectedGrade,
            title: form.title,
            content: form.content || null,
            homework: form.homework,
            due_date: form.dueDate || null,
            is_completed: false,
            created_at: new Date().toISOString(),
          };
          setEntries((prev) => [newEntry, ...prev]);
        }

        resetForm();
      } else {
        showToast(result.message, false);
      }
    });
  }

  // Filtered entries
  const filteredEntries = entries.filter((e) => {
    if (filterGrade !== "all" && e.grade !== filterGrade) return false;
    if (filterType === "homework" && !e.homework) return false;
    if (filterType === "note" && e.homework) return false;
    return true;
  });

  return (
    <div className="min-h-screen bg-[#F8F7F2]">
      {/* ── Header ── */}
      <div className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-slate-800 tracking-tight">
              Class Diary
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

      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl text-sm font-medium shadow-lg transition-all ${
            toast.ok ? "bg-emerald-600 text-white" : "bg-red-500 text-white"
          }`}
        >
          {toast.msg}
        </div>
      )}

      <div className="max-w-5xl mx-auto px-6 py-6 grid grid-cols-1 lg:grid-cols-[420px_1fr] gap-6">
        {/* ── LEFT: Form ── */}
        <div ref={formRef} className="space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            {/* Form header */}
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-700">
                {editingId ? "Edit Entry" : "New Diary Entry"}
              </h2>
              {editingId && (
                <button
                  onClick={resetForm}
                  className="text-xs text-slate-400 hover:text-slate-600"
                >
                  Cancel edit
                </button>
              )}
            </div>

            <div className="px-5 py-4 space-y-4">
              {/* Grade */}
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1.5 uppercase tracking-wide">
                  Class
                </label>
                <div className="flex flex-wrap gap-2">
                  {grades.map((g) => (
                    <button
                      key={g}
                      onClick={() => {
                        setSelectedGrade(g);
                        setForm((f) => ({ ...f, studentId: "" }));
                      }}
                      className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                        selectedGrade === g
                          ? "bg-emerald-600 text-white border-emerald-600"
                          : "bg-white text-slate-600 border-slate-200 hover:border-emerald-300"
                      }`}
                    >
                      {g}
                    </button>
                  ))}
                </div>
              </div>

              {/* Student */}
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1.5 uppercase tracking-wide">
                  Student
                </label>
                <select
                  aria-label="select student for diary entry"
                  value={form.studentId}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, studentId: e.target.value }))
                  }
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-400"
                >
                  <option value="">— Select student —</option>
                  {students.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.full_name}
                    </option>
                  ))}
                </select>
              </div>

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
                  placeholder="e.g. Fractions – Chapter 3"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-400 placeholder-slate-300"
                />
              </div>

              {/* Content */}
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1.5 uppercase tracking-wide">
                  Notes / Description
                </label>
                <textarea
                  value={form.content}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, content: e.target.value }))
                  }
                  placeholder="Topics covered, observations, next steps…"
                  rows={4}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-400 resize-none placeholder-slate-300"
                  aria-label="enter diary entry content"
                />
              </div>

              {/* Homework toggle */}
              <div className="flex items-center gap-3">
                <button
                  onClick={() =>
                    setForm((f) => ({ ...f, homework: !f.homework }))
                  }
                  className={`relative w-10 h-6 rounded-full transition-colors ${
                    form.homework ? "bg-amber-400" : "bg-slate-200"
                  }`}
                  aria-label="toggle homework assignment"
                >
                  <span
                    className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                      form.homework ? "translate-x-5" : "translate-x-1"
                    }`}
                  />
                </button>
                <span className="text-sm text-slate-600">
                  {form.homework ? "Homework assigned" : "Class note only"}
                </span>
              </div>

              {/* Due date (only if homework) */}
              {form.homework && (
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1.5 uppercase tracking-wide">
                    Due Date
                  </label>
                  <input
                    aria-label="select due date"
                    type="date"
                    value={form.dueDate}
                    min={today()}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, dueDate: e.target.value }))
                    }
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
                  : editingId
                    ? "Update Entry"
                    : "Save Entry"}
              </button>
            </div>
          </div>

          {/* Info card */}
          <div className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-3">
            <p className="text-xs text-amber-700 leading-relaxed">
              Diary entries are visible to parents in the parent portal.
              Homework entries show a due date badge.
            </p>
          </div>
        </div>

        {/* ── RIGHT: Entries list ── */}
        <div className="space-y-4">
          {/* Filters */}
          <div className="bg-white rounded-xl border border-slate-200 px-4 py-3 flex flex-wrap items-center gap-3">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wide">
              Filter:
            </span>
            <select
              value={filterGrade}
              onChange={(e) => setFilterGrade(e.target.value)}
              className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-600 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-400"
              aria-label="select grade for filtering"
            >
              <option value="all">All classes</option>
              {grades.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
            <div className="flex gap-1">
              {(["all", "homework", "note"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setFilterType(t)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all capitalize ${
                    filterType === t
                      ? "bg-slate-800 text-white border-slate-800"
                      : "bg-white text-slate-500 border-slate-200 hover:border-slate-300"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
            <span className="ml-auto text-xs text-slate-400">
              {filteredEntries.length} entries
            </span>
          </div>

          {/* Entry cards */}
          {filteredEntries.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-10 text-center">
              <p className="text-slate-400 text-sm">No diary entries yet.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredEntries.map((entry) => (
                <div
                  key={entry.id}
                  className="bg-white rounded-xl border border-slate-200 px-5 py-4 hover:border-slate-300 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    {/* Type dot */}
                    <div
                      className={`mt-1 w-2 h-2 rounded-full shrink-0 ${
                        entry.homework ? "bg-amber-400" : "bg-sky-400"
                      }`}
                    />

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-medium text-slate-800">
                            {entry.title}
                          </p>
                          <p className="text-xs text-slate-400 mt-0.5">
                            {entry.student_name} · {entry.grade}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {entry.homework && entry.due_date && (
                            <span className="text-xs bg-amber-50 text-amber-600 border border-amber-100 px-2 py-0.5 rounded-full">
                              Due {formatDate(entry.due_date)}
                            </span>
                          )}
                          {entry.homework && !entry.due_date && (
                            <span className="text-xs bg-amber-50 text-amber-600 border border-amber-100 px-2 py-0.5 rounded-full">
                              HW
                            </span>
                          )}
                          <button
                            onClick={() => startEdit(entry)}
                            className="p-1.5 rounded-lg text-slate-300 hover:text-slate-500 hover:bg-slate-50 transition-colors"
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
                        </div>
                      </div>

                      {entry.content && (
                        <p className="text-sm text-slate-500 mt-1.5 line-clamp-2">
                          {entry.content}
                        </p>
                      )}

                      <p className="text-xs text-slate-300 mt-2">
                        {formatDate(entry.created_at)}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
