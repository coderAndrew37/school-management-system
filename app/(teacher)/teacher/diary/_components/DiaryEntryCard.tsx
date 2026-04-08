"use client";

import {
  isClassWide,
  isObservation,
  type TeacherDiaryEntry
} from "@/lib/types/diary";
import { AlertTriangle, CheckCircle2, Clock, Edit3, Trash2 } from "lucide-react";

// ── Mode config ──────────────────────────────────────────────────────────────

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

export function DiaryEntryCard({
  entry,
  deleteConfirm,
  isPending,
  onEdit,
  onToggleComplete,
  onDelete,
  onCancelDelete,
}: DiaryEntryCardProps) {
  const cls = isClassWide(entry) ? entry : null;

  const dot = MODE_DOT[entry.entry_type] ?? "bg-slate-400";
  const badge = MODE_BADGE[entry.entry_type] ?? "";
  const label = MODE_LABEL[entry.entry_type] ?? entry.entry_type;

  // Derive display labels from joins if available
  const classLabel = entry.classes?.stream || "No Class";
  const studentLabel = entry.students?.full_name || "Individual Student";

  return (
    <div className="group">
      {/* Delete confirmation banner */}
      {deleteConfirm && (
        <div className="mb-2 px-4 py-2 bg-rose-50 border border-rose-100 rounded-xl text-[11px] text-rose-600 flex items-center justify-between animate-in fade-in slide-in-from-top-1">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-3 w-3" />
            <span className="font-bold uppercase tracking-tight">Confirm Deletion?</span>
          </div>
          <button
            onClick={onCancelDelete}
            className="font-black hover:underline px-2 py-1"
          >
            Cancel
          </button>
        </div>
      )}

      <div
        className={`bg-white rounded-2xl border transition-all duration-200 ${
          cls?.is_completed 
            ? "border-slate-100 bg-slate-50/50" 
            : "border-slate-200 shadow-sm hover:shadow-md hover:border-slate-300"
        }`}
      >
        <div className="p-4 flex items-start gap-4">
          <div className={`mt-2 w-2 h-2 rounded-full shrink-0 ${dot} ring-4 ring-white shadow-sm`} />

          <div className="flex-1 min-w-0">
            {/* Header */}
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p
                  className={`text-sm font-black leading-tight mb-1 ${
                    cls?.is_completed ? "line-through text-slate-400" : "text-slate-800"
                  }`}
                >
                  {entry.title}
                </p>
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-lg border font-black uppercase tracking-wider ${badge}`}
                  >
                    {label}
                  </span>
                  
                  {entry.subject_name && (
                    <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-lg">
                      {entry.subject_name}
                    </span>
                  )}

                  <span className="text-[10px] font-bold text-slate-400">
                    {isObservation(entry) ? `Student: ${studentLabel}` : `Class: ${classLabel}`}
                  </span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                {entry.entry_type === "homework" && cls && (
                  <button
                    aria-label={cls.is_completed ? "mark as incomplete" : "mark as complete"}
                    onClick={() => onToggleComplete(entry.id, !cls.is_completed)}
                    disabled={isPending}
                    className={`p-2 rounded-xl transition-colors ${
                      cls.is_completed
                        ? "text-emerald-500 bg-emerald-50"
                        : "text-slate-300 hover:text-emerald-500 hover:bg-emerald-50"
                    }`}
                  >
                    <CheckCircle2 className="h-4 w-4" />
                  </button>
                )}

                <button
                aria-label="edit entry"
                  onClick={() => onEdit(entry)}
                  className="p-2 rounded-xl text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                >
                  <Edit3 className="h-4 w-4" />
                </button>

                <button
                aria-label="delete entry"
                  disabled={isPending}
                  onClick={() => onDelete(entry.id)}
                  className="p-2 rounded-xl text-slate-300 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Content preview */}
            {entry.content && (
              <p className={`text-sm mt-3 leading-relaxed line-clamp-3 ${
                cls?.is_completed ? "text-slate-400" : "text-slate-600"
              }`}>
                {entry.content}
              </p>
            )}

            {/* Footer */}
            <div className="flex items-center gap-4 mt-4 pt-3 border-t border-slate-100">
              <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400">
                <Clock className="h-3 w-3" />
                {timeAgo(entry.created_at)}
              </div>

              {cls?.due_date && !cls.is_completed && (
                <div className="text-[10px] font-black text-amber-600 uppercase flex items-center gap-1">
                  <div className="w-1 h-1 rounded-full bg-amber-400" />
                  Due {formatDate(cls.due_date)}
                </div>
              )}

              {cls?.is_completed && (
                <div className="text-[10px] font-black text-emerald-600 uppercase flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" />
                  Submitted
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}