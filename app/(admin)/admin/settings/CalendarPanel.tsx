"use client";

// app/(admin)/settings/_components/CalendarPanel.tsx

import { CalendarDays, AlertCircle } from "lucide-react";
import type { SchoolSettings } from "@/lib/actions/settings";
import { SectionHeading, DateField } from "./UI";

interface CalendarPanelProps {
  settings: SchoolSettings;
}

export function CalendarPanel({ settings }: CalendarPanelProps) {
  const termLabel =
    settings.current_term === 1
      ? "Term 1"
      : settings.current_term === 2
        ? "Term 2"
        : "Term 3";

  return (
    <div className="space-y-5">
      {/* Active term / year */}
      <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6">
        <SectionHeading
          icon={<CalendarDays className="h-4 w-4" />}
          title="Current Period"
        />
        <p className="text-xs text-white/35 mt-0.5 mb-5">
          This is used as the default across analytics, fees, reports, and
          heatmap pages.
        </p>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="block text-[10px] font-bold uppercase tracking-wider text-white/40 mb-2">
              Current Term
            </p>
            <div className="flex gap-2">
              {([1, 2, 3] as const).map((t) => (
                <label key={t} className="flex-1 cursor-pointer">
                  <input
                    type="radio"
                    name="current_term"
                    value={String(t)}
                    defaultChecked={settings.current_term === t}
                    className="peer sr-only"
                  />
                  <div className="rounded-xl border border-white/10 py-2 text-center text-xs font-bold text-white/40 transition-all peer-checked:bg-amber-400/15 peer-checked:border-amber-400/40 peer-checked:text-amber-400">
                    Term {t}
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label
              htmlFor="current_academic_year"
              className="block text-[10px] font-bold uppercase tracking-wider text-white/40 mb-2"
            >
              Academic Year
            </label>
            <select
              id="current_academic_year"
              name="current_academic_year"
              defaultValue={String(settings.current_academic_year)}
              className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white outline-none focus:border-amber-400/50 transition-colors"
            >
              {[2024, 2025, 2026, 2027, 2028].map((y) => (
                <option key={y} value={String(y)} className="bg-[#0c0f1a]">
                  {y}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Active term milestone dates */}
      <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6 space-y-5">
        <SectionHeading
          icon={<CalendarDays className="h-4 w-4" />}
          title="Term Milestone Dates"
        />

        {/* Context badge */}
        <div className="flex items-start gap-2.5 rounded-xl border border-amber-400/15 bg-amber-400/[0.04] px-3.5 py-3">
          <AlertCircle className="h-3.5 w-3.5 text-amber-400/60 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-400/70">
            These dates apply to the <strong>currently active term</strong>{" "}
            ({termLabel}). Switch the term selector above before editing to
            configure a different term.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <DateField
            label="Active Term Opening Date"
            name="term_start_date"
            defaultValue={settings.term_start_date ?? ""}
          />
          <DateField
            label="Active Term Closing Date"
            name="term_end_date"
            defaultValue={settings.term_end_date ?? ""}
          />
          <DateField
            label="Next Term Reopening Date"
            name="next_term_opening_date"
            defaultValue={settings.next_term_opening_date ?? ""}
          />
        </div>

        <p className="text-xs text-white/25">
          Used in attendance reports, parent notifications, and the school
          calendar.
        </p>
      </div>
    </div>
  );
}