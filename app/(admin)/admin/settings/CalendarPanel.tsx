"use client";

// app/(admin)/settings/_components/CalendarPanel.tsx

import { useState, useTransition } from "react";
import { CalendarDays, AlertCircle, Loader2 } from "lucide-react";
import { updateSchoolSettings, type SchoolSettings } from "@/lib/actions/settings";
import { SectionHeading, DateField } from "./UI";

interface CalendarPanelProps {
  settings: SchoolSettings;
}

export function CalendarPanel({ settings }: CalendarPanelProps) {
  const [isPending, startTransition] = useTransition();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // 1. Track selected term locally so input defaults shift responsively on click
  const [selectedTerm, setSelectedTerm] = useState<1 | 2 | 3>(
    (settings.current_term as 1 | 2 | 3) || 1
  );

  // 2. Compute dynamic default dates based on the active state view index
  const getActiveDates = () => {
    switch (selectedTerm) {
      case 1:
        return {
          start: settings.term1_start ?? "",
          end: settings.term1_end ?? "",
        };
      case 2:
        return {
          start: settings.term2_start ?? "",
          end: settings.term2_end ?? "",
        };
      case 3:
        return {
          start: settings.term3_start ?? "",
          end: settings.term3_end ?? "",
        };
      default:
        return { start: "", end: "" };
    }
  };

  const activeDates = getActiveDates();

  // 3. Client form submission routing
  const handleSubmit = async (formData: FormData) => {
    setErrorMessage(null);
    setSuccessMessage(null);

    startTransition(async () => {
      const result = await updateSchoolSettings(formData);
      if (!result.success) {
        setErrorMessage(result.message);
      } else {
        setSuccessMessage("Academic milestones saved and synchronized successfully.");
      }
    });
  };

  return (
    <form action={handleSubmit} className="space-y-5">
      {/* Structural security injection identifier path */}
      <input type="hidden" name="__form_type" value="calendar" />

      {/* Active term / year */}
      <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6">
        <SectionHeading
          icon={<CalendarDays className="h-4 w-4" />}
          title="Current Period"
        />
        <p className="text-xs text-white/35 mt-0.5 mb-5">
          This is used as the default across analytics, fees, reports, and administrative pipelines.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p className="block text-[10px] font-bold uppercase tracking-wider text-white/40 mb-2">
              Current Active Term
            </p>
            <div className="flex gap-2">
              {([1, 2, 3] as const).map((t) => (
                <label key={t} className="flex-1 cursor-pointer">
                  <input
                    type="radio"
                    name="current_term"
                    value={String(t)}
                    checked={selectedTerm === t}
                    onChange={() => {
                      setSelectedTerm(t);
                      setSuccessMessage(null);
                    }}
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
            These dates apply to the <strong>Term {selectedTerm}</strong> configuration schema. 
            Toggling the term values above lets you prepare operational metrics for other terms ahead of time.
          </p>
        </div>

        {/* Key values are bound to state vectors to dynamically re-render on selection modifications */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <DateField
            key={`start-term-${selectedTerm}`}
            label="Active Term Opening Date"
            name="term_start_date"
            defaultValue={activeDates.start}
          />
          <DateField
            key={`end-term-${selectedTerm}`}
            label="Active Term Closing Date"
            name="term_end_date"
            defaultValue={activeDates.end}
          />
        </div>

        <p className="text-xs text-white/25">
          Used in attendance reports, parent notifications, and the school calendar calculations.
        </p>
      </div>

      {/* Operation State Response Feedback Banners */}
      {errorMessage && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/15 p-3 text-xs font-medium text-red-400">
          {errorMessage}
        </div>
      )}

      {successMessage && (
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/15 p-3 text-xs font-medium text-emerald-400">
          {successMessage}
        </div>
      )}

      {/* Save Trigger Container */}
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={isPending}
          className="flex items-center gap-2 rounded-xl bg-amber-400 px-4 py-2 text-xs font-bold text-[#0c0f1a] transition-all hover:bg-amber-300 disabled:opacity-50"
        >
          {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {isPending ? "Synchronizing..." : "Save Calendar Settings"}
        </button>
      </div>
    </form>
  );
}