"use client";

// app/admin/announcements/_components/AdminEngagementClient.tsx
// Combined admin publisher for announcements + events.

import {
  createAnnouncementAction,
  deleteAnnouncementAction,
  createEventAction,
  deleteEventAction,
  type Announcement,
  type SchoolEvent,
} from "@/lib/actions/engagement";

import {
  Megaphone,
  CalendarDays,
  Plus,
  Trash2,
  X,
  Check,
  Loader2,
  ChevronLeft,
  AlertTriangle,
  Info,
  Bell,
} from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";

const GRADES = [
  "All grades",
  "PP1",
  "PP2",
  "Grade 1",
  "Grade 2",
  "Grade 3",
  "Grade 4",
  "Grade 5",
  "Grade 6",
  "Grade 7 / JSS 1",
  "Grade 8 / JSS 2",
  "Grade 9 / JSS 3",
];

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-KE", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function isUpcoming(dateStr: string) {
  return new Date(dateStr) >= new Date(new Date().setHours(0, 0, 0, 0));
}

interface Props {
  announcements: Announcement[];
  events: SchoolEvent[];
}

const inputCls =
  "w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 bg-white text-slate-700 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-400";

export function AdminEngagementClient({ announcements, events }: Props) {
  const [tab, setTab] = useState<"announcements" | "events">("announcements");
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [isPending, startTrans] = useTransition();

  // Announcement form
  const [aTitle, setATitle] = useState("");
  const [aBody, setABody] = useState("");
  const [aPriority, setAPriority] = useState<"normal" | "urgent">("normal");
  const [aAudience, setAAudience] = useState("all");
  const [aGrade, setAGrade] = useState("");
  const [aExpires, setAExpires] = useState("");

  // Event form
  const [eTitle, setETitle] = useState("");
  const [eDesc, setEDesc] = useState("");
  const [eStart, setEStart] = useState("");
  const [eEnd, setEEnd] = useState("");
  const [eAudience, setEAudience] = useState("all");
  const [eGrade, setEGrade] = useState("");

  function showToast(msg: string, ok: boolean) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 4000);
  }

  function handleCreateAnnouncement() {
    if (!aTitle.trim() || !aBody.trim()) return;
    startTrans(async () => {
      const res = await createAnnouncementAction({
        title: aTitle,
        body: aBody,
        audience: aAudience as any,
        priority: aPriority,
        target_grade: aGrade && aGrade !== "All grades" ? aGrade : null,
        expires_at: aExpires || null,
      });
      if (res.success) {
        showToast("Announcement published", true);
        setATitle("");
        setABody("");
        setAPriority("normal");
        setAGrade("");
        setAExpires("");
      } else showToast(res.error ?? "Failed", false);
    });
  }

  function handleDeleteAnnouncement(id: string) {
    startTrans(async () => {
      const res = await deleteAnnouncementAction(id);
      if (res.success) showToast("Deleted", true);
      else showToast(res.error ?? "Failed", false);
    });
  }

  function handleCreateEvent() {
    if (!eTitle.trim() || !eStart) return;
    startTrans(async () => {
      const res = await createEventAction({
        title: eTitle,
        description: eDesc || null,
        start_date: eStart,
        end_date: eEnd || null,
        audience: eAudience as any,
        target_grade: eGrade && eGrade !== "All grades" ? eGrade : null,
      });
      if (res.success) {
        showToast("Event added", true);
        setETitle("");
        setEDesc("");
        setEStart("");
        setEEnd("");
        setEGrade("");
      } else showToast(res.error ?? "Failed", false);
    });
  }

  function handleDeleteEvent(id: string) {
    startTrans(async () => {
      const res = await deleteEventAction(id);
      if (res.success) showToast("Deleted", true);
      else showToast(res.error ?? "Failed", false);
    });
  }

  const upcomingEvents = events.filter((e) => isUpcoming(e.start_date));
  const pastEvents = events.filter((e) => !isUpcoming(e.start_date));
  const activeAnn = announcements.filter(
    (a) => !a.expires_at || new Date(a.expires_at) > new Date(),
  );
  const expiredAnn = announcements.filter(
    (a) => a.expires_at && new Date(a.expires_at) <= new Date(),
  );

  return (
    <div className="min-h-screen bg-[#f5f6fa]">
      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl text-sm font-bold shadow-lg flex items-center gap-2 ${toast.ok ? "bg-indigo-600 text-white" : "bg-rose-500 text-white"}`}
        >
          {toast.ok && <Check className="h-4 w-4" />}
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-14 flex items-center gap-3">
          <Link href="/admin" className="text-slate-400 hover:text-slate-600">
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <Bell className="h-5 w-5 text-indigo-500 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-black text-slate-800">
              School Communications
            </p>
            <p className="text-[10px] text-slate-400 font-semibold">
              Announcements & Events — visible to parents immediately
            </p>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 flex">
          {(
            [
              {
                key: "announcements",
                label: "Announcements",
                icon: Megaphone,
                count: activeAnn.length,
              },
              {
                key: "events",
                label: "Events Calendar",
                icon: CalendarDays,
                count: upcomingEvents.length,
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

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-5 space-y-5">
        {/* ── ANNOUNCEMENTS ─────────────────────────────────────────────────── */}
        {tab === "announcements" && (
          <>
            {/* Compose form */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
              <p className="text-sm font-black text-slate-800">
                New Announcement
              </p>

              <input
                type="text"
                value={aTitle}
                onChange={(e) => setATitle(e.target.value)}
                placeholder="Announcement title…"
                aria-label="Enter announcement title"
                className={inputCls}
              />

              <textarea
                value={aBody}
                onChange={(e) => setABody(e.target.value)}
                rows={4}
                placeholder="Write your announcement here. Be clear, friendly, and concise — parents read this on their phones."
                aria-label="Enter announcement body"
                className={`${inputCls} resize-none`}
              />

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1 block">
                    Priority
                  </label>
                  <select
                    aria-label={`Select priority for announcement: normal or urgent`}
                    value={aPriority}
                    onChange={(e) => setAPriority(e.target.value as any)}
                    className={inputCls}
                  >
                    <option value="normal">Normal</option>
                    <option value="urgent">🚨 Urgent</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1 block">
                    Audience
                  </label>
                  <select
                    aria-label={`Select audience for announcement: everyone, parents only, or teachers only`}
                    value={aAudience}
                    onChange={(e) => setAAudience(e.target.value)}
                    className={inputCls}
                  >
                    <option value="all">Everyone</option>
                    <option value="parents">Parents only</option>
                    <option value="teachers">Teachers only</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1 block">
                    Grade (optional)
                  </label>
                  <select
                    aria-label="Select grade for announcement"
                    value={aGrade}
                    onChange={(e) => setAGrade(e.target.value)}
                    className={inputCls}
                  >
                    {GRADES.map((g) => (
                      <option key={g} value={g}>
                        {g}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1 block">
                    Expires (optional)
                  </label>
                  <input
                    aria-label="Select expiration date for announcement"
                    type="date"
                    value={aExpires}
                    onChange={(e) => setAExpires(e.target.value)}
                    className={`${inputCls} [color-scheme:light]`}
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  onClick={handleCreateAnnouncement}
                  disabled={isPending || !aTitle.trim() || !aBody.trim()}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold transition-colors disabled:opacity-40"
                >
                  {isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Megaphone className="h-4 w-4" /> Publish Now
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Active announcements */}
            {activeAnn.length > 0 && (
              <div className="space-y-2">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">
                  Active ({activeAnn.length})
                </p>
                {activeAnn.map((a) => (
                  <div
                    key={a.id}
                    className={`bg-white rounded-2xl border shadow-sm p-4 flex gap-4 ${a.priority === "urgent" ? "border-rose-200" : "border-slate-200"}`}
                  >
                    <div
                      className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 ${a.priority === "urgent" ? "bg-rose-50" : "bg-indigo-50"}`}
                    >
                      {a.priority === "urgent" ? (
                        <AlertTriangle className="h-4 w-4 text-rose-500" />
                      ) : (
                        <Info className="h-4 w-4 text-indigo-500" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-bold text-slate-800">
                          {a.title}
                        </p>
                        <div className="flex items-center gap-2 shrink-0">
                          {a.target_grade && (
                            <span className="text-[9px] font-black bg-slate-100 text-slate-500 px-2 py-0.5 rounded-lg">
                              {a.target_grade}
                            </span>
                          )}
                          <span className="text-[9px] font-black bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-lg capitalize">
                            {a.audience}
                          </span>
                          <button
                            onClick={() => handleDeleteAnnouncement(a.id)}
                            className="text-slate-300 hover:text-rose-500 transition-colors"
                            aria-label={`Delete announcement: ${a.title}`}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                      <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                        {a.body}
                      </p>
                      <p className="text-[9px] text-slate-400 mt-1.5">
                        Published {formatDate(a.created_at)}
                        {a.expires_at &&
                          ` · Expires ${formatDate(a.expires_at)}`}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {activeAnn.length === 0 && expiredAnn.length === 0 && (
              <div className="bg-white rounded-2xl border border-slate-200 py-16 text-center shadow-sm">
                <p className="text-4xl mb-2">📢</p>
                <p className="text-slate-500 font-semibold">
                  No announcements yet
                </p>
                <p className="text-slate-400 text-sm mt-1">
                  Write one above — parents will see it immediately
                </p>
              </div>
            )}

            {expiredAnn.length > 0 && (
              <div className="space-y-2">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">
                  Expired ({expiredAnn.length})
                </p>
                {expiredAnn.map((a) => (
                  <div
                    key={a.id}
                    className="bg-slate-50 rounded-xl border border-slate-200 px-4 py-3 flex items-center gap-3 opacity-60"
                  >
                    <div className="flex-1">
                      <p className="text-xs font-bold text-slate-500">
                        {a.title}
                      </p>
                      <p className="text-[9px] text-slate-400">
                        Expired {formatDate(a.expires_at!)}
                      </p>
                    </div>
                    <button
                      onClick={() => handleDeleteAnnouncement(a.id)}
                      className="text-slate-300 hover:text-rose-500"
                      aria-label={`Delete announcement: ${a.title}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ── EVENTS ────────────────────────────────────────────────────────── */}
        {tab === "events" && (
          <>
            {/* Add event form */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
              <p className="text-sm font-black text-slate-800">
                Add Event to Calendar
              </p>

              <input
                type="text"
                value={eTitle}
                onChange={(e) => setETitle(e.target.value)}
                placeholder="Event title e.g. End of Term Exams"
                className={inputCls}
              />

              <textarea
                value={eDesc}
                onChange={(e) => setEDesc(e.target.value)}
                rows={2}
                placeholder="Optional description…"
                className={`${inputCls} resize-none`}
              />

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1 block">
                    Start Date
                  </label>
                  <input
                    aria-label="Select start date for event"
                    type="date"
                    value={eStart}
                    onChange={(e) => setEStart(e.target.value)}
                    className={`${inputCls} [color-scheme:light]`}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1 block">
                    End Date (opt)
                  </label>
                  <input
                    aria-label="Select end date for event"
                    type="date"
                    value={eEnd}
                    onChange={(e) => setEEnd(e.target.value)}
                    className={`${inputCls} [color-scheme:light]`}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1 block">
                    Audience
                  </label>
                  <select
                    aria-label={`Select audience for event: everyone, parents, or teachers`}
                    value={eAudience}
                    onChange={(e) => setEAudience(e.target.value)}
                    className={inputCls}
                  >
                    <option value="all">Everyone</option>
                    <option value="parents">Parents</option>
                    <option value="teachers">Teachers</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1 block">
                    Grade (opt)
                  </label>
                  <select
                    aria-label={`Select grade for event`}
                    value={eGrade}
                    onChange={(e) => setEGrade(e.target.value)}
                    className={inputCls}
                  >
                    {GRADES.map((g) => (
                      <option key={g} value={g}>
                        {g}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  onClick={handleCreateEvent}
                  disabled={isPending || !eTitle.trim() || !eStart}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold transition-colors disabled:opacity-40"
                >
                  {isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <CalendarDays className="h-4 w-4" /> Add Event
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Upcoming events */}
            {upcomingEvents.length > 0 && (
              <div className="space-y-2">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">
                  Upcoming ({upcomingEvents.length})
                </p>
                {upcomingEvents.map((e) => (
                  <div
                    key={e.id}
                    className="bg-white rounded-2xl border border-indigo-100 shadow-sm p-4 flex gap-4"
                  >
                    <div className="h-12 w-12 rounded-xl bg-indigo-50 border border-indigo-100 flex flex-col items-center justify-center shrink-0">
                      <p className="text-xs font-black text-indigo-700">
                        {new Date(
                          e.start_date + "T00:00:00",
                        ).toLocaleDateString("en-KE", { day: "numeric" })}
                      </p>
                      <p className="text-[9px] text-indigo-400 font-bold">
                        {new Date(
                          e.start_date + "T00:00:00",
                        ).toLocaleDateString("en-KE", { month: "short" })}
                      </p>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-bold text-slate-800">
                          {e.title}
                        </p>
                        <div className="flex items-center gap-2 shrink-0">
                          {e.target_grade && (
                            <span className="text-[9px] font-black bg-slate-100 text-slate-500 px-2 py-0.5 rounded-lg">
                              {e.target_grade}
                            </span>
                          )}
                          <button
                            aria-label={`Delete event: ${e.title}`}
                            onClick={() => handleDeleteEvent(e.id)}
                            className="text-slate-300 hover:text-rose-500 transition-colors"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                      {e.description && (
                        <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">
                          {e.description}
                        </p>
                      )}
                      <p className="text-[9px] text-slate-400 mt-1">
                        {formatDate(e.start_date)}
                        {e.end_date &&
                          e.end_date !== e.start_date &&
                          ` – ${formatDate(e.end_date)}`}
                        {" · "}
                        <span className="capitalize">{e.audience}</span>
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {events.length === 0 && (
              <div className="bg-white rounded-2xl border border-slate-200 py-16 text-center shadow-sm">
                <p className="text-4xl mb-2">📅</p>
                <p className="text-slate-500 font-semibold">No events yet</p>
                <p className="text-slate-400 text-sm mt-1">
                  Add term dates, exams, trips — parents see them on their
                  calendar
                </p>
              </div>
            )}

            {pastEvents.length > 0 && (
              <div className="space-y-2">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">
                  Past Events
                </p>
                {pastEvents.map((e) => (
                  <div
                    key={e.id}
                    className="bg-slate-50 rounded-xl border border-slate-200 px-4 py-3 flex items-center gap-3 opacity-60"
                  >
                    <div className="flex-1">
                      <p className="text-xs font-bold text-slate-500">
                        {e.title}
                      </p>
                      <p className="text-[9px] text-slate-400">
                        {formatDate(e.start_date)}
                      </p>
                    </div>
                    <button
                      aria-label={`Delete event: ${e.title}`}
                      onClick={() => handleDeleteEvent(e.id)}
                      className="text-slate-300 hover:text-rose-500"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
