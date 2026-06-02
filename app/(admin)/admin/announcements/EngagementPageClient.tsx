"use client";

// EngagementPageClient.tsx — thin orchestration shell
//
// Responsibilities of THIS file only:
//   • Tab switching (read from searchParams on mount, then local state)
//   • Delete confirmation flow (which ID is pending, calling the right action)
//   • Wiring form hooks → tab components
//   • Rendering global chrome: header, ambient bg, toast, delete modal
//
// Everything else lives in its own file (hooks, cards, tab panels, utils).

import {
  deleteAnnouncementAction,
  deleteEventAction,
} from "@/lib/actions/engagement";
import {
  AlertTriangle,
  Bell,
  CalendarDays,
  ChevronLeft,
  Megaphone,
} from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import { useAnnouncementForm } from "./hooks/useAnnouncementForm";
import { useEngagementToast } from "./hooks/useEngagementToast";
import { useEventForm } from "./hooks/useEventForm";

import { AnnouncementsTab } from "./components/AnnouncementsTab";
import { EventsTab } from "./components/EventsTab";
import { DeleteModal, ToastBanner } from "./components/ui";

import { daysUntil } from "./utils";
import type { Announcement, SchoolEvent } from "./types";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Props {
  announcements: Announcement[];
  events: SchoolEvent[];
}

type Tab = "announcements" | "events";

// ── Component ─────────────────────────────────────────────────────────────────

export function AdminEngagementClient({ announcements, events }: Props) {
  const searchParams = useSearchParams();

  // ── Tab state ───────────────────────────────────────────────────────────
  const [tab, setTab] = useState<Tab>(
    searchParams.get("tab") === "events" ? "events" : "announcements",
  );
  useEffect(() => {
    if (searchParams.get("tab") === "events") setTab("events");
  }, [searchParams]);

  // ── Toast ───────────────────────────────────────────────────────────────
  const { toast, showToast, dismissToast } = useEngagementToast();

  // ── Delete flow ─────────────────────────────────────────────────────────
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [isDeleting, startDeleteTransition] = useTransition();

  function confirmDelete() {
    if (!pendingDeleteId) return;
    const isAnn = announcements.some((a) => a.id === pendingDeleteId);

    startDeleteTransition(async () => {
      const res = isAnn
        ? await deleteAnnouncementAction(pendingDeleteId)
        : await deleteEventAction(pendingDeleteId);

      setPendingDeleteId(null);
      showToast(res.success ? "Removed." : (res.error ?? "Failed"), res.success);
    });
  }

  // ── Form hooks ──────────────────────────────────────────────────────────
  const annForm = useAnnouncementForm(
    (msg) => showToast(msg, true),
    (msg) => showToast(msg, false),
  );

  const eventForm = useEventForm(
    (msg) => showToast(msg, true),
    (msg) => showToast(msg, false),
  );

  // ── Derived list slices ─────────────────────────────────────────────────
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

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#0c0f1a] font-[family-name:var(--font-body)]">
      {/* Ambient blobs */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/3 w-[600px] h-[600px] rounded-full bg-amber-500/[0.03] blur-[140px]" />
        <div className="absolute bottom-0 right-0 w-80 h-80 rounded-full bg-sky-500/[0.03] blur-[100px]" />
      </div>

      {/* Toast */}
      {toast && <ToastBanner toast={toast} onDismiss={dismissToast} />}

      {/* Delete confirm modal */}
      {pendingDeleteId && (
        <DeleteModal
          onConfirm={confirmDelete}
          onCancel={() => setPendingDeleteId(null)}
          isPending={isDeleting}
        />
      )}

      {/* ── Page header ───────────────────────────────────────────────── */}
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

        {/* ── Tab bar ──────────────────────────────────────────────────── */}
        <div className="flex border-b border-white/[0.07] -mb-8">
          {(
            [
              {
                key: "announcements" as const,
                label: "Announcements",
                icon: Megaphone,
                count: activeAnn.length,
              },
              {
                key: "events" as const,
                label: "Events",
                icon: CalendarDays,
                count: upcoming.length,
              },
            ]
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

      {/* ── Tab content ───────────────────────────────────────────────── */}
      <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {tab === "announcements" && (
          <AnnouncementsTab
            form={annForm.form}
            setField={annForm.setField}
            canSubmit={annForm.canSubmit}
            isPending={annForm.isPending}
            onSubmit={annForm.submit}
            urgentAnn={urgentAnn}
            normalAnn={normalAnn}
            expiredAnn={expiredAnn}
            onDeleteRequest={setPendingDeleteId}
          />
        )}

        {tab === "events" && (
          <EventsTab
            form={eventForm.form}
            setField={eventForm.setField}
            canSubmit={eventForm.canSubmit}
            isPending={eventForm.isPending}
            onSubmit={eventForm.submit}
            upcoming={upcoming}
            past={past}
            onDeleteRequest={setPendingDeleteId}
          />
        )}
      </div>
    </div>
  );
}