"use client";

import { useState } from "react";
import {
  CalendarDays,
  MapPin,
  Clock,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import type { SchoolEvent, EventCategory } from "@/lib/types/governance";

// Category → light mode colour pairs
const CATEGORY: Record<
  EventCategory,
  { label: string; dot: string; text: string; bg: string; border: string }
> = {
  academic: {
    label: "Academic",
    dot: "bg-blue-500",
    text: "text-blue-700",
    bg: "bg-blue-100",
    border: "border-blue-200",
  },
  sports: {
    label: "Sports",
    dot: "bg-emerald-500",
    text: "text-emerald-700",
    bg: "bg-emerald-100",
    border: "border-emerald-200",
  },
  cultural: {
    label: "Cultural",
    dot: "bg-purple-500",
    text: "text-purple-700",
    bg: "bg-purple-100",
    border: "border-purple-200",
  },
  holiday: {
    label: "Holiday",
    dot: "bg-amber-500",
    text: "text-amber-700",
    bg: "bg-amber-100",
    border: "border-amber-200",
  },
  meeting: {
    label: "Meeting",
    dot: "bg-red-500",
    text: "text-red-700",
    bg: "bg-red-100",
    border: "border-red-200",
  },
  other: {
    label: "Other",
    dot: "bg-slate-400",
    text: "text-slate-600",
    bg: "bg-slate-100",
    border: "border-slate-200",
  },
};

const FULL_MONTHS = [
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
const SHORT_DAYS = ["M", "T", "W", "T", "F", "S", "S"];

interface Props {
  events: SchoolEvent[];
  childGrade: string;
}

export function SchoolCalendarView({ events, childGrade }: Props) {
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());

  const visible = events.filter((e) => {
    if (!e.is_public) return false;
    if (
      e.target_grades &&
      e.target_grades.length > 0 &&
      !e.target_grades.includes(childGrade)
    )
      return false;
    return true;
  });

  const cutoff = new Date(today);
  cutoff.setDate(cutoff.getDate() + 90);
  const upcoming = visible
    .filter((e) => {
      const d = new Date(e.start_date + "T00:00:00");
      return d >= today && d <= cutoff;
    })
    .sort((a, b) => a.start_date.localeCompare(b.start_date))
    .slice(0, 12);

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const startOffset = (new Date(viewYear, viewMonth, 1).getDay() + 6) % 7;
  const eventDates = new Set(
    visible
      .filter((e) => {
        const d = new Date(e.start_date + "T00:00:00");
        return d.getFullYear() === viewYear && d.getMonth() === viewMonth;
      })
      .map((e) => new Date(e.start_date + "T00:00:00").getDate()),
  );

  const prevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else setViewMonth((m) => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else setViewMonth((m) => m + 1);
  };

  return (
    <div className="space-y-4">
      {/* ── Mini calendar ─────────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50">
          <button
            onClick={prevMonth}
            className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:border-blue-300 hover:text-blue-600 hover:bg-blue-50 active:scale-90"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <p className="text-sm font-black text-slate-800">
            {FULL_MONTHS[viewMonth]} {viewYear}
          </p>
          <button
            onClick={nextMonth}
            className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:border-blue-300 hover:text-blue-600 hover:bg-blue-50 active:scale-90"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        <div className="p-3">
          {/* Day headers */}
          <div className="grid grid-cols-7 mb-1">
            {SHORT_DAYS.map((d, i) => (
              <div
                key={`${d}${i}`}
                className="text-center text-[10px] font-black uppercase tracking-wider text-slate-400 py-1"
              >
                {d}
              </div>
            ))}
          </div>
          {/* Day cells */}
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: startOffset }).map((_, i) => (
              <div key={`e${i}`} />
            ))}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const ds = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
              const isToday = ds === today.toISOString().slice(0, 10);
              const hasEvent = eventDates.has(day);
              const isWeek = (startOffset + i) % 7 >= 5;
              return (
                <div
                  key={day}
                  className={[
                    "relative flex flex-col items-center justify-center rounded-lg aspect-square text-xs font-semibold transition-all",
                    isToday
                      ? "bg-blue-600 text-white font-black ring-2 ring-blue-300 ring-offset-1"
                      : "",
                    !isToday && hasEvent
                      ? "bg-amber-50 text-amber-700 font-bold"
                      : "",
                    !isToday && !hasEvent && isWeek
                      ? "bg-slate-50 text-slate-300"
                      : "",
                    !isToday && !hasEvent && !isWeek
                      ? "text-slate-600 hover:bg-slate-50"
                      : "",
                  ].join(" ")}
                >
                  {day}
                  {hasEvent && !isToday && (
                    <span className="absolute bottom-1 w-1 h-1 rounded-full bg-amber-500" />
                  )}
                </div>
              );
            })}
          </div>
          {/* Legend */}
          <div className="flex flex-wrap gap-3 mt-3 pt-3 border-t border-slate-100">
            {(
              Object.entries(CATEGORY) as [
                EventCategory,
                (typeof CATEGORY)[EventCategory],
              ][]
            )
              .filter(([cat]) => visible.some((e) => e.category === cat))
              .map(([cat, s]) => (
                <span
                  key={cat}
                  className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-500"
                >
                  <span className={`w-2 h-2 rounded-full ${s.dot}`} />
                  {s.label}
                </span>
              ))}
          </div>
        </div>
      </div>

      {/* ── Upcoming list ─────────────────────────────────────────────────── */}
      <div>
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">
          Next 90 days · {upcoming.length} event
          {upcoming.length !== 1 ? "s" : ""}
        </p>
        {upcoming.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 py-10 text-center">
            <CalendarDays className="h-8 w-8 text-slate-300 mb-3" />
            <p className="font-bold text-slate-500">
              No events in the next 90 days
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {upcoming.map((event) => {
              const cat = CATEGORY[event.category];
              const startDate = new Date(event.start_date + "T00:00:00");
              const isToday_ =
                event.start_date === today.toISOString().slice(0, 10);
              const isMultiDay =
                event.end_date && event.end_date !== event.start_date;
              return (
                <div
                  key={event.id}
                  className={`flex items-start gap-3 rounded-2xl border px-4 py-3.5 shadow-sm transition-colors ${
                    isToday_
                      ? "border-blue-200 bg-blue-50"
                      : "border-slate-200 bg-white hover:border-slate-300"
                  }`}
                >
                  {/* Date block */}
                  <div
                    className={[
                      "flex-shrink-0 flex flex-col items-center justify-center rounded-xl w-12 h-12 border",
                      isToday_
                        ? "border-blue-300 bg-blue-600 text-white"
                        : "border-slate-200 bg-slate-50 text-slate-700",
                    ].join(" ")}
                  >
                    <p
                      className={`text-[9px] uppercase tracking-widest leading-none ${isToday_ ? "text-blue-200" : "text-slate-400"}`}
                    >
                      {startDate.toLocaleDateString("en-KE", {
                        month: "short",
                      })}
                    </p>
                    <p className="text-xl font-black leading-none tabular-nums mt-0.5">
                      {startDate.getDate()}
                    </p>
                  </div>
                  {/* Details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${cat.bg} ${cat.border} ${cat.text}`}
                      >
                        {cat.label}
                      </span>
                      {isToday_ && (
                        <span className="text-[10px] font-black text-blue-600">
                          Today!
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-black text-slate-800 leading-snug">
                      {event.title}
                    </p>
                    <div className="flex flex-wrap items-center gap-3 mt-1">
                      {(event.start_time || isMultiDay) && (
                        <span className="flex items-center gap-1 text-[11px] font-semibold text-slate-400">
                          <Clock className="h-3 w-3" />
                          {isMultiDay
                            ? `${startDate.toLocaleDateString("en-KE", { day: "numeric", month: "short" })} – ${new Date(event.end_date! + "T00:00:00").toLocaleDateString("en-KE", { day: "numeric", month: "short" })}`
                            : event.start_time?.slice(0, 5) +
                              (event.end_time
                                ? ` – ${event.end_time.slice(0, 5)}`
                                : "")}
                        </span>
                      )}
                      {event.location && (
                        <span className="flex items-center gap-1 text-[11px] font-semibold text-slate-400">
                          <MapPin className="h-3 w-3" />
                          {event.location}
                        </span>
                      )}
                    </div>
                    {event.description && (
                      <p className="text-xs text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                        {event.description}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
