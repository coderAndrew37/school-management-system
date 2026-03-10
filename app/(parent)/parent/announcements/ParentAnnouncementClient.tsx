"use client";

// app/parent/announcements/_components/ParentAnnouncementsClient.tsx
// Read-only announcements + events calendar for parents.

import type { Announcement, SchoolEvent } from "@/lib/data/parent";
import {
  Megaphone,
  CalendarDays,
  AlertTriangle,
  Info,
  Bell,
  ChevronLeft,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";

interface Props {
  announcements: Announcement[];
  events: SchoolEvent[];
}

function formatDate(iso: string) {
  const d = new Date(iso + (iso.includes("T") ? "" : "T00:00:00"));
  return d.toLocaleDateString("en-KE", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatShort(iso: string) {
  const d = new Date(iso + (iso.includes("T") ? "" : "T00:00:00"));
  return d.toLocaleDateString("en-KE", { day: "numeric", month: "short" });
}

function daysFromNow(iso: string) {
  const diff =
    new Date(iso + "T00:00:00").getTime() - new Date().setHours(0, 0, 0, 0);
  const days = Math.ceil(diff / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days < 0) return null;
  return `In ${days} days`;
}

function isUpcoming(iso: string) {
  return (
    new Date(iso + "T00:00:00").getTime() >= new Date().setHours(0, 0, 0, 0)
  );
}

function MonthCalendar({
  year,
  month,
  events,
}: {
  year: number;
  month: number;
  events: SchoolEvent[];
}) {
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const startDay = first.getDay(); // 0=Sun
  const cells: (number | null)[] = Array(startDay).fill(null);
  for (let d = 1; d <= last.getDate(); d++) cells.push(d);

  // Map day → events
  const byDay = new Map<number, SchoolEvent[]>();
  for (const ev of events) {
    const evDate = new Date(ev.start_date + "T00:00:00");
    if (evDate.getFullYear() === year && evDate.getMonth() === month) {
      const d = evDate.getDate();
      if (!byDay.has(d)) byDay.set(d, []);
      byDay.get(d)!.push(ev);
    }
  }

  const DAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];

  return (
    <div>
      <div className="grid grid-cols-7 mb-1">
        {DAY_LABELS.map((l, i) => (
          <div
            key={i}
            className="text-center text-[10px] font-black text-slate-400 py-1"
          >
            {l}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-px bg-slate-100 rounded-xl overflow-hidden border border-slate-100">
        {cells.map((day, i) => {
          if (!day) return <div key={i} className="bg-white aspect-square" />;
          const evs = byDay.get(day) ?? [];
          const today = new Date();
          const isToday =
            today.getDate() === day &&
            today.getMonth() === month &&
            today.getFullYear() === year;
          return (
            <div
              key={i}
              className={`bg-white aspect-square flex flex-col items-center justify-start pt-1 relative ${evs.length > 0 ? "cursor-pointer" : ""}`}
            >
              <span
                className={`text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center ${
                  isToday
                    ? "bg-indigo-600 text-white"
                    : evs.length > 0
                      ? "text-indigo-700 bg-indigo-50"
                      : "text-slate-600"
                }`}
              >
                {day}
              </span>
              {evs.length > 0 && (
                <div className="flex gap-0.5 mt-0.5">
                  {evs.slice(0, 3).map((_, idx) => (
                    <div
                      key={idx}
                      className="h-1 w-1 rounded-full bg-indigo-400"
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function ParentAnnouncementsClient({ announcements, events }: Props) {
  const [tab, setTab] = useState<"notices" | "calendar">("notices");

  const now = new Date();
  const [calYear, setCalYear] = useState(now.getFullYear());
  const [calMonth, setCalMonth] = useState(now.getMonth());

  const activeAnn = announcements.filter(
    (a) => !a.expires_at || new Date(a.expires_at) > now,
  );
  const upcomingEvs = events.filter((e) => isUpcoming(e.start_date));
  const thisMonthEvs = events.filter((e) => {
    const d = new Date(e.start_date + "T00:00:00");
    return d.getFullYear() === calYear && d.getMonth() === calMonth;
  });

  const MONTH_NAMES = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];

  function prevMonth() {
    if (calMonth === 0) {
      setCalYear((y) => y - 1);
      setCalMonth(11);
    } else setCalMonth((m) => m - 1);
  }
  function nextMonth() {
    if (calMonth === 11) {
      setCalYear((y) => y + 1);
      setCalMonth(0);
    } else setCalMonth((m) => m + 1);
  }

  return (
    <div className="min-h-screen bg-[#f5f6fa]">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 h-14 flex items-center gap-3">
          <Bell className="h-5 w-5 text-indigo-500 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-black text-slate-800">School Updates</p>
            <p className="text-[10px] text-slate-400 font-semibold">
              Notices & Events from Kibali Academy
            </p>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 flex">
          {(
            [
              {
                key: "notices",
                label: "Notices",
                icon: Megaphone,
                count: activeAnn.length,
              },
              {
                key: "calendar",
                label: "Events",
                icon: CalendarDays,
                count: upcomingEvs.length,
              },
            ] as const
          ).map(({ key, label, icon: Icon, count }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex items-center gap-1.5 px-4 py-3 text-xs font-bold border-b-2 transition-colors ${
                tab === key
                  ? "border-indigo-600 text-indigo-700"
                  : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
              {count > 0 && (
                <span
                  className={`text-[9px] font-black px-1.5 py-0.5 rounded-full ${tab === key ? "bg-indigo-100 text-indigo-700" : "bg-slate-100 text-slate-500"}`}
                >
                  {count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-5 space-y-4">
        {/* ── NOTICES ───────────────────────────────────────────────────────── */}
        {tab === "notices" && (
          <>
            {activeAnn.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200 py-20 text-center shadow-sm">
                <p className="text-4xl mb-3">📢</p>
                <p className="text-slate-600 font-bold">No notices right now</p>
                <p className="text-slate-400 text-sm mt-1">
                  Check back soon — the school will post updates here
                </p>
              </div>
            ) : (
              activeAnn.map((a) => (
                <div
                  key={a.id}
                  className={`bg-white rounded-2xl border shadow-sm overflow-hidden ${
                    a.priority === "urgent"
                      ? "border-rose-200"
                      : "border-slate-200"
                  }`}
                >
                  {a.priority === "urgent" && (
                    <div className="bg-rose-500 px-4 py-1.5 flex items-center gap-1.5">
                      <AlertTriangle className="h-3.5 w-3.5 text-white" />
                      <span className="text-xs font-black text-white uppercase tracking-wider">
                        Urgent Notice
                      </span>
                    </div>
                  )}
                  <div className="p-4">
                    <div className="flex items-start gap-3">
                      <div
                        className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                          a.priority === "urgent"
                            ? "bg-rose-50"
                            : "bg-indigo-50"
                        }`}
                      >
                        {a.priority === "urgent" ? (
                          <AlertTriangle className="h-4 w-4 text-rose-500" />
                        ) : (
                          <Info className="h-4 w-4 text-indigo-500" />
                        )}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-black text-slate-800">
                          {a.title}
                        </p>
                        {a.target_grade && (
                          <span className="inline-block text-[9px] font-black bg-slate-100 text-slate-500 px-2 py-0.5 rounded-lg mt-0.5 mb-1">
                            {a.target_grade}
                          </span>
                        )}
                        <p className="text-sm text-slate-600 leading-relaxed mt-1">
                          {a.body}
                        </p>
                        <p className="text-[10px] text-slate-400 mt-2">
                          Posted {formatDate(a.created_at)}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </>
        )}

        {/* ── CALENDAR ──────────────────────────────────────────────────────── */}
        {tab === "calendar" && (
          <>
            {/* Month navigator */}
            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <button
                  aria-label="Previous month"
                  onClick={prevMonth}
                  className="h-8 w-8 rounded-xl border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-50 transition-colors"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <p className="text-sm font-black text-slate-800">
                  {MONTH_NAMES[calMonth]} {calYear}
                </p>
                <button
                  aria-label="Next month"
                  onClick={nextMonth}
                  className="h-8 w-8 rounded-xl border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-50 transition-colors rotate-180"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
              </div>
              <MonthCalendar year={calYear} month={calMonth} events={events} />
            </div>

            {/* This month's events */}
            {thisMonthEvs.length > 0 && (
              <div className="space-y-2">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">
                  {MONTH_NAMES[calMonth]} Events
                </p>
                {thisMonthEvs.map((e) => {
                  const badge = daysFromNow(e.start_date);
                  return (
                    <div
                      key={e.id}
                      className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm flex gap-4"
                    >
                      <div className="h-12 w-12 rounded-xl bg-indigo-50 border border-indigo-100 flex flex-col items-center justify-center shrink-0">
                        <p className="text-base font-black text-indigo-700 leading-none">
                          {new Date(e.start_date + "T00:00:00").getDate()}
                        </p>
                        <p className="text-[9px] text-indigo-400 font-bold">
                          {new Date(
                            e.start_date + "T00:00:00",
                          ).toLocaleDateString("en-KE", { month: "short" })}
                        </p>
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-black text-slate-800">
                            {e.title}
                          </p>
                          {badge && (
                            <span
                              className={`text-[9px] font-black px-2 py-0.5 rounded-lg ${
                                badge === "Today"
                                  ? "bg-rose-100 text-rose-600"
                                  : badge === "Tomorrow"
                                    ? "bg-amber-100 text-amber-600"
                                    : "bg-indigo-50 text-indigo-600"
                              }`}
                            >
                              {badge}
                            </span>
                          )}
                        </div>
                        {e.description && (
                          <p className="text-xs text-slate-500 mt-0.5">
                            {e.description}
                          </p>
                        )}
                        <p className="text-[10px] text-slate-400 mt-1">
                          {formatShort(e.start_date)}
                          {e.end_date &&
                            e.end_date !== e.start_date &&
                            ` – ${formatShort(e.end_date)}`}
                          {e.target_grade && ` · ${e.target_grade}`}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Upcoming (beyond this month) */}
            {upcomingEvs.filter((e) => {
              const d = new Date(e.start_date + "T00:00:00");
              return !(
                d.getFullYear() === calYear && d.getMonth() === calMonth
              );
            }).length > 0 && (
              <div className="space-y-2">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">
                  Coming Up
                </p>
                {upcomingEvs
                  .filter((e) => {
                    const d = new Date(e.start_date + "T00:00:00");
                    return !(
                      d.getFullYear() === calYear && d.getMonth() === calMonth
                    );
                  })
                  .slice(0, 5)
                  .map((e) => (
                    <div
                      key={e.id}
                      className="bg-white rounded-xl border border-slate-200 px-4 py-3 flex items-center gap-3 shadow-sm"
                    >
                      <CalendarDays className="h-4 w-4 text-indigo-400 shrink-0" />
                      <div className="flex-1">
                        <p className="text-xs font-bold text-slate-700">
                          {e.title}
                        </p>
                        <p className="text-[10px] text-slate-400">
                          {formatShort(e.start_date)}
                        </p>
                      </div>
                    </div>
                  ))}
              </div>
            )}

            {events.length === 0 && (
              <div className="bg-white rounded-2xl border border-slate-200 py-20 text-center shadow-sm">
                <p className="text-4xl mb-3">📅</p>
                <p className="text-slate-600 font-bold">
                  No events scheduled yet
                </p>
                <p className="text-slate-400 text-sm mt-1">
                  Term dates and school events will appear here
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
