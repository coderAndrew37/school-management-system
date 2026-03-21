"use client";

// app/admin/notifications/NotificationsClient.tsx
// Three-tab view: Delivery Log | Broadcasts | In-App Bell Notifications

import { useState, useMemo } from "react";
import {
  Bell,
  CheckCircle2,
  Clock,
  Mail,
  MessageSquare,
  Search,
  Users,
  XCircle,
  X,
  ChevronDown,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface ParentNotif {
  id: string;
  type: string; // "absence" | "report_ready" | "fee_reminder" etc
  channel: string; // "sms" | "email"
  status: string; // "sent" | "failed" | "delivered"
  subject: string | null;
  body: string;
  created_at: string;
  parents: {
    id: string;
    full_name: string;
    phone_number: string | null;
    email: string;
  } | null;
}

interface CommsLogEntry {
  id: string;
  audience_type: string;
  audience_label: string;
  subject: string;
  body_preview: string;
  recipient_count: number;
  status: string;
  channel: string;
  sent_at: string | null;
  created_at: string;
}

interface InAppNotif {
  id: string;
  type: string;
  title: string;
  body: string;
  is_read: boolean;
  created_at: string;
  students: { id: string; full_name: string; current_grade: string } | null;
}

interface Props {
  parentNotifs: ParentNotif[];
  commsLog: CommsLogEntry[];
  inAppNotifs: InAppNotif[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString("en-KE", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function relTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(mins / 60);
  const days = Math.floor(hours / 24);
  if (mins < 2) return "just now";
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return fmt(iso);
}

const TYPE_LABELS: Record<string, string> = {
  absence: "Absence Alert",
  report_ready: "Report Ready",
  fee_reminder: "Fee Reminder",
  fee_overdue: "Fee Overdue",
  general: "General",
};

const STATUS_STYLE: Record<string, string> = {
  sent: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20",
  delivered: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20",
  failed: "text-rose-400    bg-rose-400/10    border-rose-400/20",
  scheduled: "text-amber-400  bg-amber-400/10   border-amber-400/20",
};

const CHANNEL_ICON = {
  sms: <MessageSquare className="h-3.5 w-3.5" />,
  email: <Mail className="h-3.5 w-3.5" />,
};

// ── Delivery log row ──────────────────────────────────────────────────────────

function DeliveryRow({ n }: { n: ParentNotif }) {
  const [open, setOpen] = useState(false);
  const statusCls = STATUS_STYLE[n.status] ?? STATUS_STYLE.sent;
  const typeLabel = TYPE_LABELS[n.type] ?? n.type;

  return (
    <div
      className={`rounded-xl border transition-all ${open ? "border-white/[0.10] bg-white/[0.04]" : "border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.03]"}`}
    >
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left"
      >
        <span
          className={`text-white/40 shrink-0 ${n.channel === "sms" ? "text-sky-400/70" : "text-amber-400/70"}`}
        >
          {CHANNEL_ICON[n.channel as keyof typeof CHANNEL_ICON] ?? (
            <Bell className="h-3.5 w-3.5" />
          )}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold text-white/70">
              {n.parents?.full_name ?? "Unknown"}
            </span>
            <span className="text-[10px] text-white/30">{typeLabel}</span>
          </div>
          <p className="text-[11px] text-white/35 truncate mt-0.5">
            {n.subject ?? n.body.slice(0, 80)}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span
            className={`text-[9px] font-bold uppercase border px-2 py-0.5 rounded-lg ${statusCls}`}
          >
            {n.status}
          </span>
          <span className="text-[10px] text-white/20">
            {relTime(n.created_at)}
          </span>
          <ChevronDown
            className={`h-3.5 w-3.5 text-white/20 transition-transform ${open ? "rotate-180" : ""}`}
          />
        </div>
      </button>
      {open && (
        <div className="px-4 pb-4 pt-1 border-t border-white/[0.05] space-y-2">
          <div className="grid grid-cols-2 gap-3 text-[11px]">
            <div>
              <span className="text-white/25">To: </span>
              <span className="text-white/55">{n.parents?.full_name}</span>
            </div>
            <div>
              <span className="text-white/25">Via: </span>
              <span className="text-white/55 uppercase">{n.channel}</span>
            </div>
            <div>
              <span className="text-white/25">Phone: </span>
              <span className="text-white/55 font-mono">
                {n.parents?.phone_number ?? "—"}
              </span>
            </div>
            <div>
              <span className="text-white/25">Email: </span>
              <span className="text-white/55 truncate">
                {n.parents?.email ?? "—"}
              </span>
            </div>
            <div>
              <span className="text-white/25">Sent: </span>
              <span className="text-white/55">{fmt(n.created_at)}</span>
            </div>
            <div>
              <span className="text-white/25">Status: </span>
              <span
                className={`font-bold ${n.status === "failed" ? "text-rose-400" : "text-emerald-400"}`}
              >
                {n.status}
              </span>
            </div>
          </div>
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5">
            <p className="text-[10px] text-white/25 uppercase tracking-wider mb-1">
              Message
            </p>
            <p className="text-xs text-white/50 leading-relaxed whitespace-pre-wrap">
              {n.body}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Comms log row ─────────────────────────────────────────────────────────────

function CommsRow({ e }: { e: CommsLogEntry }) {
  const [open, setOpen] = useState(false);
  const statusCls = STATUS_STYLE[e.status] ?? STATUS_STYLE.sent;

  return (
    <div
      className={`rounded-xl border transition-all ${open ? "border-white/[0.10] bg-white/[0.04]" : "border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.03]"}`}
    >
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left"
      >
        <span
          className={`shrink-0 ${e.channel === "sms" ? "text-sky-400/70" : "text-amber-400/70"}`}
        >
          {CHANNEL_ICON[e.channel as keyof typeof CHANNEL_ICON] ?? (
            <Bell className="h-3.5 w-3.5" />
          )}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-white/70 truncate">
            {e.channel === "sms" ? "(SMS)" : e.subject}
          </p>
          <p className="text-[11px] text-white/35 truncate mt-0.5">
            To: {e.audience_label} · {e.recipient_count} recipient
            {e.recipient_count !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span
            className={`text-[9px] font-bold uppercase border px-2 py-0.5 rounded-lg ${statusCls}`}
          >
            {e.status}
          </span>
          <span className="text-[10px] text-white/20">
            {relTime(e.created_at)}
          </span>
          <ChevronDown
            className={`h-3.5 w-3.5 text-white/20 transition-transform ${open ? "rotate-180" : ""}`}
          />
        </div>
      </button>
      {open && (
        <div className="px-4 pb-4 pt-1 border-t border-white/[0.05] space-y-2">
          <div className="grid grid-cols-2 gap-3 text-[11px]">
            <div>
              <span className="text-white/25">Audience: </span>
              <span className="text-white/55">{e.audience_label}</span>
            </div>
            <div>
              <span className="text-white/25">Channel: </span>
              <span className="text-white/55 uppercase">{e.channel}</span>
            </div>
            <div>
              <span className="text-white/25">Recipients: </span>
              <span className="text-white/55">{e.recipient_count}</span>
            </div>
            <div>
              <span className="text-white/25">Sent: </span>
              <span className="text-white/55">
                {e.sent_at ? fmt(e.sent_at) : "Scheduled"}
              </span>
            </div>
          </div>
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5">
            <p className="text-[10px] text-white/25 uppercase tracking-wider mb-1">
              Preview
            </p>
            <p className="text-xs text-white/50 leading-relaxed">
              {e.body_preview}
              {e.body_preview.length >= 120 ? "…" : ""}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// ── In-app notification row ───────────────────────────────────────────────────

function InAppRow({ n }: { n: InAppNotif }) {
  return (
    <div
      className={`rounded-xl border px-4 py-3 flex items-start gap-3 transition-all ${
        n.is_read
          ? "border-white/[0.05] bg-white/[0.01]"
          : "border-amber-400/15 bg-amber-400/[0.03]"
      }`}
    >
      <div
        className={`mt-0.5 h-2 w-2 rounded-full shrink-0 ${n.is_read ? "bg-white/15" : "bg-amber-400"}`}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-xs font-semibold text-white/70">{n.title}</p>
            {n.students && (
              <p className="text-[10px] text-white/35 mt-0.5">
                {n.students.full_name} · {n.students.current_grade}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span
              className={`text-[9px] font-bold border px-2 py-0.5 rounded-lg ${
                n.is_read
                  ? "text-white/25 bg-white/[0.04] border-white/[0.06]"
                  : "text-amber-400 bg-amber-400/10 border-amber-400/20"
              }`}
            >
              {n.is_read ? "Read" : "Unread"}
            </span>
            <span className="text-[10px] text-white/20">
              {relTime(n.created_at)}
            </span>
          </div>
        </div>
        <p className="text-[11px] text-white/40 mt-1 leading-relaxed line-clamp-2">
          {n.body}
        </p>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function NotificationsClient({
  parentNotifs,
  commsLog,
  inAppNotifs,
}: Props) {
  const [tab, setTab] = useState<"delivery" | "broadcasts" | "inapp">(
    "delivery",
  );
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");

  const deliveryFiltered = useMemo(() => {
    let r = parentNotifs;
    if (typeFilter) r = r.filter((n) => n.type === typeFilter);
    if (search) {
      const q = search.toLowerCase();
      r = r.filter(
        (n) =>
          (n.parents?.full_name ?? "").toLowerCase().includes(q) ||
          (n.subject ?? "").toLowerCase().includes(q) ||
          n.body.toLowerCase().includes(q),
      );
    }
    return r;
  }, [parentNotifs, search, typeFilter]);

  const commsFiltered = useMemo(() => {
    if (!search) return commsLog;
    const q = search.toLowerCase();
    return commsLog.filter(
      (e) =>
        e.subject.toLowerCase().includes(q) ||
        e.audience_label.toLowerCase().includes(q) ||
        e.body_preview.toLowerCase().includes(q),
    );
  }, [commsLog, search]);

  const inappFiltered = useMemo(() => {
    if (!search) return inAppNotifs;
    const q = search.toLowerCase();
    return inAppNotifs.filter(
      (n) =>
        n.title.toLowerCase().includes(q) ||
        n.body.toLowerCase().includes(q) ||
        (n.students?.full_name ?? "").toLowerCase().includes(q),
    );
  }, [inAppNotifs, search]);

  const unreadCount = inAppNotifs.filter((n) => !n.is_read).length;
  const failedCount = parentNotifs.filter((n) => n.status === "failed").length;

  const TABS = [
    {
      key: "delivery",
      label: "Delivery Log",
      count: parentNotifs.length,
      warn: failedCount,
    },
    { key: "broadcasts", label: "Broadcasts", count: commsLog.length, warn: 0 },
    {
      key: "inapp",
      label: "In-App Alerts",
      count: inAppNotifs.length,
      warn: unreadCount,
    },
  ] as const;

  const uniqueTypes = [...new Set(parentNotifs.map((n) => n.type))].filter(
    Boolean,
  );

  return (
    <div className="space-y-5">
      {/* Tabs + search */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <div className="flex rounded-xl border border-white/[0.07] bg-white/[0.02] p-1 flex-wrap">
          {TABS.map(({ key, label, count, warn }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-semibold transition-all ${
                tab === key
                  ? "bg-white/[0.08] text-white"
                  : "text-white/30 hover:text-white/60"
              }`}
            >
              {label}
              <span
                className={`text-[9px] font-bold rounded-full px-1.5 min-w-[18px] text-center py-0.5 ${
                  warn > 0
                    ? "bg-rose-400/15 text-rose-400"
                    : tab === key
                      ? "bg-white/10 text-white/50"
                      : "bg-white/[0.04] text-white/25"
                }`}
              >
                {warn > 0 ? warn : count}
              </span>
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/20 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search notifications…"
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl pl-8 pr-8 py-2 text-sm text-white placeholder-white/20 outline-none focus:border-sky-400/30 transition-all"
            />
            {search && (
              <button
                aria-label="search notification"
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/25 hover:text-white/50"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {tab === "delivery" && uniqueTypes.length > 1 && (
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2 text-sm text-white/60 outline-none focus:border-sky-400/30 transition-all cursor-pointer appearance-none"
              aria-label="filter by type"
            >
              <option value="" className="bg-[#0c0f1a]">
                All types
              </option>
              {uniqueTypes.map((t) => (
                <option key={t} value={t} className="bg-[#0c0f1a]">
                  {TYPE_LABELS[t] ?? t}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Summary bar */}
      {(failedCount > 0 || unreadCount > 0) && (
        <div className="flex items-center gap-3 flex-wrap">
          {failedCount > 0 && (
            <div className="flex items-center gap-2 rounded-xl border border-rose-400/25 bg-rose-400/[0.06] px-4 py-2.5">
              <XCircle className="h-4 w-4 text-rose-400 shrink-0" />
              <p className="text-xs font-semibold text-rose-400">
                {failedCount} failed delivery{failedCount !== 1 ? "ies" : ""} —
                check AT/Resend credentials
              </p>
            </div>
          )}
          {unreadCount > 0 && (
            <div className="flex items-center gap-2 rounded-xl border border-amber-400/25 bg-amber-400/[0.06] px-4 py-2.5">
              <Bell className="h-4 w-4 text-amber-400 shrink-0" />
              <p className="text-xs font-semibold text-amber-400">
                {unreadCount} unread in-app notification
                {unreadCount !== 1 ? "s" : ""} (not yet seen by parents)
              </p>
            </div>
          )}
        </div>
      )}

      {/* Tab content */}

      {/* ── Delivery log ── */}
      {tab === "delivery" && (
        <div className="space-y-2">
          {deliveryFiltered.length === 0 ? (
            <div className="flex flex-col items-center py-20 rounded-2xl border border-dashed border-white/[0.07] text-center">
              <Bell className="h-8 w-8 text-white/15 mb-3" />
              <p className="text-white/30 text-sm">No delivery records found</p>
              <p className="text-white/20 text-xs mt-1">
                System-generated SMS/email notifications will appear here
              </p>
            </div>
          ) : (
            <>
              <p className="text-[11px] text-white/25 font-mono pb-1">
                {deliveryFiltered.length} record
                {deliveryFiltered.length !== 1 ? "s" : ""}
                {(search || typeFilter) && " · filtered"}
              </p>
              {deliveryFiltered.map((n) => (
                <DeliveryRow key={n.id} n={n} />
              ))}
            </>
          )}
        </div>
      )}

      {/* ── Broadcasts ── */}
      {tab === "broadcasts" && (
        <div className="space-y-2">
          {commsFiltered.length === 0 ? (
            <div className="flex flex-col items-center py-20 rounded-2xl border border-dashed border-white/[0.07] text-center">
              <Users className="h-8 w-8 text-white/15 mb-3" />
              <p className="text-white/30 text-sm">No broadcasts sent yet</p>
              <p className="text-white/20 text-xs mt-1">
                Emails and SMS sent from the{" "}
                <a
                  href="/admin/communications"
                  className="text-amber-400/70 hover:text-amber-400 underline underline-offset-2"
                >
                  Communications page
                </a>{" "}
                will appear here
              </p>
            </div>
          ) : (
            <>
              <p className="text-[11px] text-white/25 font-mono pb-1">
                {commsFiltered.length} broadcast
                {commsFiltered.length !== 1 ? "s" : ""}
              </p>
              {commsFiltered.map((e) => (
                <CommsRow key={e.id} e={e} />
              ))}
            </>
          )}
        </div>
      )}

      {/* ── In-app ── */}
      {tab === "inapp" && (
        <div className="space-y-2">
          {inappFiltered.length === 0 ? (
            <div className="flex flex-col items-center py-20 rounded-2xl border border-dashed border-white/[0.07] text-center">
              <CheckCircle2 className="h-8 w-8 text-white/15 mb-3" />
              <p className="text-white/30 text-sm">
                No in-app notifications yet
              </p>
              <p className="text-white/20 text-xs mt-1">
                Absence alerts and other teacher-sent bell notifications appear
                here
              </p>
            </div>
          ) : (
            <>
              <p className="text-[11px] text-white/25 font-mono pb-1">
                {inappFiltered.length} notification
                {inappFiltered.length !== 1 ? "s" : ""}
                {unreadCount > 0 && ` · ${unreadCount} unread`}
              </p>
              {inappFiltered.map((n) => (
                <InAppRow key={n.id} n={n} />
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
