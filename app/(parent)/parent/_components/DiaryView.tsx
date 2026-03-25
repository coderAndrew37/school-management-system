"use client";

import { TeacherDiaryEntry, isHomework } from "@/lib/types/diary";
import { AlertCircle, BookOpen, Clock, Filter, PenLine } from "lucide-react";
import { useState } from "react";

// Helper to handle potential undefined/null strings before creating a Date
function safeDate(d: string | null | undefined) {
  if (!d) return new Date();
  return new Date(d.includes("T") ? d : d + "T00:00:00");
}

function formatDate(dateStr: string | null | undefined) {
  if (!dateStr) return "No date";
  return safeDate(dateStr).toLocaleDateString("en-KE", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

function isDueSoon(d: string | null | undefined): boolean {
  if (!d) return false;
  const diff = (safeDate(d).getTime() - Date.now()) / 86400000;
  return diff >= 0 && diff <= 3;
}

function isOverdue(d: string | null | undefined): boolean {
  if (!d) return false;
  return safeDate(d) < new Date();
}

function shortDate(d: string | null | undefined) {
  if (!d) return "";
  return safeDate(d).toLocaleDateString("en-KE", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

interface Props {
  entries: TeacherDiaryEntry[];
}

export function DiaryView({ entries }: Props) {
  const [showOnlyHw, setShowOnlyHw] = useState(false);

  const filtered = entries.filter((e) => {
    return !showOnlyHw || e.entry_type === "homework";
  });

  const urgentHw = entries.filter(
    (e) => isHomework(e) && isDueSoon(e.due_date),
  );

  return (
    <div className="space-y-4">
      {/* ── Due-soon banner ────────────────────────────────────────────────── */}
      {urgentHw.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3.5 space-y-2.5">
          <p className="text-xs font-black uppercase tracking-widest text-amber-700 flex items-center gap-2">
            <AlertCircle className="h-3.5 w-3.5" />
            Homework due soon
          </p>
          {urgentHw.map((e) => (
            <div key={e.id} className="flex items-start gap-2">
              <span className="text-[10px] font-black text-amber-600 min-w-[72px] flex-shrink-0 mt-0.5">
                {e.subject_name || e.title}
              </span>
              <span className="flex-1 text-xs text-amber-800 leading-relaxed line-clamp-1">
                {e.body || e.content}
              </span>
              {isHomework(e) && e.due_date && (
                <span
                  className={`flex-shrink-0 text-[10px] font-black ml-1 ${
                    isOverdue(e.due_date) ? "text-red-700" : "text-amber-700"
                  }`}
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
            const isHw = entry.entry_type === "homework";
            const isObs = entry.entry_type === "observation";
            const overdue = isHomework(entry) && isOverdue(entry.due_date);
            const soon = isHomework(entry) && isDueSoon(entry.due_date);

            return (
              <div
                key={entry.id}
                className={[
                  "rounded-2xl border p-4 space-y-3 transition-all shadow-sm",
                  isHw
                    ? "border-amber-200 bg-amber-50"
                    : isObs
                      ? "border-purple-200 bg-purple-50"
                      : "border-slate-200 bg-white",
                ].join(" ")}
              >
                {/* Header */}
                <div className="flex items-start gap-3">
                  <div
                    className={[
                      "flex-shrink-0 h-9 w-9 rounded-xl flex items-center justify-center border",
                      isHw
                        ? "border-amber-200 bg-amber-100"
                        : isObs
                          ? "border-purple-200 bg-purple-100"
                          : "border-slate-200 bg-slate-100",
                    ].join(" ")}
                  >
                    {isHw ? (
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
                      <span
                        className={[
                          "text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase",
                          isHw
                            ? "border-amber-200 bg-amber-100 text-amber-700"
                            : isObs
                              ? "border-purple-200 bg-purple-100 text-purple-700"
                              : "border-blue-200 bg-blue-100 text-blue-700",
                        ].join(" ")}
                      >
                        {entry.entry_type}
                      </span>
                    </div>
                    <p className="text-[10px] font-semibold text-slate-400 flex items-center gap-1.5">
                      <Clock className="h-3 w-3" />
                      {formatDate(entry.created_at)}
                    </p>
                  </div>
                </div>

                {/* Content */}
                <p className="text-sm text-slate-600 leading-relaxed">
                  {entry.body || entry.content}
                </p>

                {/* Homework specific footer info */}
                {isHomework(entry) && entry.due_date && (
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
                        className={`text-[10px] font-black uppercase tracking-widest ${
                          overdue ? "text-red-700" : "text-amber-700"
                        }`}
                      >
                        {overdue ? "⚠ Overdue" : "📚 Homework Details"}
                      </p>
                      <span
                        className={`text-[10px] font-bold ${
                          overdue
                            ? "text-red-700"
                            : soon
                              ? "text-amber-700"
                              : "text-slate-500"
                        }`}
                      >
                        Due {shortDate(entry.due_date)}
                      </span>
                    </div>
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
