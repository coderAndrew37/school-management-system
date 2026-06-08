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
    <div className="min-h-screen bg-[#0c0f1a] text-white">
      {/* Toast Alert Notifications */}
      {toast && (
        <div
          className={`fixed top-6 right-6 z-50 px-5 py-3.5 rounded-2xl text-xs font-black tracking-wide border uppercase shadow-2xl backdrop-blur-xl flex items-center gap-3 animate-in fade-in slide-in-from-top-4 duration-300 ${
            toast.ok 
              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400 shadow-emerald-500/5" 
              : "bg-rose-500/10 border-rose-500/30 text-rose-400 shadow-rose-500/5"
          }`}
        >
          {toast.ok ? <Check className="h-4 w-4" /> : <Clock className="h-4 w-4" />}
          {toast.msg}
        </div>
      )}

      {/* Header Pipeline Area */}
      <header className="border-b border-white/5 bg-white/[0.01] backdrop-blur-md sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-20 flex items-center gap-4">
          <Link
            href="/dashboard"
            className="h-10 w-10 rounded-xl border border-white/5 bg-white/5 flex items-center justify-center text-white/40 hover:text-white hover:border-white/10 transition-all"
          >
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <div className="h-10 w-10 rounded-xl bg-amber-400/10 border border-amber-400/20 flex items-center justify-center shrink-0">
            <Mail className="h-5 w-5 text-amber-400" />
          </div>
          <div className="flex-1">
            <p className="text-base font-black tracking-tight text-white">
              Parent Invite Management
            </p>
            <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest mt-0.5">
              {confirmed} confirmed · {pending} pending pipeline profiles
            </p>
          </div>
          {pendingSelected > 0 && (
            <button
              onClick={handleBulk}
              disabled={isPending}
              className="group flex items-center gap-2 px-5 py-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-black text-xs font-black uppercase tracking-wider transition-all disabled:opacity-20 active:scale-[0.98] shadow-xl shadow-amber-400/10"
            >
              {isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
              )}
              Send to {pendingSelected} Selected
            </button>
          )}
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        {/* Metric Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            {
              label: "Total Parents Record Base",
              value: parents.length,
              borderCls: "border-white/5 bg-white/[0.02]",
              iconCls: "text-white/20",
              textCls: "text-white",
              icon: Users,
            },
            {
              label: "System Confirmed Access",
              value: confirmed,
              borderCls: "border-emerald-500/10 bg-gradient-to-br from-emerald-500/[0.03] to-transparent",
              iconCls: "text-emerald-400/20",
              textCls: "text-emerald-400",
              icon: CheckCircle2,
            },
            {
              label: "Pending Verification",
              value: pending,
              borderCls: "border-amber-500/10 bg-gradient-to-br from-amber-500/[0.03] to-transparent",
              iconCls: "text-amber-400/20",
              textCls: "text-amber-400",
              icon: Clock,
            },
          ].map(({ label, value, borderCls, iconCls, textCls, icon: Icon }) => (
            <div
              key={label}
              className={`rounded-2xl border ${borderCls} p-5 flex items-center justify-between shadow-sm`}
            >
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.15em] text-white/30">
                  {label}
                </p>
                <p className={`text-3xl font-black mt-1.5 tracking-tight ${textCls}`}>{value}</p>
              </div>
              <div className="h-12 w-12 rounded-xl bg-white/[0.02] border border-white/5 flex items-center justify-center">
                <Icon className={`h-6 w-6 ${iconCls}`} />
              </div>
            </div>
          ))}
        </div>

        {/* Workspace Operations Action Controller Controls */}
        <div className="flex flex-col md:flex-row md:items-center gap-4 justify-between bg-white/[0.01] border border-white/5 p-4 rounded-2xl">
          <div className="flex gap-1 bg-black/40 rounded-xl border border-white/5 p-1 self-start">
            {(["all", "pending", "confirmed"] as FilterStatus[]).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`text-[10px] uppercase tracking-widest font-black px-4 py-2 rounded-lg transition-all ${
                  filter === f
                    ? "bg-amber-400 text-black shadow-lg"
                    : "text-white/40 hover:text-white hover:bg-white/5"
                }`}
              >
                {f}{" "}
                <span className={`ml-1 text-[9px] ${filter === f ? "text-black/50" : "text-white/20"}`}>
                  {f === "pending"
                    ? `(${pending})`
                    : f === "confirmed"
                      ? `(${confirmed})`
                      : `(${parents.length})`}
                </span>
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3 flex-1 md:max-w-xl w-full">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-white/20" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Filter profiles by parent name, emails, child references..."
                className="w-full pl-11 pr-4 py-3 text-xs border border-white/5 rounded-xl bg-white/[0.02] text-white placeholder-white/20 focus:outline-none focus:border-amber-400/40 focus:ring-1 focus:ring-amber-400/25 transition-all"
              />
            </div>
            
            {filtered.some((p) => !p.confirmed) && (
              <button
                onClick={toggleAll}
                className="text-[10px] whitespace-nowrap font-black uppercase tracking-widest text-amber-400/80 hover:text-amber-300 px-4 py-3 rounded-xl border border-amber-400/20 bg-amber-400/5 transition-colors"
              >
                {filtered.filter((p) => !p.confirmed).every((p) => selected.has(p.id))
                  ? "Deselect All"
                  : "Select All Pending"}
              </button>
            )}
          </div>
        </div>

        {/* Core Records Container Layout */}
        <div className="space-y-2.5">
          {filtered.length === 0 && (
            <div className="text-center py-20 bg-white/[0.01] rounded-3xl border border-white/5">
              <p className="text-4xl mb-3 opacity-30">📭</p>
              <p className="text-white/20 text-xs font-black uppercase tracking-widest">
                No matching communication data maps found
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
                className={`bg-white/[0.02] rounded-2xl border transition-all duration-200 hover:bg-white/[0.03] ${
                  p.confirmed
                    ? "border-emerald-500/10"
                    : isSelected
                      ? "border-amber-400/30 bg-amber-400/[0.01]"
                      : "border-white/5"
                }`}
              >
                <div className="flex items-center gap-4 px-5 py-4.5">
                  {/* Select Trigger Context Inputs */}
                  {!p.confirmed && (
                    <input
                      aria-label="confrim pending invites"
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelect(p.id)}
                      className="h-4 w-4 rounded border-white/10 bg-black/40 text-amber-400 focus:ring-amber-400/50 checked:bg-amber-400 cursor-pointer"
                    />
                  )}
                  {p.confirmed && (
                    <div className="h-4 w-4 flex items-center justify-center shrink-0">
                      <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                    </div>
                  )}

                  {/* Mono Font Initial Anchors */}
                  <div className="h-10 w-10 rounded-xl border border-white/5 bg-white/5 flex items-center justify-center text-xs font-black text-white/60 shrink-0 tracking-tighter">
                    {p.full_name
                      .split(" ")
                      .slice(0, 2)
                      .map((n) => n[0])
                      .join("")
                      .toUpperCase()}
                  </div>

                  {/* Core Profiling Identity Information */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-black text-white tracking-tight">
                      {p.full_name}
                    </p>
                    <p className="text-xs text-white/40 font-medium mt-0.5">{p.email}</p>
                    {p.children.length > 0 && (
                      <div className="flex items-center gap-1.5 flex-wrap mt-2">
                        {p.children.map((c) => (
                          <span 
                            key={c.id} 
                            className="text-[9px] font-bold uppercase tracking-wider bg-white/5 border border-white/5 text-white/50 px-2 py-0.5 rounded"
                          >
                            {c.full_name} ({c.current_grade})
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Time Matrix Synchronization Identifiers */}
                  <div className="text-right shrink-0 px-2">
                    {p.confirmed ? (
                      <span className="text-[9px] font-black tracking-widest uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-md">
                        Active
                      </span>
                    ) : (
                      <span className="text-[9px] font-black tracking-widest uppercase bg-amber-500/10 text-amber-500 border border-amber-500/20 px-2 py-0.5 rounded-md">
                        Pending
                      </span>
                    )}
                    <p className="text-[9px] font-bold text-white/30 tracking-tight mt-2 flex items-center justify-end gap-1">
                      <Clock className="h-2.5 w-2.5 text-white/20" />
                      Sent: {timeSince(p.last_invite_sent)}
                    </p>
                  </div>

                  {/* Single Channel Execution Dispatches */}
                  {!p.confirmed && (
                    <button
                      onClick={() => handleSingle(p.id)}
                      disabled={isSending || isPending}
                      className={`flex items-center justify-center gap-1.5 h-9 px-4 rounded-xl text-xs font-black uppercase tracking-wider transition-all disabled:opacity-20 ${
                        isDone
                          ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                          : "bg-white/5 border border-white/10 text-white hover:bg-white/10 hover:border-white/20"
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
                          <RefreshCw className="h-3.5 w-3.5 text-white/40" /> Resend
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