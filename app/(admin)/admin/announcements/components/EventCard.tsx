// components/EventCard.tsx — single event card, no state, no actions

import { fmt, fmtShort, daysUntil, urgencyBadge } from "../utils";
import type { SchoolEvent } from "../types";
import { Trash2, Users } from "lucide-react";

interface Props {
  event: SchoolEvent;
  onDelete: () => void;
  isPending: boolean;
}

export function EventCard({ event, onDelete, isPending }: Props) {
  const days = daysUntil(event.start_date);
  const badge = urgencyBadge(days);
  const isMultiDay = event.end_date && event.end_date !== event.start_date;
  const startDay = new Date(event.start_date + "T00:00:00");

  return (
    <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4 flex gap-4 hover:bg-white/[0.04] transition-all">
      {/* Date block */}
      <div className="h-14 w-12 rounded-xl bg-amber-400/10 border border-amber-400/20 flex flex-col items-center justify-center shrink-0">
        <p className="text-lg font-black text-amber-400 leading-none">
          {startDay.getDate()}
        </p>
        <p className="text-[9px] text-amber-400/60 font-bold uppercase tracking-wide">
          {startDay.toLocaleDateString("en-KE", { month: "short" })}
        </p>
        <p className="text-[8px] text-amber-400/40 font-bold">
          {startDay.getFullYear()}
        </p>
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-bold text-white">{event.title}</p>

          <div className="flex items-center gap-1.5 shrink-0">
            {badge && (
              <span className={`text-[9px] font-black border px-2 py-0.5 rounded-lg ${badge.cls}`}>
                {badge.label}
              </span>
            )}
            {event.target_grade && (
              <span className="text-[9px] text-white/35 border border-white/[0.07] px-2 py-0.5 rounded-lg">
                {event.target_grade}
              </span>
            )}
            <button
              onClick={onDelete}
              disabled={isPending}
              aria-label="Delete event"
              className="text-white/20 hover:text-rose-400 transition-colors ml-0.5 disabled:opacity-40"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {event.description && (
          <p className="text-xs text-white/40 mt-1 leading-relaxed line-clamp-2">
            {event.description}
          </p>
        )}

        <div className="flex items-center gap-3 mt-2">
          <p className="text-[10px] text-white/25">
            {isMultiDay
              ? `${fmtShort(event.start_date)} – ${fmtShort(event.end_date!)}`
              : fmtShort(event.start_date)}
          </p>
          <span className="text-[10px] text-white/25 capitalize flex items-center gap-1">
            <Users className="h-2.5 w-2.5" />
            {event.audience === "all" ? "Everyone" : event.audience}
          </span>
        </div>
      </div>
    </div>
  );
}