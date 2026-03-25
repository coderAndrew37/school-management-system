"use client";

import { isObservation, TeacherDiaryEntry } from "@/lib/types/diary"; // Use the consolidated types
import { ChildWithAssessments } from "@/lib/types/parent";
import {
  BookOpen,
  Calendar,
  ChevronRight,
  Search,
  User,
  Info,
  GraduationCap,
} from "lucide-react";
import { useState } from "react";

interface Props {
  diary: TeacherDiaryEntry[];
  child: ChildWithAssessments;
  children: ChildWithAssessments[];
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-KE", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

// ── Component ────────────────────────────────────────────────────────────────

export function DiaryPageClient({ diary, child, children }: Props) {
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<string | null>(diary[0]?.id ?? null);

  // Filter based on the new 'content' property
  const filtered = diary.filter(
    (e) =>
      !search ||
      e.title.toLowerCase().includes(search.toLowerCase()) ||
      (e.content?.toLowerCase().includes(search.toLowerCase()) ?? false),
  );

  // Group by month using 'created_at'
  const grouped = filtered.reduce<Record<string, TeacherDiaryEntry[]>>(
    (acc, e) => {
      const d = new Date(e.created_at);
      const key = d.toLocaleDateString("en-KE", {
        month: "long",
        year: "numeric",
      });
      (acc[key] ??= []).push(e);
      return acc;
    },
    {},
  );

  return (
    <div className="min-h-screen bg-[#f5f6fa]">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 h-14 flex items-center gap-3">
          <BookOpen className="h-5 w-5 text-amber-500 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-black text-slate-800">
              Correspondence Book
            </p>
            <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
              {child.full_name} · Grade {child.current_grade}
            </p>
          </div>

          {children.length > 1 && (
            <div className="flex gap-1.5">
              {children.map((c) => (
                <a
                  key={c.id}
                  href={`/parent/diary?child=${c.id}`}
                  className={`text-[10px] font-bold px-2.5 py-1 rounded-lg border transition-all ${
                    c.id === child.id
                      ? "bg-amber-500 text-white border-amber-500 shadow-sm"
                      : "bg-white text-slate-500 border-slate-200 hover:border-amber-300"
                  }`}
                >
                  {c.full_name.split(" ")[0]}
                </a>
              ))}
            </div>
          )}
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-5">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search diary or observations..."
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-700 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 transition-all"
          />
        </div>

        {filtered.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl border border-slate-200">
            <p className="text-3xl mb-2">📔</p>
            <p className="text-slate-500 font-semibold">No entries found</p>
          </div>
        ) : (
          Object.entries(grouped).map(([month, entries]) => (
            <div key={month} className="space-y-3">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">
                {month}
              </p>

              {entries.map((entry) => {
                const open = expanded === entry.id;
                const isObs = isObservation(entry);

                return (
                  <div
                    key={entry.id}
                    className={`bg-white rounded-2xl border transition-all overflow-hidden ${
                      open
                        ? "border-amber-200 shadow-md"
                        : "border-slate-200 shadow-sm"
                    }`}
                  >
                    <button
                      onClick={() => setExpanded(open ? null : entry.id)}
                      className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-slate-50 text-left"
                    >
                      {/* Icon Indicator based on type */}
                      <div
                        className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 border ${
                          isObs
                            ? "bg-indigo-50 border-indigo-100 text-indigo-500"
                            : entry.entry_type === "homework"
                              ? "bg-rose-50 border-rose-100 text-rose-500"
                              : "bg-amber-50 border-amber-100 text-amber-500"
                        }`}
                      >
                        {isObs ? (
                          <GraduationCap size={20} />
                        ) : entry.entry_type === "homework" ? (
                          <BookOpen size={20} />
                        ) : (
                          <Info size={20} />
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <p className="text-sm font-bold text-slate-800 truncate">
                            {entry.title}
                          </p>
                          <span
                            className={`text-[8px] font-black px-1.5 py-0.5 rounded uppercase border ${
                              isObs
                                ? "bg-indigo-50 text-indigo-600 border-indigo-100"
                                : "bg-slate-50 text-slate-500 border-slate-100"
                            }`}
                          >
                            {entry.entry_type}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 truncate">
                          {entry.content}
                        </p>
                      </div>

                      <ChevronRight
                        className={`h-4 w-4 text-slate-300 transition-transform ${open ? "rotate-90" : ""}`}
                      />
                    </button>

                    {open && (
                      <div className="border-t border-slate-100 px-4 pb-5 pt-4 space-y-4 bg-white">
                        <div className="prose prose-sm text-slate-600 leading-relaxed">
                          {entry.content || "No content provided."}
                        </div>

                        {/* Homework Specific: Due Date */}
                        {!isObs &&
                          entry.entry_type === "homework" &&
                          entry.due_date && (
                            <div className="bg-rose-50 border border-rose-100 rounded-xl p-3 flex items-center gap-3">
                              <Calendar className="h-4 w-4 text-rose-500" />
                              <div>
                                <p className="text-[10px] font-black uppercase text-rose-500">
                                  Submission Due
                                </p>
                                <p className="text-sm text-rose-900 font-bold">
                                  {formatDate(entry.due_date)}
                                </p>
                              </div>
                            </div>
                          )}

                        <div className="flex items-center gap-3 pt-2 border-t border-slate-50">
                          <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400">
                            <User className="h-3 w-3" />
                            <span>Teacher</span>
                            <span className="text-slate-200">|</span>
                            <span>{formatDate(entry.created_at)}</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
