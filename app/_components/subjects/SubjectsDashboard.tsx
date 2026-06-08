"use client";

import { useState, useTransition, useMemo, useCallback } from "react";
import type { Subject } from "@/lib/data/subjects";
import { deleteSubject, bulkImportCbcTemplate } from "@/lib/actions/subjects";
import { SubjectModal } from "./SubjectModal";

// ─────────────────────────────────────────────────────────────────────────────
// Types & Constants
// ─────────────────────────────────────────────────────────────────────────────

interface SubjectDashboardProps {
  schoolId: string;
  initialSubjects: Subject[];
}

type LevelFilter = "all" | "lower_primary" | "upper_primary" | "junior_secondary";

const LEVEL_LABELS: Record<Subject["level"], string> = {
  lower_primary: "Lower Primary",
  upper_primary: "Upper Primary",
  junior_secondary: "Junior Secondary",
};

const LEVEL_BADGE_CLASSES: Record<Subject["level"], string> = {
  lower_primary:
    "bg-emerald-50 text-emerald-700 border border-emerald-200",
  upper_primary:
    "bg-amber-50 text-amber-700 border border-amber-200",
  junior_secondary:
    "bg-indigo-50 text-indigo-700 border border-indigo-200",
};

const LEVEL_FILTER_OPTIONS: { value: LevelFilter; label: string }[] = [
  { value: "all", label: "All Levels" },
  { value: "lower_primary", label: "Lower Primary" },
  { value: "upper_primary", label: "Upper Primary" },
  { value: "junior_secondary", label: "Junior Secondary" },
];

// ─────────────────────────────────────────────────────────────────────────────
// Toast Notification (inline lightweight)
// ─────────────────────────────────────────────────────────────────────────────

interface ToastState {
  message: string;
  type: "success" | "error";
}

// ─────────────────────────────────────────────────────────────────────────────
// Delete Confirmation Dialog
// ─────────────────────────────────────────────────────────────────────────────

interface DeleteDialogProps {
  subject: Subject;
  onConfirm: () => void;
  onCancel: () => void;
  isPending: boolean;
}

function DeleteDialog({ subject, onConfirm, onCancel, isPending }: DeleteDialogProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
        <div className="px-6 pt-6 pb-4 text-center">
          <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </div>
          <h3 className="text-base font-bold text-slate-800 mb-1">Delete Subject</h3>
          <p className="text-sm text-slate-500">
            Are you sure you want to delete{" "}
            <span className="font-semibold text-slate-700">{subject.name}</span>
            ? This action cannot be undone.
          </p>
        </div>
        <div className="px-6 pb-6 flex gap-3">
          <button
            onClick={onCancel}
            disabled={isPending}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isPending}
            className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white bg-red-600 hover:bg-red-700 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {isPending ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Deleting…
              </>
            ) : (
              "Delete"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Row Context Menu
// ─────────────────────────────────────────────────────────────────────────────

interface RowMenuProps {
  onEdit: () => void;
  onDelete: () => void;
}

function RowMenu({ onEdit, onDelete }: RowMenuProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
        aria-label="Row actions"
      >
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
          <path d="M10 6a2 2 0 110-4 2 2 0 010 4zm0 6a2 2 0 110-4 2 2 0 010 4zm0 6a2 2 0 110-4 2 2 0 010 4z" />
        </svg>
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 w-36 bg-white rounded-xl shadow-lg border border-slate-200 z-10 overflow-hidden py-1">
          <button
            onClick={() => { setOpen(false); onEdit(); }}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
          >
            <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            Edit
          </button>
          <button
            onClick={() => { setOpen(false); onDelete(); }}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
          >
            <svg className="w-4 h-4 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Delete
          </button>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Level Summary Pills
// ─────────────────────────────────────────────────────────────────────────────

function LevelSummary({ subjects }: { subjects: Subject[] }) {
  const counts = useMemo(() => {
    return subjects.reduce<Record<Subject["level"], number>>(
      (acc, s) => {
        acc[s.level] = (acc[s.level] ?? 0) + 1;
        return acc;
      },
      { lower_primary: 0, upper_primary: 0, junior_secondary: 0 }
    );
  }, [subjects]);

  return (
    <div className="flex flex-wrap gap-2">
      {(["lower_primary", "upper_primary", "junior_secondary"] as Subject["level"][]).map(
        (level) => (
          <span
            key={level}
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${LEVEL_BADGE_CLASSES[level]}`}
          >
            {LEVEL_LABELS[level]}
            <span className="font-bold">{counts[level]}</span>
          </span>
        )
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Empty State
// ─────────────────────────────────────────────────────────────────────────────

function EmptyState({
  onImport,
  isPending,
}: {
  onImport: () => void;
  isPending: boolean;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-24 px-6 text-center">
      <div className="w-20 h-20 rounded-2xl bg-blue-50 border-2 border-dashed border-blue-200 flex items-center justify-center mb-6">
        <svg className="w-9 h-9 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
        </svg>
      </div>
      <h3 className="text-xl font-bold text-slate-800 mb-2">No subjects yet</h3>
      <p className="text-slate-500 text-sm max-w-sm mb-8 leading-relaxed">
        Get started quickly by loading the standard Kenyan CBC curriculum subjects, or add them one by one using the button above.
      </p>
      <button
        onClick={onImport}
        disabled={isPending}
        className="inline-flex items-center gap-2.5 px-6 py-3 rounded-xl text-sm font-bold text-white bg-blue-900 hover:bg-blue-800 active:bg-blue-950 transition-colors disabled:opacity-60 shadow-md shadow-blue-900/20"
      >
        {isPending ? (
          <>
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Importing CBC Subjects…
          </>
        ) : (
          <>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
            Load Standard CBC Subjects Template
          </>
        )}
      </button>
      <p className="mt-4 text-xs text-slate-400">
        Imports 26 standard CBC subjects across all three levels.
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Dashboard Component
// ─────────────────────────────────────────────────────────────────────────────

export function SubjectDashboard({ schoolId, initialSubjects }: SubjectDashboardProps) {
  const [subjects, setSubjects] = useState<Subject[]>(initialSubjects);
  const [search, setSearch] = useState<string>("");
  const [levelFilter, setLevelFilter] = useState<LevelFilter>("all");
  const [toast, setToast] = useState<ToastState | null>(null);
  const [modalOpen, setModalOpen] = useState<boolean>(false);
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null);
  const [deletingSubject, setDeletingSubject] = useState<Subject | null>(null);

  const [isImporting, startImportTransition] = useTransition();
  const [isDeleting, startDeleteTransition] = useTransition();

  // Show toast and auto-dismiss after 4s
  const showToast = useCallback((message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  }, []);

  // ── Filtering ──────────────────────────────────────────────────────────────
  const filteredSubjects = useMemo(() => {
    const term = search.toLowerCase().trim();
    return subjects.filter((s) => {
      const matchesSearch =
        !term ||
        s.name.toLowerCase().includes(term) ||
        s.code.toLowerCase().includes(term);
      const matchesLevel = levelFilter === "all" || s.level === levelFilter;
      return matchesSearch && matchesLevel;
    });
  }, [subjects, search, levelFilter]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  function handleOpenCreate() {
    setEditingSubject(null);
    setModalOpen(true);
  }

  function handleOpenEdit(subject: Subject) {
    setEditingSubject(subject);
    setModalOpen(true);
  }

  function handleModalSuccess(message: string) {
    showToast(message, "success");
    // Trigger re-fetch via router.refresh() is handled by revalidatePath in server action.
    // For optimistic UI, we rely on Next.js router refresh; the component will re-render
    // with updated data from the server. For a more instant feel, reload the subjects.
    window.location.reload();
  }

  function handleDeleteRequest(subject: Subject) {
    setDeletingSubject(subject);
  }

  function handleDeleteConfirm() {
    if (!deletingSubject) return;
    startDeleteTransition(async () => {
      const result = await deleteSubject(deletingSubject.id, schoolId);
      if (result.success) {
        setSubjects((prev) => prev.filter((s) => s.id !== deletingSubject.id));
        showToast(`"${deletingSubject.name}" deleted successfully.`, "success");
      } else {
        showToast(result.error ?? "Failed to delete subject.", "error");
      }
      setDeletingSubject(null);
    });
  }

  function handleImport() {
    startImportTransition(async () => {
      const result = await bulkImportCbcTemplate(schoolId);
      if (result.success) {
        showToast(
          `Successfully imported ${result.data?.count ?? 0} CBC subjects.`,
          "success"
        );
        window.location.reload();
      } else {
        showToast(result.error ?? "Import failed.", "error");
      }
    });
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-slate-50">
      {/* ── Page Header ──────────────────────────────────────────────── */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <div className="w-2 h-2 rounded-full bg-teal-500" />
                <span className="text-xs font-semibold text-teal-600 uppercase tracking-wider">
                  Curriculum Management
                </span>
              </div>
              <h1 className="text-2xl font-extrabold text-blue-900 tracking-tight">
                Subjects
              </h1>
              <p className="text-slate-500 text-sm mt-1">
                Manage your school&apos;s CBC curriculum subject catalogue.
              </p>
            </div>
            <div className="flex items-center gap-3">
              {subjects.length > 0 && (
                <button
                  onClick={handleImport}
                  disabled={isImporting}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-blue-700 bg-blue-50 border border-blue-200 hover:bg-blue-100 transition-colors disabled:opacity-50"
                >
                  {isImporting ? (
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                    </svg>
                  )}
                  Import CBC Template
                </button>
              )}
              <button
                onClick={handleOpenCreate}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white bg-blue-900 hover:bg-blue-800 active:bg-blue-950 transition-colors shadow-sm shadow-blue-900/20"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                Add Subject
              </button>
            </div>
          </div>

          {/* Level Summary Pills */}
          {subjects.length > 0 && (
            <div className="mt-5 pt-4 border-t border-slate-100">
              <LevelSummary subjects={subjects} />
            </div>
          )}
        </div>
      </div>

      {/* ── Main Content ──────────────────────────────────────────────── */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {subjects.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
            <EmptyState onImport={handleImport} isPending={isImporting} />
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            {/* ── Filters Bar ───────────────────────────────────────────── */}
            <div className="px-5 py-4 border-b border-slate-100 flex flex-wrap gap-3 items-center">
              {/* Search */}
              <div className="relative flex-1 min-w-[200px] max-w-xs">
                <svg
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by name or code…"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 transition-all"
                />
                {search && (
                  <button
                    onClick={() => setSearch("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    aria-label="Clear search"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>

              {/* Level filter */}
              <select
              aria-label='level filter'
                value={levelFilter}
                onChange={(e) => setLevelFilter(e.target.value as LevelFilter)}
                className="px-4 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 bg-white transition-all appearance-none cursor-pointer"
                style={{
                  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%236b7280' stroke-width='2'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' d='M19 9l-7 7-7-7'/%3E%3C/svg%3E")`,
                  backgroundRepeat: "no-repeat",
                  backgroundPosition: "right 12px center",
                  backgroundSize: "16px",
                  paddingRight: "36px",
                }}
              >
                {LEVEL_FILTER_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>

              {/* Result count */}
              <span className="ml-auto text-xs font-medium text-slate-400">
                {filteredSubjects.length} of {subjects.length} subjects
              </span>
            </div>

            {/* ── Table ──────────────────────────────────────────────────── */}
            {filteredSubjects.length === 0 ? (
              <div className="py-20 text-center">
                <svg className="w-10 h-10 text-slate-300 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <p className="text-slate-500 text-sm font-medium">No subjects match your filters.</p>
                <button
                  onClick={() => { setSearch(""); setLevelFilter("all"); }}
                  className="mt-3 text-xs text-blue-600 hover:text-blue-800 font-semibold"
                >
                  Clear filters
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100">
                      <th className="text-left px-5 py-3.5 text-xs font-bold text-slate-500 uppercase tracking-wider">
                        Subject
                      </th>
                      <th className="text-left px-5 py-3.5 text-xs font-bold text-slate-500 uppercase tracking-wider">
                        Code
                      </th>
                      <th className="text-left px-5 py-3.5 text-xs font-bold text-slate-500 uppercase tracking-wider">
                        Level
                      </th>
                      <th className="text-left px-5 py-3.5 text-xs font-bold text-slate-500 uppercase tracking-wider">
                        Weekly Lessons
                      </th>
                      <th className="text-left px-5 py-3.5 text-xs font-bold text-slate-500 uppercase tracking-wider">
                        KNEC Learning Area
                      </th>
                      <th className="w-12 px-2 py-3.5" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredSubjects.map((subject) => (
                      <tr
                        key={subject.id}
                        className="group hover:bg-slate-50/60 transition-colors"
                      >
                        {/* Subject Name */}
                        <td className="px-5 py-4">
                          <span className="text-sm font-semibold text-slate-800">
                            {subject.name}
                          </span>
                        </td>

                        {/* Code */}
                        <td className="px-5 py-4">
                          <code className="text-xs font-mono font-bold text-teal-700 bg-teal-50 border border-teal-200 px-2 py-1 rounded-md">
                            {subject.code}
                          </code>
                        </td>

                        {/* Level Badge */}
                        <td className="px-5 py-4">
                          <span
                            className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${LEVEL_BADGE_CLASSES[subject.level]}`}
                          >
                            {LEVEL_LABELS[subject.level]}
                          </span>
                        </td>

                        {/* Weekly Lessons */}
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2">
                            <div className="flex gap-0.5">
                              {Array.from({ length: Math.min(subject.weekly_lessons, 7) }).map(
                                (_, i) => (
                                  <div
                                    key={i}
                                    className="w-1.5 h-4 rounded-sm bg-blue-200"
                                  />
                                )
                              )}
                              {subject.weekly_lessons > 7 && (
                                <span className="text-xs text-slate-400 ml-1">+{subject.weekly_lessons - 7}</span>
                              )}
                            </div>
                            <span className="text-sm text-slate-600 font-medium">
                              {subject.weekly_lessons}
                              <span className="text-xs text-slate-400 font-normal ml-0.5">/ wk</span>
                            </span>
                          </div>
                        </td>

                        {/* KNEC Learning Area */}
                        <td className="px-5 py-4">
                          {subject.knec_learning_area ? (
                            <span className="text-sm text-slate-500">{subject.knec_learning_area}</span>
                          ) : (
                            <span className="text-xs text-slate-300 italic">—</span>
                          )}
                        </td>

                        {/* Context Menu */}
                        <td className="px-2 py-4">
                          <RowMenu
                            onEdit={() => handleOpenEdit(subject)}
                            onDelete={() => handleDeleteRequest(subject)}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Subject Upsert Modal ──────────────────────────────────────── */}
      <SubjectModal
        subject={editingSubject}
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSuccess={handleModalSuccess}
      />

      {/* ── Delete Confirmation ───────────────────────────────────────── */}
      {deletingSubject && (
        <DeleteDialog
          subject={deletingSubject}
          onConfirm={handleDeleteConfirm}
          onCancel={() => setDeletingSubject(null)}
          isPending={isDeleting}
        />
      )}

      {/* ── Toast Notification ────────────────────────────────────────── */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-[100] flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-xl text-sm font-semibold transition-all animate-in slide-in-from-bottom-4 fade-in duration-300 ${
            toast.type === "success"
              ? "bg-blue-900 text-white"
              : "bg-red-600 text-white"
          }`}
        >
          {toast.type === "success" ? (
            <svg className="w-5 h-5 text-teal-300 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
          ) : (
            <svg className="w-5 h-5 text-red-200 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126z" />
            </svg>
          )}
          {toast.message}
          <button
            onClick={() => setToast(null)}
            className="ml-2 opacity-70 hover:opacity-100 transition-opacity"
            aria-label="Dismiss"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}