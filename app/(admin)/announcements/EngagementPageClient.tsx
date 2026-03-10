"use client";

// app/admin/announcements/_components/AdminEngagementClient.tsx
// Full admin communications hub — Announcements + Events Calendar.
// Loaded by app/admin/announcements/page.tsx
// /admin/events redirects here with ?tab=events

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
  AlertTriangle,
  Info,
  Bell,
  Clock,
  Users,
  ChevronLeft,
} from "lucide-react";
import Link from "next/link";
import { useState, useTransition, useEffect } from "react";
import { useSearchParams } from "next/navigation";

// ── Constants ─────────────────────────────────────────────────────────────────

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

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-KE", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatDateShort(iso: string) {
  return new Date(
    iso + (iso.includes("T") ? "" : "T00:00:00"),
  ).toLocaleDateString("en-KE", { day: "numeric", month: "short" });
}

function daysUntil(iso: string): number {
  return Math.ceil(
    (new Date(iso + "T00:00:00").getTime() - new Date().setHours(0, 0, 0, 0)) /
      86400000,
  );
}

function isUpcoming(dateStr: string) {
  return daysUntil(dateStr) >= 0;
}

function urgencyBadge(days: number) {
  if (days === 0)
    return { label: "Today", cls: "bg-rose-100 text-rose-700 border-rose-200" };
  if (days === 1)
    return {
      label: "Tomorrow",
      cls: "bg-amber-100 text-amber-700 border-amber-200",
    };
  if (days <= 7)
    return {
      label: `In ${days}d`,
      cls: "bg-indigo-100 text-indigo-700 border-indigo-200",
    };
  return null;
}

// ── Shared input class ────────────────────────────────────────────────────────

const inp =
  "w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 bg-white " +
  "text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 " +
  "focus:ring-indigo-400 focus:border-transparent transition";

const lbl =
  "block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5";

// ── Priority config ───────────────────────────────────────────────────────────

const PRIORITY_CONFIG = {
  urgent: {
    icon: <AlertTriangle className="h-4 w-4" />,
    cardBg: "bg-rose-50 border-rose-200",
    iconBg: "bg-rose-100",
    iconColor: "text-rose-600",
    badge: "bg-rose-100 text-rose-700 border-rose-200",
  },
  normal: {
    icon: <Info className="h-4 w-4" />,
    cardBg: "bg-white border-slate-200",
    iconBg: "bg-indigo-50",
    iconColor: "text-indigo-500",
    badge: "bg-indigo-50 text-indigo-600 border-indigo-100",
  },
};

// ── Toast ─────────────────────────────────────────────────────────────────────

function Toast({
  msg,
  ok,
  onDismiss,
}: {
  msg: string;
  ok: boolean;
  onDismiss: () => void;
}) {
  return (
    <div
      className={`fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-2xl text-sm font-bold shadow-2xl border ${
        ok
          ? "bg-indigo-700 text-white border-indigo-500"
          : "bg-rose-600 text-white border-rose-500"
      }`}
    >
      {ok ? (
        <Check className="h-4 w-4 shrink-0" />
      ) : (
        <X className="h-4 w-4 shrink-0" />
      )}
      {msg}
      <button
        aria-label="dismiss toast"
        onClick={onDismiss}
        className="ml-1 opacity-60 hover:opacity-100"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

// ── EmptyState ────────────────────────────────────────────────────────────────

function EmptyState({
  emoji,
  title,
  sub,
}: {
  emoji: string;
  title: string;
  sub: string;
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 py-16 text-center shadow-sm">
      <p className="text-5xl mb-3">{emoji}</p>
      <p className="text-slate-700 font-black text-sm">{title}</p>
      <p className="text-slate-400 text-xs mt-1 max-w-xs mx-auto">{sub}</p>
    </div>
  );
}

// ── SectionLabel ──────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-0.5 flex items-center gap-2">
      <span className="flex-1 h-px bg-slate-200" />
      {children}
      <span className="flex-1 h-px bg-slate-200" />
    </p>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface Props {
  announcements: Announcement[];
  events: SchoolEvent[];
}

export function AdminEngagementClient({ announcements, events }: Props) {
  // ── Tab from URL ───────────────────────────────────────────────────────────
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<"announcements" | "events">(
    searchParams.get("tab") === "events" ? "events" : "announcements",
  );
  useEffect(() => {
    if (searchParams.get("tab") === "events") setTab("events");
  }, [searchParams]);

  const [isPending, startTrans] = useTransition();
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // ── Announcement form state ────────────────────────────────────────────────
  const [aTitle, setATitle] = useState("");
  const [aBody, setABody] = useState("");
  const [aPriority, setAPriority] = useState<"normal" | "urgent">("normal");
  const [aAudience, setAAudience] = useState("all");
  const [aGrade, setAGrade] = useState("");
  const [aExpires, setAExpires] = useState("");

  // ── Event form state ───────────────────────────────────────────────────────
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

  // ── Actions ────────────────────────────────────────────────────────────────

  function handleCreateAnnouncement() {
    if (!aTitle.trim() || !aBody.trim()) return;
    startTrans(async () => {
      const res = await createAnnouncementAction({
        title: aTitle,
        body: aBody,
        audience: aAudience as "all" | "parents" | "teachers" | "students",
        priority: aPriority,
        target_grade: aGrade && aGrade !== "All grades" ? aGrade : null,
        expires_at: aExpires || null,
      });
      if (res.success) {
        showToast("Announcement published — parents will see it now", true);
        setATitle("");
        setABody("");
        setAPriority("normal");
        setAGrade("");
        setAExpires("");
      } else {
        showToast(res.error ?? "Failed to publish", false);
      }
    });
  }

  function handleDeleteAnnouncement(id: string) {
    startTrans(async () => {
      const res = await deleteAnnouncementAction(id);
      setDeleteConfirmId(null);
      if (res.success) showToast("Announcement removed", true);
      else showToast(res.error ?? "Failed to delete", false);
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
        audience: eAudience as "all" | "parents" | "teachers" | "students",
        target_grade: eGrade && eGrade !== "All grades" ? eGrade : null,
      });
      if (res.success) {
        showToast("Event added to calendar", true);
        setETitle("");
        setEDesc("");
        setEStart("");
        setEEnd("");
        setEGrade("");
      } else {
        showToast(res.error ?? "Failed to add event", false);
      }
    });
  }

  function handleDeleteEvent(id: string) {
    startTrans(async () => {
      const res = await deleteEventAction(id);
      setDeleteConfirmId(null);
      if (res.success) showToast("Event removed", true);
      else showToast(res.error ?? "Failed to delete", false);
    });
  }

  // ── Derived lists ──────────────────────────────────────────────────────────
  const now = new Date();
  const activeAnn = announcements.filter(
    (a) => !a.expires_at || new Date(a.expires_at) > now,
  );
  const expiredAnn = announcements.filter(
    (a) => a.expires_at && new Date(a.expires_at) <= now,
  );
  const urgentAnn = activeAnn.filter((a) => a.priority === "urgent");
  const normalAnn = activeAnn.filter((a) => a.priority !== "urgent");

  const upcomingEvents = events.filter((e) => isUpcoming(e.start_date));
  const pastEvents = events.filter((e) => !isUpcoming(e.start_date));

  const canPublish = aTitle.trim().length >= 2 && aBody.trim().length >= 5;
  const canAddEvent = eTitle.trim().length >= 2 && eStart.length > 0;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#f5f6fa]">
      {/* Toast */}
      {toast && (
        <Toast msg={toast.msg} ok={toast.ok} onDismiss={() => setToast(null)} />
      )}

      {/* Delete confirm modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-sm p-6">
            <p className="text-sm font-black text-slate-800 mb-1">
              Delete this item?
            </p>
            <p className="text-xs text-slate-500 mb-5">
              This will remove it from parents&apos; view immediately. This
              action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-600 hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  // Figure out whether it's an announcement or event by checking both lists
                  const isAnn = announcements.some(
                    (a) => a.id === deleteConfirmId,
                  );
                  if (isAnn) handleDeleteAnnouncement(deleteConfirmId);
                  else handleDeleteEvent(deleteConfirmId);
                }}
                disabled={isPending}
                className="flex-1 px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-sm font-bold transition-colors disabled:opacity-40 flex items-center justify-center gap-2"
              >
                {isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Page header ────────────────────────────────────────────────────── */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center gap-3">
          <Link
            href="/admin"
            className="text-slate-400 hover:text-slate-600 transition-colors shrink-0"
          >
            <ChevronLeft className="h-5 w-5" />
          </Link>

          <div className="h-8 w-8 rounded-xl bg-indigo-600 flex items-center justify-center shrink-0">
            <Bell className="h-4 w-4 text-white" />
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-sm font-black text-slate-800 leading-none">
              School Communications
            </p>
            <p className="text-[10px] text-slate-400 font-semibold mt-0.5">
              Announcements &amp; Events · visible to parents &amp; teachers
            </p>
          </div>

          {/* Live counts */}
          <div className="hidden sm:flex items-center gap-2">
            {urgentAnn.length > 0 && (
              <span className="flex items-center gap-1 text-[10px] font-black px-2.5 py-1 rounded-xl bg-rose-50 text-rose-600 border border-rose-200">
                <AlertTriangle className="h-3 w-3" />
                {urgentAnn.length} urgent
              </span>
            )}
            <span className="flex items-center gap-1 text-[10px] font-black px-2.5 py-1 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100">
              <CalendarDays className="h-3 w-3" />
              {upcomingEvents.length} upcoming
            </span>
          </div>
        </div>
      </header>

      {/* ── Tab bar ────────────────────────────────────────────────────────── */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 flex">
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
                label: "Events",
                icon: CalendarDays,
                count: upcomingEvents.length,
              },
            ] as const
          ).map(({ key, label, icon: Icon, count }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex items-center gap-2 px-5 py-3.5 text-xs font-bold border-b-2 transition-all ${
                tab === key
                  ? "border-indigo-600 text-indigo-700"
                  : "border-transparent text-slate-400 hover:text-slate-700"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
              {count > 0 && (
                <span
                  className={`text-[9px] font-black px-1.5 py-0.5 rounded-full min-w-[18px] text-center ${
                    tab === key
                      ? "bg-indigo-100 text-indigo-700"
                      : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── Content ────────────────────────────────────────────────────────── */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* ════════════════════ ANNOUNCEMENTS TAB ════════════════════════════ */}
        {tab === "announcements" && (
          <>
            {/* Compose card */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
                <div className="h-7 w-7 rounded-lg bg-indigo-50 flex items-center justify-center">
                  <Megaphone className="h-3.5 w-3.5 text-indigo-600" />
                </div>
                <div>
                  <p className="text-sm font-black text-slate-800 leading-none">
                    New Announcement
                  </p>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    Published immediately to parent and teacher portals
                  </p>
                </div>
              </div>

              <div className="p-5 space-y-4">
                {/* Priority picker — prominent at top */}
                <div className="flex gap-2">
                  {(["normal", "urgent"] as const).map((p) => (
                    <button
                      key={p}
                      onClick={() => setAPriority(p)}
                      className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border text-xs font-bold transition-all ${
                        aPriority === p
                          ? p === "urgent"
                            ? "bg-rose-600 border-rose-600 text-white shadow-sm shadow-rose-200"
                            : "bg-indigo-600 border-indigo-600 text-white shadow-sm shadow-indigo-200"
                          : "bg-white border-slate-200 text-slate-500 hover:border-slate-300"
                      }`}
                    >
                      {p === "urgent" ? (
                        <>
                          <AlertTriangle className="h-3.5 w-3.5" /> Urgent
                        </>
                      ) : (
                        <>
                          <Info className="h-3.5 w-3.5" /> Normal
                        </>
                      )}
                    </button>
                  ))}
                </div>

                <div>
                  <label className={lbl} aria-label="enter announcement title">
                    Title
                  </label>
                  <input
                    type="text"
                    value={aTitle}
                    onChange={(e) => setATitle(e.target.value)}
                    placeholder="e.g. School closed on Friday 15th March"
                    maxLength={120}
                    className={inp}
                  />
                  <p className="text-[10px] text-slate-400 mt-1 text-right">
                    {aTitle.length}/120
                  </p>
                </div>

                <div>
                  <label className={lbl}>Message</label>
                  <textarea
                    value={aBody}
                    onChange={(e) => setABody(e.target.value)}
                    rows={4}
                    maxLength={2000}
                    placeholder="Write your announcement clearly and concisely — parents read this on their phones. Include any actions they need to take."
                    className={`${inp} resize-none`}
                  />
                  <p className="text-[10px] text-slate-400 mt-1 text-right">
                    {aBody.length}/2000
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className={lbl}>Audience</label>
                    <select
                      aria-label="select audience"
                      value={aAudience}
                      onChange={(e) => setAAudience(e.target.value)}
                      className={inp}
                    >
                      <option value="all">Everyone</option>
                      <option value="parents">Parents only</option>
                      <option value="teachers">Teachers only</option>
                    </select>
                  </div>
                  <div>
                    <label className={lbl}>Grade (optional)</label>
                    <select
                      aria-label="select grade"
                      value={aGrade}
                      onChange={(e) => setAGrade(e.target.value)}
                      className={inp}
                    >
                      {GRADES.map((g) => (
                        <option key={g} value={g}>
                          {g}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={lbl}>Expires (optional)</label>
                    <input
                      aria-label="select expiration date"
                      type="date"
                      value={aExpires}
                      onChange={(e) => setAExpires(e.target.value)}
                      min={new Date().toISOString().split("T")[0]}
                      className={`${inp} [color-scheme:light]`}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <p className="text-[10px] text-slate-400">
                    {aPriority === "urgent" && (
                      <span className="text-rose-600 font-bold">
                        ⚡ Urgent banner shown at top of parent portal
                      </span>
                    )}
                  </p>
                  <button
                    onClick={handleCreateAnnouncement}
                    disabled={isPending || !canPublish}
                    className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold transition-colors disabled:opacity-40 shadow-sm shadow-indigo-200"
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
            </div>

            {/* Active announcements */}
            {activeAnn.length > 0 ? (
              <div className="space-y-4">
                {urgentAnn.length > 0 && (
                  <>
                    <SectionLabel>Urgent · {urgentAnn.length}</SectionLabel>
                    <div className="space-y-3">
                      {urgentAnn.map((a) => (
                        <AnnouncementCard
                          key={a.id}
                          ann={a}
                          onDelete={() => setDeleteConfirmId(a.id)}
                          isPending={isPending}
                        />
                      ))}
                    </div>
                  </>
                )}
                {normalAnn.length > 0 && (
                  <>
                    <SectionLabel>Active · {normalAnn.length}</SectionLabel>
                    <div className="space-y-3">
                      {normalAnn.map((a) => (
                        <AnnouncementCard
                          key={a.id}
                          ann={a}
                          onDelete={() => setDeleteConfirmId(a.id)}
                          isPending={isPending}
                        />
                      ))}
                    </div>
                  </>
                )}
              </div>
            ) : (
              <EmptyState
                emoji="📢"
                title="No active announcements"
                sub="Write one above — it will appear on the parent portal immediately."
              />
            )}

            {/* Expired */}
            {expiredAnn.length > 0 && (
              <div className="space-y-2">
                <SectionLabel>Expired · {expiredAnn.length}</SectionLabel>
                <div className="space-y-2">
                  {expiredAnn.map((a) => (
                    <div
                      key={a.id}
                      className="bg-slate-50 rounded-xl border border-slate-200 px-4 py-3 flex items-center gap-3"
                    >
                      <Clock className="h-3.5 w-3.5 text-slate-300 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-slate-400 truncate">
                          {a.title}
                        </p>
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          Expired {formatDate(a.expires_at!)}
                        </p>
                      </div>
                      <button
                        onClick={() => setDeleteConfirmId(a.id)}
                        className="text-slate-300 hover:text-rose-500 transition-colors shrink-0"
                        aria-label="Delete"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* ════════════════════ EVENTS TAB ═══════════════════════════════════ */}
        {tab === "events" && (
          <>
            {/* Add event card */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
                <div className="h-7 w-7 rounded-lg bg-indigo-50 flex items-center justify-center">
                  <CalendarDays className="h-3.5 w-3.5 text-indigo-600" />
                </div>
                <div>
                  <p className="text-sm font-black text-slate-800 leading-none">
                    Add Event
                  </p>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    Appears on the parent events calendar
                  </p>
                </div>
              </div>

              <div className="p-5 space-y-4">
                <div>
                  <label className={lbl}>Event Title</label>
                  <input
                    type="text"
                    value={eTitle}
                    onChange={(e) => setETitle(e.target.value)}
                    placeholder="e.g. End of Term Exams, Sports Day, Prize Giving"
                    maxLength={120}
                    className={inp}
                  />
                </div>

                <div>
                  <label className={lbl}>Description (optional)</label>
                  <textarea
                    value={eDesc}
                    onChange={(e) => setEDesc(e.target.value)}
                    rows={2}
                    maxLength={500}
                    placeholder="Additional details parents should know…"
                    className={`${inp} resize-none`}
                  />
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <label className={lbl}>Start Date</label>
                    <input
                      aria-label="select start date"
                      type="date"
                      value={eStart}
                      onChange={(e) => setEStart(e.target.value)}
                      className={`${inp} [color-scheme:light]`}
                    />
                  </div>
                  <div>
                    <label className={lbl}>End Date (opt)</label>
                    <input
                      aria-label="select end date"
                      type="date"
                      value={eEnd}
                      onChange={(e) => setEEnd(e.target.value)}
                      min={eStart}
                      className={`${inp} [color-scheme:light]`}
                    />
                  </div>
                  <div>
                    <label className={lbl}>Audience</label>
                    <select
                      aria-label="select audience"
                      value={eAudience}
                      onChange={(e) => setEAudience(e.target.value)}
                      className={inp}
                    >
                      <option value="all">Everyone</option>
                      <option value="parents">Parents</option>
                      <option value="teachers">Teachers</option>
                    </select>
                  </div>
                  <div>
                    <label className={lbl}>Grade (opt)</label>
                    <select
                      aria-label="select grade"
                      value={eGrade}
                      onChange={(e) => setEGrade(e.target.value)}
                      className={inp}
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
                    disabled={isPending || !canAddEvent}
                    className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold transition-colors disabled:opacity-40 shadow-sm shadow-indigo-200"
                  >
                    {isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <Plus className="h-4 w-4" /> Add to Calendar
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Upcoming events */}
            {upcomingEvents.length > 0 ? (
              <div className="space-y-3">
                <SectionLabel>Upcoming · {upcomingEvents.length}</SectionLabel>
                {upcomingEvents.map((e) => (
                  <EventCard
                    key={e.id}
                    event={e}
                    onDelete={() => setDeleteConfirmId(e.id)}
                    isPending={isPending}
                  />
                ))}
              </div>
            ) : (
              <EmptyState
                emoji="📅"
                title="No upcoming events"
                sub="Add term dates, exams, sports days, trips — parents will see them on their calendar."
              />
            )}

            {/* Past events */}
            {pastEvents.length > 0 && (
              <div className="space-y-2">
                <SectionLabel>Past Events · {pastEvents.length}</SectionLabel>
                <div className="space-y-2">
                  {pastEvents.map((e) => (
                    <div
                      key={e.id}
                      className="bg-slate-50 rounded-xl border border-slate-200 px-4 py-3 flex items-center gap-3"
                    >
                      <div className="h-9 w-9 rounded-lg bg-white border border-slate-200 flex flex-col items-center justify-center shrink-0">
                        <p className="text-xs font-black text-slate-400 leading-none">
                          {new Date(e.start_date + "T00:00:00").getDate()}
                        </p>
                        <p className="text-[8px] text-slate-300 font-bold">
                          {new Date(
                            e.start_date + "T00:00:00",
                          ).toLocaleDateString("en-KE", { month: "short" })}
                        </p>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-slate-400 truncate">
                          {e.title}
                        </p>
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          {formatDate(e.start_date)}
                        </p>
                      </div>
                      <button
                        onClick={() => setDeleteConfirmId(e.id)}
                        className="text-slate-300 hover:text-rose-500 transition-colors shrink-0"
                        aria-label="Delete"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function AnnouncementCard({
  ann,
  onDelete,
  isPending,
}: {
  ann: Announcement;
  onDelete: () => void;
  isPending: boolean;
}) {
  const cfg = PRIORITY_CONFIG[ann.priority === "urgent" ? "urgent" : "normal"];
  const now = new Date();
  const isExpiringSoon =
    ann.expires_at &&
    new Date(ann.expires_at) > now &&
    new Date(ann.expires_at).getTime() - now.getTime() < 3 * 86400000;

  return (
    <div
      className={`rounded-2xl border shadow-sm p-4 flex gap-4 ${cfg.cardBg}`}
    >
      <div
        className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${cfg.iconBg}`}
      >
        <span className={cfg.iconColor}>{cfg.icon}</span>
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2 mb-1">
          <p className="text-sm font-black text-slate-800 leading-snug">
            {ann.title}
          </p>
          <div className="flex items-center gap-1.5 shrink-0">
            {ann.priority === "urgent" && (
              <span
                className={`text-[9px] font-black border px-2 py-0.5 rounded-lg ${cfg.badge}`}
              >
                URGENT
              </span>
            )}
            {ann.target_grade && (
              <span className="text-[9px] font-black bg-slate-100 text-slate-500 border border-slate-200 px-2 py-0.5 rounded-lg">
                {ann.target_grade}
              </span>
            )}
            <span className="text-[9px] font-black bg-white text-slate-500 border border-slate-200 px-2 py-0.5 rounded-lg capitalize flex items-center gap-1">
              <Users className="h-2.5 w-2.5" />
              {ann.audience === "all" ? "Everyone" : ann.audience}
            </span>
            <button
              onClick={onDelete}
              disabled={isPending}
              className="text-slate-300 hover:text-rose-500 transition-colors ml-1 disabled:opacity-40"
              aria-label="Delete announcement"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        <p className="text-xs text-slate-600 leading-relaxed line-clamp-3">
          {ann.body}
        </p>

        <div className="flex items-center gap-3 mt-2">
          <p className="text-[10px] text-slate-400">
            Published{" "}
            {new Date(ann.created_at).toLocaleDateString("en-KE", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
          </p>
          {ann.expires_at && (
            <p
              className={`text-[10px] font-semibold ${isExpiringSoon ? "text-amber-600" : "text-slate-400"}`}
            >
              {isExpiringSoon && "⚠ "}Expires{" "}
              {new Date(
                ann.expires_at +
                  (ann.expires_at.includes("T") ? "" : "T00:00:00"),
              ).toLocaleDateString("en-KE", { day: "numeric", month: "short" })}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function EventCard({
  event,
  onDelete,
  isPending,
}: {
  event: SchoolEvent;
  onDelete: () => void;
  isPending: boolean;
}) {
  const days = daysUntil(event.start_date);
  const badge = urgencyBadge(days);
  const isMultiDay = event.end_date && event.end_date !== event.start_date;

  return (
    <div className="bg-white rounded-2xl border border-indigo-100 shadow-sm p-4 flex gap-4">
      {/* Date block */}
      <div className="h-14 w-12 rounded-xl bg-indigo-50 border border-indigo-100 flex flex-col items-center justify-center shrink-0">
        <p className="text-lg font-black text-indigo-700 leading-none">
          {new Date(event.start_date + "T00:00:00").getDate()}
        </p>
        <p className="text-[9px] text-indigo-400 font-bold uppercase tracking-wide">
          {new Date(event.start_date + "T00:00:00").toLocaleDateString(
            "en-KE",
            { month: "short" },
          )}
        </p>
        <p className="text-[8px] text-indigo-300 font-bold">
          {new Date(event.start_date + "T00:00:00").getFullYear()}
        </p>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-black text-slate-800">{event.title}</p>
          <div className="flex items-center gap-1.5 shrink-0">
            {badge && (
              <span
                className={`text-[9px] font-black border px-2 py-0.5 rounded-lg ${badge.cls}`}
              >
                {badge.label}
              </span>
            )}
            {event.target_grade && (
              <span className="text-[9px] font-black bg-slate-100 text-slate-500 border border-slate-200 px-2 py-0.5 rounded-lg">
                {event.target_grade}
              </span>
            )}
            <button
              onClick={onDelete}
              disabled={isPending}
              className="text-slate-300 hover:text-rose-500 transition-colors ml-1 disabled:opacity-40"
              aria-label="Delete event"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {event.description && (
          <p className="text-xs text-slate-500 mt-1 leading-relaxed line-clamp-2">
            {event.description}
          </p>
        )}

        <div className="flex items-center gap-3 mt-2">
          <p className="text-[10px] text-slate-400">
            {isMultiDay
              ? `${formatDateShort(event.start_date)} – ${formatDateShort(event.end_date!)}`
              : formatDateShort(event.start_date)}
          </p>
          <span className="text-[10px] text-slate-400 capitalize flex items-center gap-1">
            <Users className="h-2.5 w-2.5" />
            {event.audience === "all" ? "Everyone" : event.audience}
          </span>
        </div>
      </div>
    </div>
  );
}
