"use client";

import type { DiaryEntry } from "@/lib/types/parent";
import {
  AlertCircle,
  BookOpen,
  ChevronDown,
  Clock,
  Filter,
  PenLine,
} from "lucide-react";
import { useState } from "react";

function formatDate(dateStr: string) {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-KE", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}
function isDueSoon(d: string | null): boolean {
  if (!d) return false;
  const diff = (new Date(d + "T00:00:00").getTime() - Date.now()) / 86400000;
  return diff >= 0 && diff <= 3;
}
function isOverdue(d: string | null): boolean {
  if (!d) return false;
  return new Date(d + "T00:00:00") < new Date();
}
function shortDate(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString("en-KE", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

interface Props {
  entries: DiaryEntry[];
}

export function DiaryView({ entries }: Props) {
  const [subjectFilter, setSubjectFilter] = useState("all");
  const [showOnlyHw, setShowOnlyHw] = useState(false);

  const subjects = [
    "all",
    ...Array.from(
      new Set(entries.map((e) => e.subject_name).filter(Boolean) as string[]),
    ).sort(),
  ];
  const filtered = entries.filter((e) => {
    const ms = subjectFilter === "all" || e.subject_name === subjectFilter;
    const mh = !showOnlyHw || !!e.homework;
    return ms && mh;
  });
  const urgentHw = entries.filter((e) => e.homework && isDueSoon(e.due_date));

  return (
    <div className="space-y-4">
      {/* ── Due-soon banner — matches .alert .al-amber ─────────────────────── */}
      {urgentHw.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3.5 space-y-2.5">
          <p className="text-xs font-black uppercase tracking-widest text-amber-700 flex items-center gap-2">
            <AlertCircle className="h-3.5 w-3.5" />
            Homework due soon
          </p>
          {urgentHw.map((e) => (
            <div key={e.id} className="flex items-start gap-2">
              <span className="text-[10px] font-black text-amber-600 min-w-[72px] flex-shrink-0 mt-0.5">
                {e.subject_name ?? "General"}
              </span>
              <span className="flex-1 text-xs text-amber-800 leading-relaxed">
                {e.homework}
              </span>
              {e.due_date && (
                <span
                  className={`flex-shrink-0 text-[10px] font-black ml-1 ${isOverdue(e.due_date) ? "text-red-700" : "text-amber-700"}`}
                >
                  {shortDate(e.due_date)}
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── Filters ────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-0 max-w-[180px]">
          <select
            value={subjectFilter}
            onChange={(e) => setSubjectFilter(e.target.value)}
            aria-label="subject filter"
            className="w-full appearance-none rounded-xl border border-slate-200 bg-white px-3 py-2 pr-8 text-xs font-semibold text-slate-600 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 cursor-pointer shadow-sm"
          >
            {subjects.map((s) => (
              <option key={s} value={s}>
                {s === "all" ? "All subjects" : s}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
        </div>

        <button
          onClick={() => setShowOnlyHw((v) => !v)}
          className={[
            "flex items-center gap-1.5 rounded-full border px-4 py-1.5 text-xs font-bold transition-all active:scale-95",
            showOnlyHw
              ? "border-amber-500 bg-amber-500 text-white shadow-sm shadow-amber-200"
              : "border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:text-slate-700",
          ].join(" ")}
        >
          <Filter className="h-3 w-3" />
          Homework only
        </button>

        <p className="ml-auto text-[10px] font-bold text-slate-400">
          {filtered.length} {filtered.length !== 1 ? "entries" : "entry"}
        </p>
      </div>

      {/* ── Entries ────────────────────────────────────────────────────────── */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 py-14 text-center">
          <BookOpen className="h-8 w-8 text-slate-300 mx-auto mb-3" />
          <p className="font-bold text-slate-500">No diary entries found</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((entry) => {
            const hasHw = !!entry.homework;
            const overdue = isOverdue(entry.due_date);
            const soon = isDueSoon(entry.due_date);
            return (
              <div
                key={entry.id}
                className={[
                  "rounded-2xl border p-4 space-y-3 transition-all shadow-sm",
                  hasHw
                    ? "border-amber-200 bg-amber-50"
                    : "border-slate-200 bg-white",
                ].join(" ")}
              >
                {/* Header */}
                <div className="flex items-start gap-3">
                  <div
                    className={[
                      "flex-shrink-0 h-9 w-9 rounded-xl flex items-center justify-center border",
                      hasHw
                        ? "border-amber-200 bg-amber-100"
                        : "border-slate-200 bg-slate-100",
                    ].join(" ")}
                  >
                    {hasHw ? (
                      <PenLine className="h-4 w-4 text-amber-700" />
                    ) : (
                      <BookOpen className="h-4 w-4 text-slate-500" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <p className="text-sm font-black text-slate-800 leading-snug">
                        {entry.title}
                      </p>
                      {entry.subject_name && (
                        <span className="text-[10px] font-bold border border-cyan-200 bg-cyan-100 text-cyan-700 px-2 py-0.5 rounded-full">
                          {entry.subject_name}
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] font-semibold text-slate-400 flex items-center gap-1.5">
                      <Clock className="h-3 w-3" />
                      {formatDate(entry.diary_date)} · {entry.author_name}
                    </p>
                  </div>
                </div>

                {/* Body */}
                <p className="text-sm text-slate-600 leading-relaxed">
                  {entry.body}
                </p>

                {/* Homework block */}
                {hasHw && (
                  <div
                    className={[
                      "rounded-xl border px-3.5 py-3 space-y-1.5",
                      overdue
                        ? "border-red-200 bg-red-50"
                        : soon
                          ? "border-amber-300 bg-amber-100"
                          : "border-amber-200 bg-white",
                    ].join(" ")}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p
                        className={`text-[10px] font-black uppercase tracking-widest ${overdue ? "text-red-700" : "text-amber-700"}`}
                      >
                        {overdue ? "⚠ Overdue" : "📚 Homework"}
                      </p>
                      {entry.due_date && (
                        <span
                          className={`text-[10px] font-bold ${overdue ? "text-red-700" : soon ? "text-amber-700" : "text-slate-500"}`}
                        >
                          Due {shortDate(entry.due_date)}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-slate-700 leading-relaxed">
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
