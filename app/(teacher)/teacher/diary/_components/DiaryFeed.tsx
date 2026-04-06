"use client";
// app/teacher/diary/_components/DiaryFeed.tsx
// Renders the filtered list of diary entries + filter controls.
// Owns no state — all state flows down from DiaryClient.

import { type DiaryEntryType, type TeacherDiaryEntry } from "@/lib/types/diary";
import { DiaryEntryCard } from "./DiaryEntryCard";

// ── Stats strip sub-component ─────────────────────────────────────────────────

interface DiaryStatsProps {
  homework: number;
  notice: number;
  observation: number;
  pending: number;
}

function DiaryStats({
  homework,
  notice,
  observation,
  pending,
}: DiaryStatsProps) {
  return (
    <div className="grid grid-cols-4 gap-2">
      {[
        { label: "Homework", count: homework, dot: "bg-amber-400" },
        { label: "Notices", count: notice, dot: "bg-sky-400" },
        { label: "Observations", count: observation, dot: "bg-violet-500" },
        { label: "HW pending", count: pending, dot: "bg-red-400" },
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
  );
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface DiaryFeedProps {
  entries: TeacherDiaryEntry[];
  grades: string[];
  filterGrade: string;
  filterType: "all" | DiaryEntryType;
  deleteConfirmId: string | null;
  isPending: boolean;
  onFilterGrade: (g: string) => void;
  onFilterType: (t: "all" | DiaryEntryType) => void;
  onEdit: (entry: TeacherDiaryEntry) => void;
  onToggleComplete: (id: string, completed: boolean) => void;
  onDelete: (id: string) => void;
  onCancelDelete: () => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function DiaryFeed({
  entries,
  grades,
  filterGrade,
  filterType,
  deleteConfirmId,
  isPending,
  onFilterGrade,
  onFilterType,
  onEdit,
  onToggleComplete,
  onDelete,
  onCancelDelete,
}: DiaryFeedProps) {
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
        e.entry_type === "homework" &&
        !(e as { is_completed: boolean }).is_completed,
    ).length,
  };

  return (
    <div className="space-y-4">
      <DiaryStats {...counts} />

      {/* Filter bar */}
      <div className="bg-white rounded-xl border border-slate-200 px-4 py-3 flex flex-wrap items-center gap-3">
        <span className="text-xs font-medium text-slate-400 uppercase tracking-wide">
          Filter
        </span>

        <select
          value={filterGrade}
          onChange={(e) => onFilterGrade(e.target.value)}
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
          {(["all", "homework", "notice", "observation"] as const).map((t) => (
            <button
              key={t}
              onClick={() => onFilterType(t)}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                filterType === t
                  ? "bg-slate-800 text-white border-slate-800"
                  : "bg-white text-slate-500 border-slate-200 hover:border-slate-300"
              }`}
            >
              {t === "all"
                ? "All"
                : t === "homework"
                  ? "Homework"
                  : t === "notice"
                    ? "Notice"
                    : "Observation"}
            </button>
          ))}
        </div>

        <span className="ml-auto text-xs text-slate-400">
          {filtered.length} entries
        </span>
      </div>

      {/* Entry list */}
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
            <DiaryEntryCard
              key={entry.id}
              entry={entry}
              deleteConfirm={deleteConfirmId === entry.id}
              isPending={isPending}
              onEdit={onEdit}
              onToggleComplete={onToggleComplete}
              onDelete={onDelete}
              onCancelDelete={onCancelDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}
