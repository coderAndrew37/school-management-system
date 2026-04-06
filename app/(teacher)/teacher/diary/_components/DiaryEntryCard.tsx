"use client";
// app/teacher/diary/_components/DiaryEntryCard.tsx
// Pure presentational card — renders one diary entry.
// All mutations are handled by the parent via callback props.

import {
  isClassWide,
  isObservation,
  type ClassDiaryEntry,
  type ObservationEntry,
  type TeacherDiaryEntry,
} from "@/lib/types/diary";

// ── Mode config (local — mirrors DiaryForm's config) ─────────────────────────

const MODE_DOT: Record<string, string> = {
  homework: "bg-amber-400",
  notice: "bg-sky-400",
  observation: "bg-violet-500",
};

const MODE_BADGE: Record<string, string> = {
  homework: "bg-amber-50 text-amber-700 border-amber-200",
  notice: "bg-sky-50 text-sky-700 border-sky-200",
  observation: "bg-violet-50 text-violet-700 border-violet-200",
};

const MODE_LABEL: Record<string, string> = {
  homework: "Homework",
  notice: "Class Notice",
  observation: "Observation",
};

// ── Date helpers ──────────────────────────────────────────────────────────────

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-KE", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function timeAgo(iso: string) {
  const h = (Date.now() - new Date(iso).getTime()) / 3_600_000;
  if (h < 1) return "Just now";
  if (h < 24) return `${Math.floor(h)}h ago`;
  if (h < 48) return "Yesterday";
  return formatDate(iso);
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface DiaryEntryCardProps {
  entry: TeacherDiaryEntry;
  deleteConfirm: boolean;
  isPending: boolean;
  onEdit: (entry: TeacherDiaryEntry) => void;
  onToggleComplete: (id: string, completed: boolean) => void;
  onDelete: (id: string) => void;
  onCancelDelete: () => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function DiaryEntryCard({
  entry,
  deleteConfirm,
  isPending,
  onEdit,
  onToggleComplete,
  onDelete,
  onCancelDelete,
}: DiaryEntryCardProps) {
  const cls = isClassWide(entry) ? (entry as ClassDiaryEntry) : null;
  const obs = isObservation(entry) ? (entry as ObservationEntry) : null;
  const dot = MODE_DOT[entry.entry_type] ?? "bg-slate-400";
  const badge = MODE_BADGE[entry.entry_type] ?? "";
  const label = MODE_LABEL[entry.entry_type] ?? entry.entry_type;

  return (
    <div>
      {/* Delete confirmation banner */}
      {deleteConfirm && (
        <div className="mb-1 px-4 py-2 bg-red-50 border border-red-100 rounded-lg text-xs text-red-600 flex items-center justify-between">
          <span>Click delete again to confirm.</span>
          <button
            onClick={onCancelDelete}
            className="text-red-400 hover:text-red-600 underline"
          >
            Cancel
          </button>
        </div>
      )}

      <div
        className={`bg-white rounded-xl border transition-all hover:border-slate-300 ${
          cls?.is_completed ? "border-slate-100 opacity-70" : "border-slate-200"
        }`}
      >
        <div className="px-4 py-3.5 flex items-start gap-3">
          <div className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${dot}`} />

          <div className="flex-1 min-w-0">
            {/* Header */}
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
                  <span
                    className={`inline-flex items-center text-xs px-1.5 py-0.5 rounded border font-medium ${badge}`}
                  >
                    {label}
                  </span>
                  {obs && (
                    <span className="text-xs text-slate-400">
                      {obs.student_name}
                    </span>
                  )}
                  <span className="text-xs text-slate-400">
                    · {entry.grade}
                  </span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 shrink-0">
                {/* Completion toggle — homework only */}
                {entry.entry_type === "homework" && cls && (
                  <button
                    onClick={() =>
                      onToggleComplete(entry.id, !cls.is_completed)
                    }
                    disabled={isPending}
                    title={
                      cls.is_completed ? "Mark as pending" : "Mark submitted"
                    }
                    className={`p-1.5 rounded-lg transition-colors ${
                      cls.is_completed
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
                  title="Edit"
                  className="p-1.5 rounded-lg text-slate-300 hover:text-slate-600 hover:bg-slate-50 transition-colors"
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
                  title="Delete"
                  className="p-1.5 rounded-lg text-slate-300 hover:text-red-400 hover:bg-red-50 transition-colors"
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

            {/* Footer */}
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
    </div>
  );
}
