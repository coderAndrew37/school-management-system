"use client";

// app/admin/invites/_components/BulkInviteClient.tsx

import type { ParentInviteRow } from "@/lib/actions/bulk-invite";
import {
  bulkResendInvitesAction,
  resendParentInviteAction,
} from "@/lib/actions/bulk-invite";
import {
  Check,
  CheckCircle2,
  ChevronLeft,
  Clock,
  Loader2,
  Mail,
  RefreshCw,
  Search,
  Send,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState, useTransition } from "react";

interface Props {
  parents: ParentInviteRow[];
}

type FilterStatus = "all" | "pending" | "confirmed";

function timeSince(iso: string | null): string {
  if (!iso) return "Never";
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor(diff / 3600000);
  if (days > 30) return `${Math.floor(days / 30)}mo ago`;
  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  return "Just now";
}

export function BulkInviteClient({ parents }: Props) {
  const [filter, setFilter] = useState<FilterStatus>("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [sending, setSending] = useState<Set<string>>(new Set());
  const [done, setDone] = useState<Set<string>>(new Set());
  const [isPending, startTrans] = useTransition();

  function showToast(msg: string, ok: boolean) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 4000);
  }

  const filtered = useMemo(() => {
    return parents.filter((p) => {
      const matchStatus =
        filter === "all"
          ? true
          : filter === "confirmed"
            ? p.confirmed
            : !p.confirmed;
      const q = search.toLowerCase();
      const matchSearch =
        !q ||
        p.full_name.toLowerCase().includes(q) ||
        p.email.toLowerCase().includes(q) ||
        p.children.some((c) => c.full_name.toLowerCase().includes(q));
      return matchStatus && matchSearch;
    });
  }, [parents, filter, search]);

  const pending = parents.filter((p) => !p.confirmed).length;
  const confirmed = parents.filter((p) => p.confirmed).length;

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleAll() {
    const pendingIds = filtered.filter((p) => !p.confirmed).map((p) => p.id);
    if (pendingIds.every((id) => selected.has(id))) {
      setSelected((prev) => {
        const next = new Set(prev);
        pendingIds.forEach((id) => next.delete(id));
        return next;
      });
    } else {
      setSelected((prev) => {
        const next = new Set(prev);
        pendingIds.forEach((id) => next.add(id));
        return next;
      });
    }
  }

  function handleSingle(parentId: string) {
    setSending((s) => new Set(s).add(parentId));
    startTrans(async () => {
      const result = await resendParentInviteAction(parentId);
      setSending((s) => {
        const n = new Set(s);
        n.delete(parentId);
        return n;
      });
      if (result.success) {
        setDone((d) => new Set(d).add(parentId));
        showToast("Invite sent successfully", true);
      } else {
        showToast(result.error ?? "Failed to send", false);
      }
    });
  }

  function handleBulk() {
    const ids = Array.from(selected).filter((id) => {
      const p = parents.find((p) => p.id === id);
      return p && !p.confirmed;
    });
    if (ids.length === 0) return;

    ids.forEach((id) => setSending((s) => new Set(s).add(id)));
    startTrans(async () => {
      const result = await bulkResendInvitesAction(ids);
      ids.forEach((id) => {
        setSending((s) => {
          const n = new Set(s);
          n.delete(id);
          return n;
        });
        setDone((d) => new Set(d).add(id));
      });
      setSelected(new Set());
      if (result.success) {
        showToast(`${result.sent} invites sent successfully`, true);
      } else {
        showToast(`${result.sent} sent, ${result.failed} failed`, false);
      }
    });
  }

  const pendingSelected = Array.from(selected).filter(
    (id) => !parents.find((p) => p.id === id)?.confirmed,
  ).length;

  return (
    <div className="min-h-screen bg-[#f5f6fa]">
      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl text-sm font-bold shadow-lg flex items-center gap-2 ${
            toast.ok ? "bg-emerald-600 text-white" : "bg-rose-500 text-white"
          }`}
        >
          {toast.ok && <Check className="h-4 w-4" />}
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-14 flex items-center gap-3">
          <Link
            href="/admin/dashboard"
            className="text-slate-400 hover:text-slate-600"
          >
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <Mail className="h-5 w-5 text-violet-500 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-black text-slate-800">
              Parent Invite Management
            </p>
            <p className="text-[10px] text-slate-400 font-semibold">
              {confirmed} confirmed · {pending} pending
            </p>
          </div>
          {pendingSelected > 0 && (
            <button
              onClick={handleBulk}
              disabled={isPending}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold transition-colors disabled:opacity-50"
            >
              {isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Send className="h-3.5 w-3.5" />
              )}
              Send to {pendingSelected} selected
            </button>
          )}
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-5 space-y-4">
        {/* Stat cards */}
        <div className="grid grid-cols-3 gap-3">
          {[
            {
              label: "Total Parents",
              value: parents.length,
              cls: "text-slate-800",
              icon: Users,
            },
            {
              label: "Confirmed",
              value: confirmed,
              cls: "text-emerald-600",
              icon: CheckCircle2,
            },
            {
              label: "Pending Invite",
              value: pending,
              cls: pending > 0 ? "text-amber-600" : "text-slate-400",
              icon: Clock,
            },
          ].map(({ label, value, cls, icon: Icon }) => (
            <div
              key={label}
              className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm flex items-center gap-3"
            >
              <Icon className={`h-8 w-8 ${cls} opacity-20`} />
              <div>
                <p className={`text-2xl font-black ${cls}`}>{value}</p>
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                  {label}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Filters + search */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex gap-1.5 bg-white rounded-xl border border-slate-200 p-1">
            {(["all", "pending", "confirmed"] as FilterStatus[]).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`text-xs font-bold px-3 py-1.5 rounded-lg capitalize transition-all ${
                  filter === f
                    ? "bg-violet-600 text-white shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                {f}{" "}
                {f === "pending"
                  ? `(${pending})`
                  : f === "confirmed"
                    ? `(${confirmed})`
                    : `(${parents.length})`}
              </button>
            ))}
          </div>
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, email, child…"
              className="w-full pl-8 pr-3 py-2 text-xs border border-slate-200 rounded-xl bg-white text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-400"
            />
          </div>
          {/* Select all pending */}
          {filtered.some((p) => !p.confirmed) && (
            <button
              onClick={toggleAll}
              className="text-xs font-bold text-violet-600 hover:text-violet-700 px-3 py-2 rounded-xl border border-violet-200 bg-violet-50 transition-colors"
            >
              {filtered
                .filter((p) => !p.confirmed)
                .every((p) => selected.has(p.id))
                ? "Deselect all pending"
                : "Select all pending"}
            </button>
          )}
        </div>

        {/* Parent list */}
        <div className="space-y-2">
          {filtered.length === 0 && (
            <div className="text-center py-16 bg-white rounded-2xl border border-slate-200">
              <p className="text-3xl mb-2">📭</p>
              <p className="text-slate-500 font-semibold">
                No parents match this filter
              </p>
            </div>
          )}
          {filtered.map((p) => {
            const isSending = sending.has(p.id);
            const isDone = done.has(p.id);
            const isSelected = selected.has(p.id);

            return (
              <div
                key={p.id}
                className={`bg-white rounded-2xl border shadow-sm transition-all ${
                  p.confirmed
                    ? "border-emerald-200"
                    : isSelected
                      ? "border-violet-300"
                      : "border-slate-200"
                }`}
              >
                <div className="flex items-center gap-3 px-4 py-3.5">
                  {/* Checkbox — only for pending */}
                  {!p.confirmed && (
                    <input
                      aria-label="confrim pending invites"
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelect(p.id)}
                      className="h-4 w-4 rounded border-slate-300 text-violet-600 focus:ring-violet-400 cursor-pointer"
                    />
                  )}
                  {p.confirmed && (
                    <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                  )}

                  {/* Avatar */}
                  <div className="h-9 w-9 rounded-xl bg-slate-100 flex items-center justify-center text-xs font-black text-slate-600 shrink-0">
                    {p.full_name
                      .split(" ")
                      .slice(0, 2)
                      .map((n) => n[0])
                      .join("")
                      .toUpperCase()}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-800">
                      {p.full_name}
                    </p>
                    <p className="text-[10px] text-slate-400">{p.email}</p>
                    {p.children.length > 0 && (
                      <p className="text-[10px] text-slate-500 mt-0.5">
                        {p.children
                          .map((c) => `${c.full_name} (${c.current_grade})`)
                          .join(" · ")}
                      </p>
                    )}
                  </div>

                  {/* Status + last sent */}
                  <div className="text-right shrink-0">
                    {p.confirmed ? (
                      <span className="text-[10px] font-black bg-emerald-50 text-emerald-600 border border-emerald-200 px-2 py-0.5 rounded-lg">
                        ✓ Active
                      </span>
                    ) : (
                      <span className="text-[10px] font-black bg-amber-50 text-amber-600 border border-amber-200 px-2 py-0.5 rounded-lg">
                        Pending
                      </span>
                    )}
                    <p className="text-[9px] text-slate-400 mt-1">
                      Sent: {timeSince(p.last_invite_sent)}
                    </p>
                  </div>

                  {/* Resend button — only for pending */}
                  {!p.confirmed && (
                    <button
                      onClick={() => handleSingle(p.id)}
                      disabled={isSending || isPending}
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all disabled:opacity-50 ${
                        isDone
                          ? "bg-emerald-50 text-emerald-600 border border-emerald-200"
                          : "bg-violet-600 hover:bg-violet-700 text-white"
                      }`}
                    >
                      {isSending ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : isDone ? (
                        <>
                          <Check className="h-3.5 w-3.5" /> Sent
                        </>
                      ) : (
                        <>
                          <RefreshCw className="h-3.5 w-3.5" /> Resend
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
