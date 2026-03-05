"use client";
// components/governance/CalendarPanel.tsx
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import {
  CalendarDays,
  Plus,
  X,
  Trash2,
  Loader2,
  MapPin,
  Clock,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
} from "lucide-react";
import { createEventAction, deleteEventAction } from "@/lib/actions/governance";
import type { SchoolEvent, EventCategory } from "@/lib/types/governance";

const CATEGORY_STYLE: Record<EventCategory, { text: string; dot: string }> = {
  academic: { text: "text-blue-400", dot: "bg-blue-400" },
  sports: { text: "text-emerald-400", dot: "bg-emerald-400" },
  cultural: { text: "text-purple-400", dot: "bg-purple-400" },
  holiday: { text: "text-amber-400", dot: "bg-amber-400" },
  meeting: { text: "text-sky-400", dot: "bg-sky-400" },
  other: { text: "text-white/50", dot: "bg-white/30" },
};

const MONTHS = [
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
const SHORT_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const field =
  "w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-white placeholder-white/25 outline-none transition focus:border-sky-400/50 focus:ring-2 focus:ring-sky-400/20 disabled:opacity-50";
const selCls = `${field} appearance-none cursor-pointer`;

const schema = z.object({
  title: z.string().min(2, "Title required").max(200),
  description: z.string().max(2000).optional(),
  category: z.enum([
    "academic",
    "sports",
    "cultural",
    "holiday",
    "meeting",
    "other",
  ]),
  start_date: z.string().min(1, "Start date required"),
  end_date: z.string().optional(),
  start_time: z.string().optional(),
  end_time: z.string().optional(),
  location: z.string().max(200).optional(),
  is_public: z.boolean(),
});
type FormValues = z.infer<typeof schema>;

interface Props {
  events: SchoolEvent[];
}

export function CalendarPanel({ events }: Props) {
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [showForm, setShowForm] = useState(false);
  const [isPending, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { category: "academic", is_public: true },
  });

  const firstDay = new Date(viewYear, viewMonth, 1);
  const startOffset = (firstDay.getDay() + 6) % 7;
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

  const byDate: Record<string, SchoolEvent[]> = {};
  for (const ev of events) {
    if (!byDate[ev.start_date]) byDate[ev.start_date] = [];
    byDate[ev.start_date]!.push(ev);
  }

  const prevMonth = () =>
    viewMonth === 0
      ? (setViewYear((y) => y - 1), setViewMonth(11))
      : setViewMonth((m) => m - 1);
  const nextMonth = () =>
    viewMonth === 11
      ? (setViewYear((y) => y + 1), setViewMonth(0))
      : setViewMonth((m) => m + 1);

  const cutoff = new Date(today);
  cutoff.setDate(cutoff.getDate() + 90);
  const upcoming = events
    .filter((e) => {
      const d = new Date(e.start_date + "T00:00:00");
      return d >= today && d <= cutoff;
    })
    .slice(0, 12);

  const onSubmit = (values: FormValues) => {
    startTransition(async () => {
      const fd = new FormData();
      Object.entries(values).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== "") fd.append(k, String(v));
      });
      const res = await createEventAction(fd);
      if (res.success) {
        toast.success("Event added", { icon: "📅" });
        reset();
        setShowForm(false);
      } else toast.error("Failed", { description: res.message });
    });
  };

  const handleDelete = (id: string) => {
    if (!confirm("Remove this event from the calendar?")) return;
    startTransition(async () => {
      const res = await deleteEventAction(id);
      res.success ? toast.success("Event removed") : toast.error(res.message);
    });
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-sm text-white/40">
          {events.length} event{events.length !== 1 ? "s" : ""} on calendar
        </p>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-2 rounded-xl bg-sky-500 hover:bg-sky-400 active:scale-95 px-4 py-2 text-xs font-bold text-white transition-all"
        >
          {showForm ? (
            <>
              <X className="h-3.5 w-3.5" />
              Cancel
            </>
          ) : (
            <>
              <Plus className="h-3.5 w-3.5" />
              Add Event
            </>
          )}
        </button>
      </div>

      {showForm && (
        <div className="rounded-2xl border border-sky-400/20 bg-sky-400/[0.04] p-6">
          <p className="text-xs font-semibold uppercase tracking-widest text-sky-400/70 flex items-center gap-2 mb-4">
            <CalendarDays className="h-3.5 w-3.5" />
            New Calendar Event
          </p>
          <form
            onSubmit={handleSubmit(onSubmit)}
            noValidate
            className="space-y-4"
          >
            <div>
              <input
                placeholder="Event title *"
                className={field}
                disabled={isPending}
                {...register("title")}
              />
              {errors.title && (
                <p className="mt-1 text-xs text-rose-400">
                  {errors.title.message}
                </p>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="relative">
                <select
                  className={selCls}
                  disabled={isPending}
                  {...register("category")}
                >
                  <option value="academic">📚 Academic</option>
                  <option value="sports">⚽ Sports</option>
                  <option value="cultural">🎭 Cultural</option>
                  <option value="holiday">🌴 Holiday</option>
                  <option value="meeting">👥 Meeting</option>
                  <option value="other">📌 Other</option>
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
              </div>
              <input
                placeholder="Location (optional)"
                className={field}
                disabled={isPending}
                {...register("location")}
              />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <label className="text-[10px] uppercase tracking-widest text-white/35 block mb-1">
                  Start date *
                </label>
                <input
                  type="date"
                  className={`${field} [color-scheme:dark]`}
                  disabled={isPending}
                  {...register("start_date")}
                />
                {errors.start_date && (
                  <p className="mt-1 text-xs text-rose-400">
                    {errors.start_date.message}
                  </p>
                )}
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-widest text-white/35 block mb-1">
                  End date
                </label>
                <input
                  type="date"
                  className={`${field} [color-scheme:dark]`}
                  disabled={isPending}
                  {...register("end_date")}
                />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-widest text-white/35 block mb-1">
                  Start time
                </label>
                <input
                  type="time"
                  className={`${field} [color-scheme:dark]`}
                  disabled={isPending}
                  {...register("start_time")}
                />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-widest text-white/35 block mb-1">
                  End time
                </label>
                <input
                  type="time"
                  className={`${field} [color-scheme:dark]`}
                  disabled={isPending}
                  {...register("end_time")}
                />
              </div>
            </div>
            <textarea
              rows={2}
              placeholder="Description (optional)"
              className={`${field} resize-none`}
              disabled={isPending}
              {...register("description")}
            />
            <div className="flex items-center justify-between flex-wrap gap-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  className="rounded accent-sky-400"
                  disabled={isPending}
                  {...register("is_public")}
                />
                <span className="text-sm text-white/60">
                  Visible to parents
                </span>
              </label>
              <button
                type="submit"
                disabled={isPending}
                className="flex items-center gap-2 rounded-xl bg-sky-500 hover:bg-sky-400 disabled:opacity-50 px-5 py-2.5 text-sm font-bold text-white transition-all"
              >
                {isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CalendarDays className="h-4 w-4" />
                )}
                Save Event
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        {/* Mini calendar */}
        <div className="lg:col-span-3 rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5">
          <div className="flex items-center justify-between mb-4">
            <button
              aria-label="previous month"
              onClick={prevMonth}
              className="p-1.5 rounded-lg hover:bg-white/10 text-white/40 hover:text-white transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <p className="font-semibold text-white text-sm">
              {MONTHS[viewMonth]} {viewYear}
            </p>
            <button
              aria-label="next month"
              onClick={nextMonth}
              className="p-1.5 rounded-lg hover:bg-white/10 text-white/40 hover:text-white transition-colors"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <div className="grid grid-cols-7 mb-1">
            {SHORT_DAYS.map((d) => (
              <div
                key={d}
                className="text-center text-[10px] font-semibold uppercase tracking-wider text-white/25 py-1"
              >
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-0.5">
            {Array.from({ length: startOffset }).map((_, i) => (
              <div key={`e${i}`} />
            ))}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const d = i + 1;
              const ds = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
              const dayEvents = byDate[ds] ?? [];
              const isToday =
                d === today.getDate() &&
                viewMonth === today.getMonth() &&
                viewYear === today.getFullYear();
              return (
                <div
                  key={d}
                  className={`relative rounded-lg p-1 min-h-[42px] flex flex-col items-center transition-colors ${
                    isToday
                      ? "bg-amber-400/15 ring-1 ring-amber-400/40"
                      : dayEvents.length
                        ? "bg-white/[0.04]"
                        : "hover:bg-white/[0.02]"
                  }`}
                >
                  <span
                    className={`text-xs font-medium ${isToday ? "text-amber-400 font-bold" : "text-white/55"}`}
                  >
                    {d}
                  </span>
                  <div className="flex gap-0.5 mt-0.5 flex-wrap justify-center">
                    {dayEvents.slice(0, 3).map((ev) => (
                      <span
                        key={ev.id}
                        className={`w-1.5 h-1.5 rounded-full ${CATEGORY_STYLE[ev.category].dot}`}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-4 pt-4 border-t border-white/[0.06]">
            {(
              Object.entries(CATEGORY_STYLE) as [
                EventCategory,
                (typeof CATEGORY_STYLE)[EventCategory],
              ][]
            ).map(([cat, s]) => (
              <span
                key={cat}
                className="flex items-center gap-1.5 text-[10px] text-white/35"
              >
                <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
                {cat.charAt(0).toUpperCase() + cat.slice(1)}
              </span>
            ))}
          </div>
        </div>

        {/* Upcoming */}
        <div className="lg:col-span-2">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-white/30 mb-3">
            Next 90 days
          </p>
          {upcoming.length === 0 ? (
            <div className="rounded-xl border border-dashed border-white/10 py-10 text-center">
              <p className="text-sm text-white/30">No upcoming events</p>
            </div>
          ) : (
            <div className="space-y-2">
              {upcoming.map((ev) => {
                const s = CATEGORY_STYLE[ev.category];
                return (
                  <div
                    key={ev.id}
                    className="group rounded-xl border border-white/[0.07] bg-white/[0.02] hover:bg-white/[0.04] px-4 py-3 transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      <span
                        className={`mt-1 flex-shrink-0 w-2 h-2 rounded-full ${s.dot}`}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white truncate">
                          {ev.title}
                        </p>
                        <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-[10px] text-white/30">
                          <span className="flex items-center gap-1">
                            <CalendarDays className="h-3 w-3" />
                            {new Date(
                              ev.start_date + "T00:00:00",
                            ).toLocaleDateString("en-KE", {
                              day: "numeric",
                              month: "short",
                            })}
                          </span>
                          {ev.start_time && (
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {ev.start_time.slice(0, 5)}
                            </span>
                          )}
                          {ev.location && (
                            <span className="flex items-center gap-1 truncate">
                              <MapPin className="h-3 w-3 flex-shrink-0" />
                              {ev.location}
                            </span>
                          )}
                        </div>
                      </div>
                      <button
                        aria-label={`delete ${ev.title}`}
                        onClick={() => handleDelete(ev.id)}
                        disabled={isPending}
                        className="opacity-0 group-hover:opacity-100 p-1 rounded-lg hover:bg-rose-500/20 text-rose-400 transition-all flex-shrink-0"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
