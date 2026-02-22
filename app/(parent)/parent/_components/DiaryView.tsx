"use client";

import type { DiaryEntry } from "@/lib/types/parent";
import { AlertCircle, ChevronDown, Clock, Filter } from "lucide-react";
import { useState } from "react";

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(dateStr: string) {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-KE", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

function isDueSoon(dueDateStr: string | null): boolean {
  if (!dueDateStr) return false;
  const due = new Date(dueDateStr + "T00:00:00");
  const now = new Date();
  const diff = (due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
  return diff >= 0 && diff <= 3;
}

function isOverdue(dueDateStr: string | null): boolean {
  if (!dueDateStr) return false;
  return new Date(dueDateStr + "T00:00:00") < new Date();
}

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  entries: DiaryEntry[];
}

export function DiaryView({ entries }: Props) {
  const [subjectFilter, setSubjectFilter] = useState<string>("all");
  const [showOnlyHw, setShowOnlyHw] = useState(false);

  // Subject options
  const subjects = [
    "all",
    ...Array.from(
      new Set(entries.map((e) => e.subject_name).filter(Boolean) as string[]),
    ).sort(),
  ];

  // Filter
  const filtered = entries.filter((e) => {
    const matchSubject =
      subjectFilter === "all" || e.subject_name === subjectFilter;
    const matchHw = !showOnlyHw || !!e.homework;
    return matchSubject && matchHw;
  });

  // Homework due soon
  const urgentHw = entries.filter((e) => e.homework && isDueSoon(e.due_date));

  return (
    <div className="space-y-5">
      {/* Urgent homework banner */}
      {urgentHw.length > 0 && (
        <div className="rounded-xl border border-amber-400/30 bg-amber-400/[0.06] px-4 py-3 space-y-2">
          <p className="text-xs font-bold uppercase tracking-widest text-amber-400 flex items-center gap-2">
            <AlertCircle className="h-3.5 w-3.5" /> Homework due soon
          </p>
          {urgentHw.map((e) => (
            <div key={e.id} className="flex items-start gap-2 text-xs">
              <span className="text-amber-400/70 font-semibold flex-shrink-0 min-w-[80px]">
                {e.subject_name ?? "General"}
              </span>
              <span className="text-white/70">{e.homework}</span>
              {e.due_date && (
                <span
                  className={`ml-auto flex-shrink-0 font-bold ${isOverdue(e.due_date) ? "text-rose-400" : "text-amber-400"}`}
                >
                  Due{" "}
                  {new Date(e.due_date + "T00:00:00").toLocaleDateString(
                    "en-KE",
                    { day: "numeric", month: "short" },
                  )}
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <select
            aria-label="subject filter"
            value={subjectFilter}
            onChange={(e) => setSubjectFilter(e.target.value)}
            className="appearance-none rounded-xl border border-white/10 bg-white/5 pl-3 pr-8 py-2 text-xs text-white outline-none focus:border-white/20 cursor-pointer"
          >
            {subjects.map((s) => (
              <option key={s} value={s} className="bg-[#0c0f1a]">
                {s === "all" ? "All subjects" : s}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/30" />
        </div>
        <button
          onClick={() => setShowOnlyHw((v) => !v)}
          className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold border transition-all ${
            showOnlyHw
              ? "bg-amber-400/15 border-amber-400/30 text-amber-400"
              : "border-white/10 text-white/40 hover:text-white"
          }`}
        >
          <Filter className="h-3 w-3" />
          Homework only
        </button>
        <p className="ml-auto text-xs text-white/30">
          {filtered.length} entr{filtered.length !== 1 ? "ies" : "y"}
        </p>
      </div>

      {/* Entries */}
      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 py-16 text-center">
          <p className="text-3xl mb-2">📔</p>
          <p className="text-sm text-white/40">No diary entries found</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((entry) => {
            const hasHw = !!entry.homework;
            const overdue = isOverdue(entry.due_date);
            const dueSoon = isDueSoon(entry.due_date);

            return (
              <div
                key={entry.id}
                className={`rounded-2xl border p-5 space-y-3 transition-colors ${
                  hasHw
                    ? "border-amber-400/20 bg-amber-400/[0.03]"
                    : "border-white/[0.07] bg-white/[0.02]"
                }`}
              >
                {/* Header */}
                <div className="flex items-start gap-3">
                  <div
                    className={`flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center text-base ${
                      hasHw
                        ? "bg-amber-400/15 border border-amber-400/25"
                        : "bg-white/5 border border-white/10"
                    }`}
                  >
                    {hasHw ? "✏️" : "📝"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-white text-sm">
                        {entry.title}
                      </p>
                      {entry.subject_name && (
                        <span className="text-[10px] text-sky-400 border border-sky-400/25 bg-sky-400/10 px-2 py-0.5 rounded-md font-semibold">
                          {entry.subject_name}
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-white/30 mt-0.5 flex items-center gap-1.5">
                      <Clock className="h-3 w-3" />
                      {formatDate(entry.diary_date)} · {entry.author_name}
                    </p>
                  </div>
                </div>

                {/* Body */}
                <p className="text-sm text-white/60 leading-relaxed">
                  {entry.body}
                </p>

                {/* Homework block */}
                {hasHw && (
                  <div
                    className={`rounded-xl border px-4 py-3 space-y-1 ${
                      overdue
                        ? "border-rose-400/30 bg-rose-400/[0.07]"
                        : dueSoon
                          ? "border-amber-400/40 bg-amber-400/[0.09]"
                          : "border-amber-400/20 bg-amber-400/[0.05]"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p
                        className={`text-[10px] font-bold uppercase tracking-widest ${
                          overdue ? "text-rose-400" : "text-amber-400"
                        }`}
                      >
                        {overdue ? "⚠️ Overdue Homework" : "📚 Homework"}
                      </p>
                      {entry.due_date && (
                        <span
                          className={`text-[10px] font-bold ${overdue ? "text-rose-400" : dueSoon ? "text-amber-400" : "text-white/40"}`}
                        >
                          Due:{" "}
                          {new Date(
                            entry.due_date + "T00:00:00",
                          ).toLocaleDateString("en-KE", {
                            weekday: "short",
                            day: "numeric",
                            month: "short",
                          })}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-white/75 leading-relaxed">
                      {entry.homework}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
