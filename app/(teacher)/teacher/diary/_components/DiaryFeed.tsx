"use client";

import { 
  type DiaryEntryType, 
  type TeacherDiaryEntry, 
  isHomework 
} from "@/lib/types/diary";
import { DiaryEntryCard } from "./DiaryEntryCard";
import { Filter, Inbox } from "lucide-react";

// ── Stats strip sub-component ─────────────────────────────────────────────────

interface DiaryStatsProps {
  homework: number;
  notice: number;
  observation: number;
  pending: number;
}

function DiaryStats({ homework, notice, observation, pending }: DiaryStatsProps) {
  const stats = [
    { label: "Homework", count: homework, dot: "bg-amber-400" },
    { label: "Notices", count: notice, dot: "bg-sky-400" },
    { label: "Observations", count: observation, dot: "bg-violet-500" },
    { label: "HW Pending", count: pending, dot: "bg-rose-500" },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {stats.map(({ label, count, dot }) => (
        <div
          key={label}
          className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm"
        >
          <div className="flex items-center gap-2 mb-1">
            <div className={`w-1.5 h-1.5 rounded-full ${dot}`} />
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">{label}</p>
          </div>
          <p className="text-2xl font-black text-slate-800">{count}</p>
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
  
  // FIX: Access grade via entry.classes?.label
  const filtered = entries.filter((e) => {
    const entryGrade = e.classes?.grade ?? "Unassigned";
    if (filterGrade !== "all" && entryGrade !== filterGrade) return false;
    if (filterType !== "all" && e.entry_type !== filterType) return false;
    return true;
  });

  const counts = {
    homework: entries.filter((e) => e.entry_type === "homework").length,
    notice: entries.filter((e) => e.entry_type === "notice").length,
    observation: entries.filter((e) => e.entry_type === "observation").length,
    pending: entries.filter((e) => isHomework(e) && !e.is_completed).length,
  };

  return (
    <div className="space-y-6">
      <DiaryStats {...counts} />

      {/* Filter bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-2 flex flex-wrap items-center gap-2 shadow-sm">
        <div className="flex items-center gap-2 px-3 py-1.5 border-r border-slate-100 mr-1">
          <Filter className="h-3.5 w-3.5 text-slate-400" />
          <span className="text-[10px] font-black uppercase tracking-tighter text-slate-400">Filters</span>
        </div>

        <select
        aria-label="filter by grade"
          value={filterGrade}
          onChange={(e) => onFilterGrade(e.target.value)}
          className="h-9 px-3 rounded-xl border-none bg-slate-50 text-xs font-bold text-slate-600 focus:ring-2 focus:ring-emerald-500/20"
        >
          <option value="all">All Classes</option>
          {grades.map((g) => (
            <option key={g} value={g}>{g}</option>
          ))}
        </select>

        <div className="flex bg-slate-50 p-1 rounded-xl gap-1">
          {(["all", "homework", "notice", "observation"] as const).map((t) => (
            <button
              key={t}
              onClick={() => onFilterType(t)}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wide transition-all ${
                filterType === t
                  ? "bg-white text-slate-800 shadow-sm ring-1 ring-slate-200"
                  : "text-slate-400 hover:text-slate-600"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="ml-auto pr-4 hidden sm:block">
          <span className="text-[10px] font-bold text-slate-300 uppercase">
            {filtered.length} Results
          </span>
        </div>
      </div>

      {/* Entry list */}
      {filtered.length === 0 ? (
        <div className="bg-slate-50/50 rounded-3xl border-2 border-dashed border-slate-200 py-20 flex flex-col items-center justify-center text-center">
          <div className="bg-white p-4 rounded-full shadow-sm mb-4">
            <Inbox className="h-8 w-8 text-slate-200" />
          </div>
          <p className="text-sm font-black text-slate-400 uppercase tracking-widest">No entries found</p>
          <p className="text-xs text-slate-300 mt-2 max-w-[200px]">
            Try adjusting your filters or post a new update using the form.
          </p>
        </div>
      ) : (
        <div className="grid gap-3">
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