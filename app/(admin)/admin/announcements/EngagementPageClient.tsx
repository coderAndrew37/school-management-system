"use client";

// app/admin/announcements/_components/EngagementPageClient.tsx
// Notice board + school calendar — dark mode, matches the rest of admin.
//
// PURPOSE (shown in header):
//   Announcements = persistent notices that live on the parent portal until expired.
//   Events        = school calendar dates parents see every time they log in.
//
// This is NOT the same as /admin/communications (which sends email/SMS to inboxes).

import {
  createAnnouncementAction,
  deleteAnnouncementAction,
  createEventAction,
  deleteEventAction,
  type Announcement,
  type SchoolEvent,
} from "@/lib/actions/engagement";
import {
  AlertTriangle,
  Bell,
  CalendarDays,
  Check,
  ChevronLeft,
  Clock,
  Info,
  Loader2,
  Megaphone,
  Plus,
  Trash2,
  Users,
  X,
} from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

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

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString("en-KE", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function fmtShort(iso: string) {
  return new Date(
    iso + (iso.includes("T") ? "" : "T00:00:00"),
  ).toLocaleDateString("en-KE", { day: "numeric", month: "short" });
}

function daysUntil(iso: string) {
  return Math.ceil(
    (new Date(iso + "T00:00:00").getTime() - new Date().setHours(0, 0, 0, 0)) /
      86400000,
  );
}

function urgencyBadge(days: number) {
  if (days === 0)
    return {
      label: "Today",
      cls: "bg-rose-400/15 text-rose-400 border-rose-400/25",
    };
  if (days === 1)
    return {
      label: "Tomorrow",
      cls: "bg-amber-400/15 text-amber-400 border-amber-400/25",
    };
  if (days <= 7)
    return {
      label: `In ${days}d`,
      cls: "bg-sky-400/15 text-sky-400 border-sky-400/25",
    };
  return null;
}

// ── Shared input style ────────────────────────────────────────────────────────

const INP =
  "w-full rounded-xl border border-white/10 bg-white/[0.05] px-3.5 py-2.5 text-sm text-white placeholder-white/20 outline-none focus:border-amber-400/40 focus:bg-white/[0.07] transition-all";
const SEL = INP + " appearance-none cursor-pointer";
const LBL =
  "block text-[10px] font-bold uppercase tracking-widest text-white/35 mb-1.5";

// ── Priority config ───────────────────────────────────────────────────────────

const PRIORITY = {
  urgent: {
    icon: <AlertTriangle className="h-4 w-4" />,
    card: "border-rose-400/25 bg-rose-400/[0.06]",
    dot: "bg-rose-400",
    badge: "bg-rose-400/15 text-rose-400 border-rose-400/25",
  },
  normal: {
    icon: <Info className="h-4 w-4" />,
    card: "border-white/[0.07] bg-white/[0.02]",
    dot: "bg-sky-400",
    badge: "bg-sky-400/15 text-sky-400 border-sky-400/25",
  },
};

// ── Delete confirm modal ──────────────────────────────────────────────────────

function DeleteModal({
  onConfirm,
  onCancel,
  isPending,
}: {
  onConfirm: () => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl border border-white/[0.09] bg-[#0f1223] p-6 shadow-2xl">
        <h3 className="text-sm font-bold text-white mb-1">Remove this item?</h3>
        <p className="text-xs text-white/40 mb-5 leading-relaxed">
          It will disappear from the parent portal immediately. This cannot be
          undone.
        </p>
        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="flex-1 rounded-xl border border-white/10 py-2.5 text-xs font-semibold text-white/40 hover:text-white/70 transition-all"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isPending}
            className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-rose-500/20 border border-rose-500/30 py-2.5 text-xs font-bold text-rose-400 hover:bg-rose-500/30 transition-all disabled:opacity-50"
          >
            {isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Trash2 className="h-3.5 w-3.5" />
            )}
            Remove
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Section divider ───────────────────────────────────────────────────────────

function SectionDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-px bg-white/[0.06]" />
      <p className="text-[10px] font-bold uppercase tracking-widest text-white/25">
        {label}
      </p>
      <div className="flex-1 h-px bg-white/[0.06]" />
    </div>
  );
}

// ── Announcement card ─────────────────────────────────────────────────────────

function AnnCard({
  ann,
  onDelete,
  isPending,
}: {
  ann: Announcement;
  onDelete: () => void;
  isPending: boolean;
}) {
  const cfg = PRIORITY[ann.priority === "urgent" ? "urgent" : "normal"];
  const now = new Date();
  const expiringSoon =
    ann.expires_at &&
    new Date(ann.expires_at) > now &&
    new Date(ann.expires_at).getTime() - now.getTime() < 3 * 86400000;

  return (
    <div
      className={`rounded-2xl border p-4 flex gap-4 transition-all hover:bg-white/[0.02] ${cfg.card}`}
    >
      <div className="mt-0.5 shrink-0">
        <span
          className={
            cfg.dot === "bg-rose-400" ? "text-rose-400" : "text-sky-400"
          }
        >
          {cfg.icon}
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2 mb-1">
          <p className="text-sm font-bold text-white leading-snug">
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
              <span className="text-[9px] font-semibold bg-white/[0.06] text-white/50 border border-white/10 px-2 py-0.5 rounded-lg">
                {ann.target_grade}
              </span>
            )}
            <span className="text-[9px] text-white/35 border border-white/[0.07] px-2 py-0.5 rounded-lg capitalize flex items-center gap-1">
              <Users className="h-2.5 w-2.5" />
              {ann.audience === "all" ? "Everyone" : ann.audience}
            </span>
            <button
              onClick={onDelete}
              disabled={isPending}
              aria-label="Delete"
              className="text-white/20 hover:text-rose-400 transition-colors ml-0.5 disabled:opacity-40"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
        <p className="text-xs text-white/50 leading-relaxed line-clamp-3">
          {ann.body}
        </p>
        <div className="flex items-center gap-3 mt-2">
          <p className="text-[10px] text-white/25">
            Published {fmt(ann.created_at)}
          </p>
          {ann.expires_at && (
            <p
              className={`text-[10px] font-semibold ${expiringSoon ? "text-amber-400" : "text-white/25"}`}
            >
              {expiringSoon && "⚠ "}Expires {fmtShort(ann.expires_at)}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Event card ────────────────────────────────────────────────────────────────

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
  const multi = event.end_date && event.end_date !== event.start_date;
  const d = new Date(event.start_date + "T00:00:00");

  return (
    <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4 flex gap-4 hover:bg-white/[0.04] transition-all">
      {/* Date block */}
      <div className="h-14 w-12 rounded-xl bg-amber-400/10 border border-amber-400/20 flex flex-col items-center justify-center shrink-0">
        <p className="text-lg font-black text-amber-400 leading-none">
          {d.getDate()}
        </p>
        <p className="text-[9px] text-amber-400/60 font-bold uppercase tracking-wide">
          {d.toLocaleDateString("en-KE", { month: "short" })}
        </p>
        <p className="text-[8px] text-amber-400/40 font-bold">
          {d.getFullYear()}
        </p>
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-bold text-white">{event.title}</p>
          <div className="flex items-center gap-1.5 shrink-0">
            {badge && (
              <span
                className={`text-[9px] font-black border px-2 py-0.5 rounded-lg ${badge.cls}`}
              >
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
              aria-label="Delete"
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
            {multi
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

// ── Empty state ───────────────────────────────────────────────────────────────

function Empty({
  emoji,
  title,
  sub,
}: {
  emoji: string;
  title: string;
  sub: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 rounded-2xl border border-dashed border-white/[0.07] text-center">
      <p className="text-4xl mb-3">{emoji}</p>
      <p className="text-white/50 font-semibold text-sm">{title}</p>
      <p className="text-white/25 text-xs mt-1 max-w-xs">{sub}</p>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface Props {
  announcements: Announcement[];
  events: SchoolEvent[];
}

export function AdminEngagementClient({ announcements, events }: Props) {
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<"announcements" | "events">(
    searchParams.get("tab") === "events" ? "events" : "announcements",
  );
  useEffect(() => {
    if (searchParams.get("tab") === "events") setTab("events");
  }, [searchParams]);

  const [isPending, startTrans] = useTransition();
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [delId, setDelId] = useState<string | null>(null);

  // Announcement form
  const [aTitle, setATitle] = useState("");
  const [aBody, setABody] = useState("");
  const [aPri, setAPri] = useState<"normal" | "urgent">("normal");
  const [aAud, setAAud] = useState("all");
  const [aGrade, setAGrade] = useState("All grades");
  const [aExp, setAExp] = useState("");

  // Event form
  const [eTitle, setETitle] = useState("");
  const [eDesc, setEDesc] = useState("");
  const [eStart, setEStart] = useState("");
  const [eEnd, setEEnd] = useState("");
  const [eAud, setEAud] = useState("all");
  const [eGrade, setEGrade] = useState("All grades");

  function showToast(msg: string, ok: boolean) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 4000);
  }

  // ── Submit handlers ───────────────────────────────────────────────────────

  function handleCreateAnn() {
    if (!aTitle.trim() || !aBody.trim()) return;
    startTrans(async () => {
      const res = await createAnnouncementAction({
        title: aTitle,
        body: aBody,
        priority: aPri,
        audience: aAud as any,
        target_grade: aGrade !== "All grades" ? aGrade : null,
        expires_at: aExp || null,
      });
      if (res.success) {
        showToast("Notice published — parents will see it now.", true);
        setATitle("");
        setABody("");
        setAPri("normal");
        setAGrade("All grades");
        setAExp("");
      } else showToast(res.error ?? "Failed to publish", false);
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
        audience: eAud as any,
        target_grade: eGrade !== "All grades" ? eGrade : null,
      });
      if (res.success) {
        showToast("Event added to calendar.", true);
        setETitle("");
        setEDesc("");
        setEStart("");
        setEEnd("");
        setEGrade("All grades");
      } else showToast(res.error ?? "Failed to add event", false);
    });
  }

  function handleDelete() {
    if (!delId) return;
    const isAnn = announcements.some((a) => a.id === delId);
    startTrans(async () => {
      const res = isAnn
        ? await deleteAnnouncementAction(delId)
        : await deleteEventAction(delId);
      setDelId(null);
      showToast(
        res.success ? "Removed." : (res.error ?? "Failed"),
        res.success,
      );
    });
  }

  // ── Derived ───────────────────────────────────────────────────────────────
  const now = new Date();
  const activeAnn = announcements.filter(
    (a) => !a.expires_at || new Date(a.expires_at) > now,
  );
  const expiredAnn = announcements.filter(
    (a) => a.expires_at && new Date(a.expires_at) <= now,
  );
  const urgentAnn = activeAnn.filter((a) => a.priority === "urgent");
  const normalAnn = activeAnn.filter((a) => a.priority !== "urgent");
  const upcoming = events.filter((e) => daysUntil(e.start_date) >= 0);
  const past = events.filter((e) => daysUntil(e.start_date) < 0);

  const canPublish = aTitle.trim().length >= 2 && aBody.trim().length >= 5;
  const canAddEvent = eTitle.trim().length >= 2 && eStart.length > 0;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#0c0f1a] font-[family-name:var(--font-body)]">
      {/* Ambient */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/3 w-[600px] h-[600px] rounded-full bg-amber-500/[0.03] blur-[140px]" />
        <div className="absolute bottom-0 right-0 w-80 h-80 rounded-full bg-sky-500/[0.03] blur-[100px]" />
      </div>

      {/* Toast */}
      {toast && (
        <div
          onClick={() => setToast(null)}
          className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold shadow-2xl cursor-pointer border ${
            toast.ok
              ? "bg-emerald-400/15 border-emerald-400/30 text-emerald-400"
              : "bg-rose-400/15 border-rose-400/30 text-rose-400"
          }`}
        >
          {toast.ok ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
          {toast.msg}
        </div>
      )}

      {/* Delete modal */}
      {delId && (
        <DeleteModal
          onConfirm={handleDelete}
          onCancel={() => setDelId(null)}
          isPending={isPending}
        />
      )}

      {/* Header */}
      <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 pb-0 space-y-8">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link
              href="/admin"
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/[0.05] border border-white/[0.08] hover:bg-white/[0.08] transition-colors"
            >
              <ChevronLeft className="h-4 w-4 text-white/50" />
            </Link>
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-400/10 border border-amber-400/20">
              <Bell className="h-6 w-6 text-amber-400" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-amber-400/70">
                Kibali Academy
              </p>
              <h1 className="text-2xl font-bold tracking-tight text-white">
                Notice Board
              </h1>
              <p className="text-[11px] text-white/25 mt-0.5">
                Persistent notices &amp; events visible on the parent portal ·{" "}
                <span className="text-white/35 font-medium">
                  Not the same as sending an email/SMS
                </span>
              </p>
            </div>
          </div>

          {/* Live counts */}
          <div className="flex items-center gap-3">
            {urgentAnn.length > 0 && (
              <div className="flex items-center gap-1.5 rounded-xl bg-rose-400/10 border border-rose-400/20 px-3 py-1.5">
                <AlertTriangle className="h-3 w-3 text-rose-400" />
                <span className="text-xs font-bold text-rose-400">
                  {urgentAnn.length} urgent
                </span>
              </div>
            )}
            <div className="flex items-center gap-1.5 rounded-xl bg-amber-400/10 border border-amber-400/20 px-3 py-1.5">
              <CalendarDays className="h-3 w-3 text-amber-400" />
              <span className="text-xs font-bold text-amber-400">
                {upcoming.length} upcoming
              </span>
            </div>
            <Link
              href="/admin/communications"
              className="flex items-center gap-1.5 rounded-xl border border-white/10 px-3 py-1.5 text-xs font-semibold text-white/40 hover:text-white/70 hover:border-white/20 transition-all"
            >
              📨 Send Email/SMS instead →
            </Link>
          </div>
        </header>

        {/* Tab bar */}
        <div className="flex border-b border-white/[0.07] -mb-8">
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
                count: upcoming.length,
              },
            ] as const
          ).map(({ key, label, icon: Icon, count }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex items-center gap-2 px-5 py-3.5 text-xs font-bold border-b-2 transition-all ${
                tab === key
                  ? "border-amber-400 text-amber-400"
                  : "border-transparent text-white/35 hover:text-white/60"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
              {count > 0 && (
                <span
                  className={`text-[9px] font-black px-1.5 py-0.5 rounded-full min-w-[18px] text-center ${
                    tab === key
                      ? "bg-amber-400/15 text-amber-400"
                      : "bg-white/[0.06] text-white/30"
                  }`}
                >
                  {count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* ── ANNOUNCEMENTS ─────────────────────────────────────────────────── */}
        {tab === "announcements" && (
          <>
            {/* Compose card */}
            <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-6 space-y-5">
              <div>
                <p className="text-sm font-bold text-white">Post a Notice</p>
                <p className="text-[11px] text-white/35 mt-0.5">
                  Appears on the parent portal until it expires or you remove
                  it. Use{" "}
                  <Link
                    href="/admin/communications"
                    className="text-amber-400/70 hover:text-amber-400 underline underline-offset-2"
                  >
                    Communications
                  </Link>{" "}
                  to send a direct email or SMS instead.
                </p>
              </div>

              {/* Priority toggle */}
              <div className="flex gap-2">
                {(["normal", "urgent"] as const).map((p) => (
                  <button
                    key={p}
                    onClick={() => setAPri(p)}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border text-xs font-bold transition-all ${
                      aPri === p
                        ? p === "urgent"
                          ? "bg-rose-400/15 border-rose-400/40 text-rose-400 shadow-sm shadow-rose-400/10"
                          : "bg-amber-400/15 border-amber-400/40 text-amber-400 shadow-sm shadow-amber-400/10"
                        : "bg-white/[0.03] border-white/[0.07] text-white/35 hover:border-white/[0.15]"
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
                <label className={LBL}>Title</label>
                <input
                  type="text"
                  value={aTitle}
                  onChange={(e) => setATitle(e.target.value)}
                  placeholder="e.g. School closed on Friday 15th March"
                  maxLength={120}
                  className={INP}
                />
                <p className="text-[10px] text-white/20 mt-1 text-right">
                  {aTitle.length}/120
                </p>
              </div>

              <div>
                <label className={LBL}>Message</label>
                <textarea
                  value={aBody}
                  onChange={(e) => setABody(e.target.value)}
                  rows={4}
                  maxLength={2000}
                  className={`${INP} resize-none`}
                  placeholder="Write clearly and concisely — parents read this on their phones. Include any actions required."
                />
                <p className="text-[10px] text-white/20 mt-1 text-right">
                  {aBody.length}/2000
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className={LBL}>Audience</label>
                  <select
                    value={aAud}
                    onChange={(e) => setAAud(e.target.value)}
                    className={SEL}
                    aria-label="audience"
                  >
                    <option value="all" className="bg-[#0c0f1a]">
                      Everyone
                    </option>
                    <option value="parents" className="bg-[#0c0f1a]">
                      Parents only
                    </option>
                    <option value="teachers" className="bg-[#0c0f1a]">
                      Teachers only
                    </option>
                  </select>
                </div>
                <div>
                  <label className={LBL}>Grade (optional)</label>
                  <select
                    value={aGrade}
                    onChange={(e) => setAGrade(e.target.value)}
                    className={SEL}
                    aria-label="grade"
                  >
                    {GRADES.map((g) => (
                      <option key={g} value={g} className="bg-[#0c0f1a]">
                        {g}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={LBL}>Expires (optional)</label>
                  <input
                    type="date"
                    value={aExp}
                    onChange={(e) => setAExp(e.target.value)}
                    min={new Date().toISOString().split("T")[0]}
                    className={`${INP} [color-scheme:dark]`}
                    aria-label="expiry date"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-1">
                <p className="text-[11px] text-white/30">
                  {aPri === "urgent" && (
                    <span className="text-rose-400 font-semibold">
                      ⚡ Shown as urgent banner at top of portal
                    </span>
                  )}
                </p>
                <button
                  onClick={handleCreateAnn}
                  disabled={isPending || !canPublish}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-[#0c0f1a] text-sm font-bold disabled:opacity-50 transition-all shadow-lg shadow-amber-400/20"
                >
                  {isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Megaphone className="h-4 w-4" />
                  )}
                  Publish Now
                </button>
              </div>
            </div>

            {/* Active notices */}
            {activeAnn.length > 0 ? (
              <div className="space-y-4">
                {urgentAnn.length > 0 && (
                  <>
                    <SectionDivider label={`Urgent · ${urgentAnn.length}`} />
                    <div className="space-y-3">
                      {urgentAnn.map((a) => (
                        <AnnCard
                          key={a.id}
                          ann={a}
                          onDelete={() => setDelId(a.id)}
                          isPending={isPending}
                        />
                      ))}
                    </div>
                  </>
                )}
                {normalAnn.length > 0 && (
                  <>
                    <SectionDivider label={`Active · ${normalAnn.length}`} />
                    <div className="space-y-3">
                      {normalAnn.map((a) => (
                        <AnnCard
                          key={a.id}
                          ann={a}
                          onDelete={() => setDelId(a.id)}
                          isPending={isPending}
                        />
                      ))}
                    </div>
                  </>
                )}
              </div>
            ) : (
              <Empty
                emoji="📢"
                title="No active notices"
                sub="Post one above — it will appear on the parent portal immediately and persist until it expires."
              />
            )}

            {/* Expired */}
            {expiredAnn.length > 0 && (
              <div className="space-y-2">
                <SectionDivider label={`Expired · ${expiredAnn.length}`} />
                {expiredAnn.map((a) => (
                  <div
                    key={a.id}
                    className="flex items-center gap-3 rounded-xl border border-white/[0.05] bg-white/[0.02] px-4 py-3"
                  >
                    <Clock className="h-3.5 w-3.5 text-white/15 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-white/35 truncate">
                        {a.title}
                      </p>
                      <p className="text-[10px] text-white/20 mt-0.5">
                        Expired {fmt(a.expires_at!)}
                      </p>
                    </div>
                    <button
                      onClick={() => setDelId(a.id)}
                      aria-label="Delete"
                      className="text-white/15 hover:text-rose-400 transition-colors shrink-0"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ── EVENTS ──────────────────────────────────────────────────────── */}
        {tab === "events" && (
          <>
            {/* Add event form */}
            <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-6 space-y-5">
              <div>
                <p className="text-sm font-bold text-white">
                  Add to School Calendar
                </p>
                <p className="text-[11px] text-white/35 mt-0.5">
                  Term dates, exams, sports days, trips — parents see these on
                  their events calendar.
                </p>
              </div>

              <div>
                <label className={LBL}>Event Title</label>
                <input
                  type="text"
                  value={eTitle}
                  onChange={(e) => setETitle(e.target.value)}
                  placeholder="e.g. End of Term 1 Exams, Sports Day, Prize Giving"
                  maxLength={120}
                  className={INP}
                />
              </div>

              <div>
                <label className={LBL}>Description (optional)</label>
                <textarea
                  value={eDesc}
                  onChange={(e) => setEDesc(e.target.value)}
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
                    value={eStart}
                    onChange={(e) => setEStart(e.target.value)}
                    className={`${INP} [color-scheme:dark]`}
                    aria-label="start date"
                  />
                </div>
                <div>
                  <label className={LBL}>End Date (opt)</label>
                  <input
                    type="date"
                    value={eEnd}
                    onChange={(e) => setEEnd(e.target.value)}
                    min={eStart}
                    className={`${INP} [color-scheme:dark]`}
                    aria-label="end date"
                  />
                </div>
                <div>
                  <label className={LBL}>Audience</label>
                  <select
                    value={eAud}
                    onChange={(e) => setEAud(e.target.value)}
                    className={SEL}
                    aria-label="audience"
                  >
                    <option value="all" className="bg-[#0c0f1a]">
                      Everyone
                    </option>
                    <option value="parents" className="bg-[#0c0f1a]">
                      Parents
                    </option>
                    <option value="teachers" className="bg-[#0c0f1a]">
                      Teachers
                    </option>
                  </select>
                </div>
                <div>
                  <label className={LBL}>Grade (opt)</label>
                  <select
                    value={eGrade}
                    onChange={(e) => setEGrade(e.target.value)}
                    className={SEL}
                    aria-label="grade"
                  >
                    {GRADES.map((g) => (
                      <option key={g} value={g} className="bg-[#0c0f1a]">
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

            {upcoming.length > 0 ? (
              <div className="space-y-3">
                <SectionDivider label={`Upcoming · ${upcoming.length}`} />
                {upcoming.map((e) => (
                  <EventCard
                    key={e.id}
                    event={e}
                    onDelete={() => setDelId(e.id)}
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
                        onClick={() => setDelId(e.id)}
                        aria-label="Delete"
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
        )}
      </div>
    </div>
  );
}
