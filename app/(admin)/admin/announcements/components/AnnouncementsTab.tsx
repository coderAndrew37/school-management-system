"use client";

// components/AnnouncementsTab.tsx
// Renders the full Announcements tab: compose form + active + expired lists.
// All side-effects (create, delete) are driven by callbacks from the parent shell.

import { AlertTriangle, Clock, Info, Loader2, Megaphone, Trash2 } from "lucide-react";
import Link from "next/link";
import type { AnnouncementFormState } from "../hooks/useAnnouncementForm";
import { GRADES, INP, LBL, SEL } from "../constants";
import { fmt, fmtShort } from "../utils";
import type { Announcement } from "../types";
import { AnnCard } from "./AnnCard";
import { Empty, SectionDivider } from "./ui";

interface Props {
  // Form
  form: AnnouncementFormState;
  setField: <K extends keyof AnnouncementFormState>(
    key: K,
    value: AnnouncementFormState[K],
  ) => void;
  canSubmit: boolean;
  isPending: boolean;
  onSubmit: () => void;
  // Lists
  urgentAnn: Announcement[];
  normalAnn: Announcement[];
  expiredAnn: Announcement[];
  onDeleteRequest: (id: string) => void;
}

export function AnnouncementsTab({
  form,
  setField,
  canSubmit,
  isPending,
  onSubmit,
  urgentAnn,
  normalAnn,
  expiredAnn,
  onDeleteRequest,
}: Props) {
  const activeCount = urgentAnn.length + normalAnn.length;

  return (
    <>
      {/* ── Compose card ─────────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-6 space-y-5">
        <div>
          <p className="text-sm font-bold text-white">Post a Notice</p>
          <p className="text-[11px] text-white/35 mt-0.5">
            Appears on the parent portal until it expires or you remove it. Use{" "}
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
              onClick={() => setField("priority", p)}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border text-xs font-bold transition-all ${
                form.priority === p
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
            value={form.title}
            onChange={(e) => setField("title", e.target.value)}
            placeholder="e.g. School closed on Friday 15th March"
            maxLength={120}
            className={INP}
          />
          <p className="text-[10px] text-white/20 mt-1 text-right">
            {form.title.length}/120
          </p>
        </div>

        <div>
          <label className={LBL}>Message</label>
          <textarea
            value={form.body}
            onChange={(e) => setField("body", e.target.value)}
            rows={4}
            maxLength={2000}
            className={`${INP} resize-none`}
            placeholder="Write clearly and concisely — parents read this on their phones. Include any actions required."
          />
          <p className="text-[10px] text-white/20 mt-1 text-right">
            {form.body.length}/2000
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className={LBL}>Audience</label>
            <select
              value={form.audience}
              onChange={(e) =>
                setField("audience", e.target.value as AnnouncementFormState["audience"])
              }
              className={SEL}
              aria-label="audience"
            >
              <option value="all" className="bg-[#0c0f1a]">Everyone</option>
              <option value="parents" className="bg-[#0c0f1a]">Parents only</option>
              <option value="teachers" className="bg-[#0c0f1a]">Teachers only</option>
            </select>
          </div>
          <div>
            <label className={LBL}>Grade (optional)</label>
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
          <div>
            <label className={LBL}>Expires (optional)</label>
            <input
              type="date"
              value={form.expiresAt}
              onChange={(e) => setField("expiresAt", e.target.value)}
              min={new Date().toISOString().split("T")[0]}
              className={`${INP} [color-scheme:dark]`}
              aria-label="expiry date"
            />
          </div>
        </div>

        <div className="flex items-center justify-between pt-1">
          <p className="text-[11px] text-white/30">
            {form.priority === "urgent" && (
              <span className="text-rose-400 font-semibold">
                ⚡ Shown as urgent banner at top of portal
              </span>
            )}
          </p>
          <button
            onClick={onSubmit}
            disabled={isPending || !canSubmit}
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

      {/* ── Active notices ──────────────────────────────────────────────── */}
      {activeCount > 0 ? (
        <div className="space-y-4">
          {urgentAnn.length > 0 && (
            <>
              <SectionDivider label={`Urgent · ${urgentAnn.length}`} />
              <div className="space-y-3">
                {urgentAnn.map((a) => (
                  <AnnCard
                    key={a.id}
                    ann={a}
                    onDelete={() => onDeleteRequest(a.id)}
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
                    onDelete={() => onDeleteRequest(a.id)}
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

      {/* ── Expired ─────────────────────────────────────────────────────── */}
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
                <p className="text-xs font-semibold text-white/35 truncate">{a.title}</p>
                <p className="text-[10px] text-white/20 mt-0.5">
                  Expired {fmt(a.expires_at!)}
                </p>
              </div>
              <button
                onClick={() => onDeleteRequest(a.id)}
                aria-label="Delete expired announcement"
                className="text-white/15 hover:text-rose-400 transition-colors shrink-0"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </>
  );
}