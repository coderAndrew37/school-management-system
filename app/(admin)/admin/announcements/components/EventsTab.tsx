"use client";

// components/EventsTab.tsx
// Renders the full Events tab: add-event form + upcoming + past event lists.

import { Loader2, Plus, Trash2 } from "lucide-react";
import { GRADES, INP, LBL, SEL } from "../constants";
import type { EventFormState } from "../hooks/useEventForm";
import type { SchoolEvent } from "../types";
import { fmt } from "../utils";
import { EventCard } from "./EventCard";
import { Empty, SectionDivider } from "./ui";

interface Props {
  // Form
  form: EventFormState;
  setField: <K extends keyof EventFormState>(
    key: K,
    value: EventFormState[K],
  ) => void;
  canSubmit: boolean;
  isPending: boolean;
  onSubmit: () => void;
  // Lists
  upcoming: SchoolEvent[];
  past: SchoolEvent[];
  onDeleteRequest: (id: string) => void;
}

export function EventsTab({
  form,
  setField,
  canSubmit,
  isPending,
  onSubmit,
  upcoming,
  past,
  onDeleteRequest,
}: Props) {
  return (
    <>
      {/* ── Add event form ───────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-6 space-y-5">
        <div>
          <p className="text-sm font-bold text-white">Add to School Calendar</p>
          <p className="text-[11px] text-white/35 mt-0.5">
            Term dates, exams, sports days, trips — parents see these on their
            events calendar.
          </p>
        </div>

        <div>
          <label className={LBL}>Event Title</label>
          <input
            type="text"
            value={form.title}
            onChange={(e) => setField("title", e.target.value)}
            placeholder="e.g. End of Term 1 Exams, Sports Day, Prize Giving"
            maxLength={120}
            className={INP}
          />
        </div>

        <div>
          <label className={LBL}>Description (optional)</label>
          <textarea
            value={form.description}
            onChange={(e) => setField("description", e.target.value)}
            rows={2}
            maxLength={500}
            className={`${INP} resize-none`}
            placeholder="Additional details parents should know…"
          />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div>
            <label className={LBL}>Start Date</label>
            <input
              type="date"
              value={form.startDate}
              onChange={(e) => setField("startDate", e.target.value)}
              className={`${INP} [color-scheme:dark]`}
              aria-label="start date"
            />
          </div>
          <div>
            <label className={LBL}>End Date (opt)</label>
            <input
              type="date"
              value={form.endDate}
              onChange={(e) => setField("endDate", e.target.value)}
              min={form.startDate}
              className={`${INP} [color-scheme:dark]`}
              aria-label="end date"
            />
          </div>
          <div>
            <label className={LBL}>Audience</label>
            <select
              value={form.audience}
              onChange={(e) =>
                setField("audience", e.target.value as EventFormState["audience"])
              }
              className={SEL}
              aria-label="audience"
            >
              <option value="all" className="bg-[#0c0f1a]">Everyone</option>
              <option value="parents" className="bg-[#0c0f1a]">Parents</option>
              <option value="teachers" className="bg-[#0c0f1a]">Teachers</option>
            </select>
          </div>
          <div>
            <label className={LBL}>Grade (opt)</label>
            <select
              value={form.grade}
              onChange={(e) => setField("grade", e.target.value)}
              className={SEL}
              aria-label="grade"
            >
              {GRADES.map((g) => (
                <option key={g} value={g} className="bg-[#0c0f1a]">{g}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            onClick={onSubmit}
            disabled={isPending || !canSubmit}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-[#0c0f1a] text-sm font-bold disabled:opacity-50 transition-all shadow-lg shadow-amber-400/20"
          >
            {isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            Add to Calendar
          </button>
        </div>
      </div>

      {/* ── Upcoming ─────────────────────────────────────────────────────── */}
      {upcoming.length > 0 ? (
        <div className="space-y-3">
          <SectionDivider label={`Upcoming · ${upcoming.length}`} />
          {upcoming.map((e) => (
            <EventCard
              key={e.id}
              event={e}
              onDelete={() => onDeleteRequest(e.id)}
              isPending={isPending}
            />
          ))}
        </div>
      ) : (
        <Empty
          emoji="📅"
          title="No upcoming events"
          sub="Add term dates, exams, sports days and trips — parents see these on their school calendar."
        />
      )}

      {/* ── Past events ──────────────────────────────────────────────────── */}
      {past.length > 0 && (
        <div className="space-y-2">
          <SectionDivider label={`Past Events · ${past.length}`} />
          {past.map((e) => {
            const d = new Date(e.start_date + "T00:00:00");
            return (
              <div
                key={e.id}
                className="flex items-center gap-3 rounded-xl border border-white/[0.05] bg-white/[0.02] px-4 py-3"
              >
                <div className="h-9 w-9 rounded-lg bg-white/[0.04] border border-white/[0.07] flex flex-col items-center justify-center shrink-0">
                  <p className="text-xs font-black text-white/35 leading-none">
                    {d.getDate()}
                  </p>
                  <p className="text-[8px] text-white/20 font-bold">
                    {d.toLocaleDateString("en-KE", { month: "short" })}
                  </p>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-white/35 truncate">
                    {e.title}
                  </p>
                  <p className="text-[10px] text-white/20 mt-0.5">
                    {fmt(e.start_date)}
                  </p>
                </div>
                <button
                  onClick={() => onDeleteRequest(e.id)}
                  aria-label="Delete past event"
                  className="text-white/15 hover:text-rose-400 transition-colors shrink-0"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}