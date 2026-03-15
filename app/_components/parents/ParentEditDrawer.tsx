"use client";

// app/admin/parents/_components/ParentEditDrawer.tsx
// Slide-in management drawer for a single parent.
// Tabs: Details (edit + portal actions), Children (fee balances), Comms (notifications).
//
// IMPORTANT: lazy data (fees, notifications) is fetched via server ACTIONS,
// not direct data-layer imports, so next/headers never leaks into this file.

import type {
  Parent,
  ParentFeeBalance,
  ParentNotificationSummary,
} from "@/lib/types/dashboard";
import {
  deleteParentAction,
  getParentFeeBalancesAction,
  getParentNotificationHistoryAction,
  resetParentPasswordAction,
  updateParentAction,
} from "@/lib/actions/parents";
import { resendParentInviteAction } from "@/lib/actions/bulk-invite";
import {
  getStudentInitials,
  getStudentPhotoUrl,
} from "@/lib/utils/student-photo";
import { formatDistanceToNow } from "date-fns";
import {
  Bell,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  ExternalLink,
  KeyRound,
  Loader2,
  Mail,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { useState, useTransition } from "react";
import { ParentAvatar } from "./ParentAtoms";
import { fmt, kes } from "./parent-utils";

interface Props {
  parent: Parent;
  onClose: () => void;
  onToast: (type: "success" | "error", msg: string) => void;
}

const INP =
  "w-full rounded-xl border border-white/10 bg-white/[0.05] px-3.5 py-2.5 text-sm text-white placeholder-white/25 outline-none focus:border-amber-400/50 transition-colors";

export function ParentEditDrawer({ parent, onClose, onToast }: Props) {
  const [isPending, startTransition] = useTransition();
  const [tab, setTab] = useState<"details" | "children" | "comms">("details");
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  // Editable fields
  const [fullName, setFullName] = useState(parent.full_name);
  const [phone, setPhone] = useState(parent.phone_number ?? "");
  const [email, setEmail] = useState(parent.email);

  // Lazy-loaded data (fetched on first tab visit)
  const [feeBalances, setFeeBalances] = useState<ParentFeeBalance[] | null>(
    null,
  );
  const [notifHistory, setNotifHistory] = useState<
    ParentNotificationSummary[] | null
  >(null);
  const [dataLoading, setDataLoading] = useState(false);

  // Password reset link
  const [resetLink, setResetLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function loadChildData() {
    if (feeBalances !== null) return; // already loaded — don't re-fetch
    setDataLoading(true);
    const ids = parent.children.map((c) => c.id);
    const [fees, notifs] = await Promise.all([
      getParentFeeBalancesAction(ids),
      getParentNotificationHistoryAction(ids),
    ]);
    setFeeBalances(fees);
    setNotifHistory(notifs);
    setDataLoading(false);
  }

  function handleTabChange(t: typeof tab) {
    setTab(t);
    if (t === "children" || t === "comms") loadChildData();
  }

  // ── Actions ─────────────────────────────────────────────────────────────────

  function handleSave() {
    startTransition(async () => {
      const fd = new FormData();
      fd.set("parentId", parent.id);
      fd.set("fullName", fullName.trim());
      fd.set("phone", phone.trim());
      fd.set("email", email.trim());
      const res = await updateParentAction(fd);
      onToast(res.success ? "success" : "error", res.message);
      if (res.success) onClose();
    });
  }

  function handleDelete() {
    startTransition(async () => {
      const res = await deleteParentAction(parent.id);
      onToast(res.success ? "success" : "error", res.message);
      if (res.success) onClose();
    });
  }

  function handleResendInvite() {
    startTransition(async () => {
      const res = await resendParentInviteAction(parent.id);
      onToast(
        res.success ? "success" : "error",
        res.success ? "Invite email sent." : (res.error ?? "Failed to send."),
      );
    });
  }

  function handleResetPassword() {
    startTransition(async () => {
      const res = await resetParentPasswordAction(parent.id);
      if (res.success && res.link) {
        setResetLink(res.link);
        onToast("success", "Reset link generated.");
      } else onToast("error", res.message);
    });
  }

  function handleCopyLink() {
    if (!resetLink) return;
    navigator.clipboard.writeText(resetLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  const TABS = [
    { id: "details", label: "Details" },
    { id: "children", label: `Children (${parent.children.length})` },
    { id: "comms", label: "Comms" },
  ] as const;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/50 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div className="fixed top-0 right-0 bottom-0 z-50 w-full max-w-md bg-[#0f1220] border-l border-white/[0.08] flex flex-col">
        {/* ── Header ── */}
        <div className="sticky top-0 bg-[#0f1220] border-b border-white/[0.06] px-6 py-4 flex items-center justify-between z-10">
          <div className="flex items-center gap-3">
            <ParentAvatar name={parent.full_name} size="lg" />
            <div className="min-w-0">
              <p className="text-sm font-bold text-white truncate">
                {parent.full_name}
              </p>
              <div className="flex items-center gap-2 mt-0.5">
                {parent.invite_accepted ? (
                  <span className="flex items-center gap-1 text-[9px] font-bold text-emerald-400">
                    <CheckCircle2 className="h-2.5 w-2.5" /> Active Portal
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-[9px] font-bold text-amber-400">
                    <Clock className="h-2.5 w-2.5" /> Pending Setup
                  </span>
                )}
                <span className="text-white/20 text-[9px]">·</span>
                <span className="text-white/30 text-[9px]">
                  {parent.children.length} child
                  {parent.children.length !== 1 ? "ren" : ""}
                </span>
              </div>
            </div>
          </div>
          <button
            aria-label="Close parent drawer"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 text-white/40 hover:text-white hover:bg-white/[0.06] transition-all"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* ── Tab bar ── */}
        <div className="flex border-b border-white/[0.06] px-2 shrink-0">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => handleTabChange(t.id)}
              className={[
                "flex-1 py-3 text-xs font-semibold transition-colors",
                tab === t.id
                  ? "text-amber-400 border-b-2 border-amber-400"
                  : "text-white/35 hover:text-white/60",
              ].join(" ")}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* ── Body ── */}
        <div className="flex-1 overflow-y-auto">
          {/* DETAILS */}
          {tab === "details" && (
            <div className="p-6 space-y-5">
              <div className="space-y-3">
                <p className="text-[10px] font-bold uppercase tracking-widest text-white/30">
                  Contact Details
                </p>

                <div>
                  <label
                    htmlFor="drawer-name"
                    className="block text-[10px] font-semibold uppercase tracking-wider text-white/40 mb-1.5"
                  >
                    Full Name *
                  </label>
                  <input
                    id="drawer-name"
                    aria-label="Parent full name"
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className={INP}
                  />
                </div>

                <div>
                  <label
                    htmlFor="drawer-phone"
                    className="block text-[10px] font-semibold uppercase tracking-wider text-white/40 mb-1.5"
                  >
                    Phone{" "}
                    <span className="text-white/20 normal-case font-normal">
                      (SMS)
                    </span>
                  </label>
                  <input
                    id="drawer-phone"
                    aria-label="Parent phone number"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className={INP}
                    placeholder="+254 712 345 678"
                  />
                </div>

                <div>
                  <label
                    htmlFor="drawer-email"
                    className="block text-[10px] font-semibold uppercase tracking-wider text-white/40 mb-1.5"
                  >
                    Email{" "}
                    <span className="text-white/20 normal-case font-normal">
                      (login)
                    </span>
                  </label>
                  <input
                    id="drawer-email"
                    aria-label="Parent email address"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={INP}
                  />
                  {email !== parent.email && (
                    <p className="text-[10px] text-amber-400/70 mt-1">
                      Changing email updates their login — they must use the new
                      address.
                    </p>
                  )}
                </div>
              </div>

              {/* Read-only info strip */}
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] divide-y divide-white/[0.04]">
                {(
                  [
                    ["Registered", fmt(parent.created_at)],
                    [
                      "Last Invite",
                      parent.last_invite_sent
                        ? `${fmt(parent.last_invite_sent)} (${formatDistanceToNow(new Date(parent.last_invite_sent))} ago)`
                        : "Never sent",
                    ],
                  ] as [string, string][]
                ).map(([label, value]) => (
                  <div
                    key={label}
                    className="flex items-center gap-4 px-4 py-2.5"
                  >
                    <span className="text-[10px] text-white/30 w-24 shrink-0">
                      {label}
                    </span>
                    <span className="text-xs text-white/60 truncate">
                      {value}
                    </span>
                  </div>
                ))}
              </div>

              {/* Portal access */}
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-white/30 mb-3">
                  Portal Access
                </p>
                <div className="space-y-2">
                  {!parent.invite_accepted && (
                    <button
                      onClick={handleResendInvite}
                      disabled={isPending}
                      className="w-full flex items-center justify-center gap-2 rounded-xl border border-sky-400/25 bg-sky-400/[0.08] px-4 py-2.5 text-xs font-semibold text-sky-400 hover:bg-sky-400/15 transition-all disabled:opacity-50"
                    >
                      {isPending ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Mail className="h-3.5 w-3.5" />
                      )}
                      Resend Setup Invite
                    </button>
                  )}

                  <button
                    onClick={handleResetPassword}
                    disabled={isPending}
                    className="w-full flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-xs font-semibold text-white/60 hover:text-white hover:bg-white/[0.08] transition-all disabled:opacity-50"
                  >
                    {isPending ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <KeyRound className="h-3.5 w-3.5" />
                    )}
                    Generate Password Reset Link
                  </button>

                  {resetLink && (
                    <div className="rounded-xl border border-amber-400/20 bg-amber-400/[0.06] p-3 space-y-2">
                      <p className="text-[10px] text-amber-400/70">
                        Share with parent — expires in 24 hours.
                      </p>
                      <div className="flex gap-2">
                        <p className="flex-1 text-xs text-white/50 font-mono truncate bg-white/[0.04] rounded-lg px-2.5 py-1.5">
                          {resetLink.substring(0, 40)}…
                        </p>
                        <button
                          aria-label="Copy reset link"
                          onClick={handleCopyLink}
                          className="flex items-center gap-1.5 rounded-lg border border-amber-400/25 px-2.5 py-1.5 text-xs font-semibold text-amber-400 hover:bg-amber-400/15 transition-all"
                        >
                          {copied ? (
                            <Check className="h-3.5 w-3.5" />
                          ) : (
                            <Copy className="h-3.5 w-3.5" />
                          )}
                          {copied ? "Copied" : "Copy"}
                        </button>
                        <a
                          href={resetLink}
                          target="_blank"
                          rel="noreferrer"
                          aria-label="Open reset link in browser"
                          className="flex items-center justify-center rounded-lg border border-white/10 px-2.5 py-1.5 text-white/40 hover:text-white hover:bg-white/[0.06] transition-all"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Danger zone */}
              <div className="rounded-xl border border-rose-400/15 bg-rose-400/[0.03] p-4 space-y-3">
                <p className="text-[10px] font-bold uppercase tracking-widest text-rose-400/60">
                  Danger Zone
                </p>
                {!deleteConfirm ? (
                  <button
                    onClick={() => setDeleteConfirm(true)}
                    className="flex items-center gap-2 rounded-lg border border-rose-400/20 px-3.5 py-2 text-xs font-semibold text-rose-400/70 hover:text-rose-400 hover:bg-rose-400/10 transition-all"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Delete Parent Account
                  </button>
                ) : (
                  <div className="space-y-2">
                    <p className="text-xs text-rose-400/80">
                      Permanently deletes <strong>{parent.full_name}</strong>'s
                      account. Only allowed when they have no linked students.
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setDeleteConfirm(false)}
                        className="flex-1 rounded-lg border border-white/10 py-2 text-xs text-white/50 hover:bg-white/[0.05] transition-all"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleDelete}
                        disabled={isPending}
                        className="flex-1 rounded-lg bg-rose-500/20 border border-rose-500/30 py-2 text-xs font-bold text-rose-400 hover:bg-rose-500/30 transition-all disabled:opacity-50 flex items-center justify-center gap-1.5"
                      >
                        {isPending ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="h-3.5 w-3.5" />
                        )}
                        Confirm Delete
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* CHILDREN */}
          {tab === "children" && (
            <div className="p-6 space-y-4">
              {parent.children.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center rounded-xl border border-dashed border-white/10">
                  <Users className="h-8 w-8 text-white/15 mb-3" />
                  <p className="text-white/30 text-sm">No enrolled children</p>
                </div>
              ) : (
                parent.children.map((child) => {
                  const fee = feeBalances?.find(
                    (f) => f.student_id === child.id,
                  );
                  const photoUrl = getStudentPhotoUrl(child.photo_url);
                  return (
                    <div
                      key={child.id}
                      className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-4"
                    >
                      <div className="flex items-center gap-3 mb-3">
                        {photoUrl ? (
                          <div className="relative w-10 h-10 rounded-xl overflow-hidden shrink-0">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={photoUrl}
                              alt={child.full_name}
                              className="w-full h-full object-cover"
                            />
                          </div>
                        ) : (
                          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-xs font-bold text-white shrink-0">
                            {getStudentInitials(child.full_name)}
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-white truncate">
                            {child.full_name}
                          </p>
                          <p className="text-xs text-white/40">
                            {child.current_grade}
                          </p>
                        </div>
                        <span
                          className={[
                            "ml-auto text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border shrink-0",
                            child.status === "active"
                              ? "bg-emerald-400/10 text-emerald-400 border-emerald-400/20"
                              : "bg-rose-400/10 text-rose-400 border-rose-400/20",
                          ].join(" ")}
                        >
                          {child.status}
                        </span>
                      </div>

                      {dataLoading ? (
                        <div className="flex items-center gap-2 text-xs text-white/25">
                          <Loader2 className="h-3 w-3 animate-spin" /> Loading
                          fees…
                        </div>
                      ) : fee ? (
                        <div className="grid grid-cols-3 gap-2">
                          {(
                            [
                              ["Due", kes(fee.total_due), "text-white/50"],
                              ["Paid", kes(fee.total_paid), "text-emerald-400"],
                              [
                                "Balance",
                                fee.balance >= 0
                                  ? `+${kes(fee.balance)}`
                                  : `-${kes(fee.balance)}`,
                                fee.balance >= 0
                                  ? "text-emerald-400"
                                  : "text-rose-400",
                              ],
                            ] as [string, string, string][]
                          ).map(([label, value, color]) => (
                            <div
                              key={label}
                              className="rounded-lg bg-white/[0.04] px-2 py-1.5 text-center"
                            >
                              <p className={`text-xs font-bold ${color}`}>
                                {value}
                              </p>
                              <p className="text-[9px] text-white/25 mt-0.5">
                                {label}
                              </p>
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* COMMS */}
          {tab === "comms" && (
            <div className="p-6 space-y-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-white/30">
                Recent Notifications
              </p>
              {dataLoading ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 className="h-5 w-5 text-white/20 animate-spin" />
                </div>
              ) : !notifHistory ? (
                <button
                  onClick={loadChildData}
                  className="w-full text-center text-xs text-amber-400/60 hover:text-amber-400 py-4"
                >
                  Load notification history
                </button>
              ) : notifHistory.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center rounded-xl border border-dashed border-white/10">
                  <Bell className="h-8 w-8 text-white/15 mb-3" />
                  <p className="text-white/30 text-sm">
                    No notifications sent yet
                  </p>
                </div>
              ) : (
                notifHistory.map((n) => (
                  <div
                    key={n.id}
                    className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-4"
                  >
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <p className="text-sm font-semibold text-white leading-snug">
                        {n.title}
                      </p>
                      <span
                        className={[
                          "text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border shrink-0",
                          n.type === "warning"
                            ? "bg-amber-400/10 text-amber-400 border-amber-400/20"
                            : n.type === "success"
                              ? "bg-emerald-400/10 text-emerald-400 border-emerald-400/20"
                              : "bg-sky-400/10 text-sky-400 border-sky-400/20",
                        ].join(" ")}
                      >
                        {n.type}
                      </span>
                    </div>
                    <p className="text-xs text-white/40 line-clamp-2">
                      {n.body}
                    </p>
                    <div className="flex items-center gap-3 mt-2">
                      <span className="text-[10px] text-white/25">
                        {n.student_name}
                      </span>
                      <span className="text-white/15">·</span>
                      <span className="text-[10px] text-white/25">
                        {formatDistanceToNow(new Date(n.created_at))} ago
                      </span>
                      {!n.is_read && (
                        <span className="ml-auto text-[9px] font-bold text-rose-400">
                          Unread
                        </span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* ── Footer (Details tab only) ── */}
        {tab === "details" && (
          <div className="sticky bottom-0 bg-[#0f1220] border-t border-white/[0.06] px-6 py-4">
            <button
              onClick={handleSave}
              disabled={isPending || !fullName.trim()}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-amber-400 py-2.5 text-sm font-bold text-[#0c0f1a] hover:bg-amber-300 disabled:opacity-50 transition-all"
            >
              {isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Saving…
                </>
              ) : (
                <>
                  <Check className="h-4 w-4" /> Save Changes
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </>
  );
}
