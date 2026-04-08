import { AlertTriangle, ArrowRight, Bell, CalendarDays, Info } from "lucide-react";
import Link from "next/link";
import type { Announcement, SchoolEvent } from "@/lib/types/governance";
import { daysFromNow } from "./parent.utils";

// ── School Notices ────────────────────────────────────────────────────────────

interface NoticesProps {
  announcements: Announcement[];
}

export function SchoolNoticesStrip({ announcements }: NoticesProps) {
  if (announcements.length === 0) return null;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-lg bg-indigo-50 flex items-center justify-center">
            <Bell className="h-3.5 w-3.5 text-indigo-500" />
          </div>
          <p className="text-sm font-black text-slate-800">School Notices</p>
        </div>
        <Link
          href="/parent/announcements"
          className="text-xs font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
        >
          All <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      <div className="space-y-2">
        {announcements.map((a) => (
          <Link
            key={a.id}
            href="/parent/announcements"
            className={`block rounded-xl border p-3 hover:shadow-sm transition-all ${
              a.priority === "urgent"
                ? "bg-rose-50 border-rose-200"
                : "bg-slate-50 border-slate-100 hover:border-indigo-100"
            }`}
          >
            <div className="flex items-start gap-2">
              {a.priority === "urgent" ? (
                <AlertTriangle className="h-3.5 w-3.5 text-rose-500 shrink-0 mt-0.5" />
              ) : (
                <Info className="h-3.5 w-3.5 text-indigo-400 shrink-0 mt-0.5" />
              )}
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-800 line-clamp-1">
                  {a.title}
                </p>
                <p className="text-[10px] text-slate-500 mt-0.5 line-clamp-2">
                  {a.body}
                </p>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

// ── Upcoming Events ───────────────────────────────────────────────────────────

interface EventsProps {
  events: SchoolEvent[];
}

export function UpcomingEventsStrip({ events }: EventsProps) {
  if (events.length === 0) return null;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-lg bg-indigo-50 flex items-center justify-center">
            <CalendarDays className="h-3.5 w-3.5 text-indigo-500" />
          </div>
          <p className="text-sm font-black text-slate-800">Coming Up</p>
        </div>
        <Link
          href="/parent/announcements"
          className="text-xs font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
        >
          Calendar <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      <div className="space-y-2">
        {events.map((e) => {
          const badge = daysFromNow(e.start_date);
          return (
            <Link
              key={e.id}
              href="/parent/announcements"
              className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50 hover:border-indigo-100 p-3 transition-all hover:shadow-sm"
            >
              <div className="h-10 w-10 rounded-xl bg-indigo-50 border border-indigo-100 flex flex-col items-center justify-center shrink-0">
                <p className="text-xs font-black text-indigo-700 leading-none">
                  {new Date(e.start_date + "T00:00:00").getDate()}
                </p>
                <p className="text-[8px] text-indigo-400 font-bold">
                  {new Date(e.start_date + "T00:00:00").toLocaleDateString(
                    "en-KE",
                    { month: "short" },
                  )}
                </p>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-slate-800 line-clamp-1">
                  {e.title}
                </p>
                {e.description && (
                  <p className="text-[10px] text-slate-500 line-clamp-1 mt-0.5">
                    {e.description}
                  </p>
                )}
              </div>
              {badge && (
                <span
                  className={`text-[9px] font-black px-2 py-0.5 rounded-lg shrink-0 ${
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
            </Link>
          );
        })}
      </div>
    </div>
  );
}