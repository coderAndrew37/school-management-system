"use client";

import type { ChildWithAssessments, DiaryEntry } from "@/lib/types/parent";
import { BookOpen, Calendar, ChevronRight, Search, User } from "lucide-react";
import { useState } from "react";

interface Props {
  diary: DiaryEntry[];
  child: ChildWithAssessments;
  children: ChildWithAssessments[];
}

function formatDate(iso: string) {
  const d = new Date(iso.includes("T") ? iso : iso + "T00:00:00");
  return d.toLocaleDateString("en-KE", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}
function formatShort(iso: string) {
  const d = new Date(iso.includes("T") ? iso : iso + "T00:00:00");
  return d.toLocaleDateString("en-KE", { day: "numeric", month: "short" });
}

const SUBJECT_COLORS: Record<string, string> = {
  Mathematics: "bg-blue-50 text-blue-700 border-blue-200",
  Science: "bg-emerald-50 text-emerald-700 border-emerald-200",
  English: "bg-purple-50 text-purple-700 border-purple-200",
  Kiswahili: "bg-amber-50 text-amber-700 border-amber-200",
  "Social Studies": "bg-orange-50 text-orange-700 border-orange-200",
  CRE: "bg-rose-50 text-rose-700 border-rose-200",
  Art: "bg-pink-50 text-pink-700 border-pink-200",
  PE: "bg-teal-50 text-teal-700 border-teal-200",
};
function subjectColor(s: string | null) {
  if (!s) return "bg-slate-100 text-slate-600 border-slate-200";
  return SUBJECT_COLORS[s] ?? "bg-slate-100 text-slate-600 border-slate-200";
}

export function DiaryPageClient({ diary, child, children }: Props) {
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<string | null>(diary[0]?.id ?? null);

  const filtered = diary.filter(
    (e) =>
      !search ||
      e.title.toLowerCase().includes(search.toLowerCase()) ||
      e.subject_name?.toLowerCase().includes(search.toLowerCase()) ||
      e.body.toLowerCase().includes(search.toLowerCase()),
  );

  // Group by month
  const grouped = filtered.reduce<Record<string, DiaryEntry[]>>((acc, e) => {
    const d = new Date(
      e.diary_date.includes("T") ? e.diary_date : e.diary_date + "T00:00:00",
    );
    const key = d.toLocaleDateString("en-KE", {
      month: "long",
      year: "numeric",
    });
    (acc[key] ??= []).push(e);
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-[#f5f6fa]">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 h-14 flex items-center gap-3">
          <BookOpen className="h-5 w-5 text-amber-500 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-black text-slate-800">Class Diary</p>
            <p className="text-[10px] text-slate-400 font-semibold">
              {child.full_name}
            </p>
          </div>
          {children.length > 1 && (
            <div className="flex gap-1.5">
              {children.map((c) => (
                <a
                  key={c.id}
                  href={`/parent/diary?child=${c.id}`}
                  className={`text-xs font-bold px-2.5 py-1 rounded-lg border transition-all ${
                    c.id === child.id
                      ? "bg-amber-500 text-white border-amber-500"
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
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search diary entries…"
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-700 placeholder-slate-400 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 transition-all"
          />
        </div>

        {filtered.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl border border-slate-200">
            <p className="text-3xl mb-2">📔</p>
            <p className="text-slate-500 font-semibold">
              No diary entries found
            </p>
            {search && (
              <p className="text-xs text-slate-400 mt-1">
                Try a different search
              </p>
            )}
          </div>
        ) : (
          Object.entries(grouped).map(([month, entries]) => (
            <div key={month} className="space-y-2">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">
                {month}
              </p>

              {entries.map((entry) => {
                const open = expanded === entry.id;
                return (
                  <div
                    key={entry.id}
                    className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm"
                  >
                    {/* Collapsed header */}
                    <button
                      onClick={() => setExpanded(open ? null : entry.id)}
                      className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-slate-50 transition-colors text-left"
                    >
                      {/* Date pill */}
                      <div className="h-10 w-10 rounded-xl bg-amber-50 border border-amber-100 flex flex-col items-center justify-center shrink-0">
                        <p className="text-sm font-black text-amber-600 leading-none">
                          {new Date(
                            entry.diary_date.includes("T")
                              ? entry.diary_date
                              : entry.diary_date + "T00:00:00",
                          ).getDate()}
                        </p>
                        <p className="text-[8px] font-bold text-amber-400 uppercase tracking-wide">
                          {new Date(
                            entry.diary_date.includes("T")
                              ? entry.diary_date
                              : entry.diary_date + "T00:00:00",
                          ).toLocaleDateString("en-KE", { month: "short" })}
                        </p>
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <p className="text-sm font-bold text-slate-800 truncate">
                            {entry.title}
                          </p>
                          {entry.subject_name && (
                            <span
                              className={`shrink-0 text-[9px] font-black px-2 py-0.5 rounded-md border ${subjectColor(entry.subject_name)}`}
                            >
                              {entry.subject_name}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-400 truncate">
                          {entry.body}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {entry.homework && (
                          <span className="text-[9px] font-black bg-rose-50 text-rose-500 border border-rose-100 px-2 py-0.5 rounded-md">
                            HW
                          </span>
                        )}
                        <ChevronRight
                          className={`h-4 w-4 text-slate-300 transition-transform ${open ? "rotate-90" : ""}`}
                        />
                      </div>
                    </button>

                    {/* Expanded body */}
                    {open && (
                      <div className="border-t border-slate-100 px-4 pb-4 pt-3 space-y-3">
                        <p className="text-sm text-slate-600 leading-relaxed">
                          {entry.body}
                        </p>

                        {entry.homework && (
                          <div className="bg-rose-50 border border-rose-100 rounded-xl p-3.5 space-y-1.5">
                            <p className="text-[10px] font-black uppercase tracking-wider text-rose-500">
                              📚 Homework
                            </p>
                            <p className="text-sm text-rose-800 leading-relaxed">
                              {entry.homework}
                            </p>
                            {entry.due_date && (
                              <p className="text-xs text-rose-400 font-semibold flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                Due {formatDate(entry.due_date)}
                              </p>
                            )}
                          </div>
                        )}

                        <div className="flex items-center gap-1.5 text-xs text-slate-400">
                          <User className="h-3 w-3" />
                          <span>{entry.author_name}</span>
                          <span className="text-slate-300">·</span>
                          <span>{formatDate(entry.diary_date)}</span>
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
