"use client";

import { markNotificationsReadAction } from "@/lib/actions/parent";
import type { StudentNotification, NotificationType } from "@/lib/types/parent";
import {
  Bell,
  BellOff,
  CheckCheck,
  Clock,
  UserX,
  BookOpen,
  MessageSquare,
  BarChart2,
  Megaphone,
  CreditCard,
} from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

// ── Per-type config — maps to prototype badge colours ─────────────────────────
const TYPE_CFG: Record<
  NotificationType,
  {
    icon: React.ReactNode;
    label: string;
    dot: string; // unread indicator colour
    rowBg: string; // unread row tint
    iconBg: string;
    iconText: string;
    pill: string;
  }
> = {
  attendance_absent: {
    icon: <UserX className="h-4 w-4" />,
    label: "Absent",
    dot: "bg-red-500",
    rowBg: "bg-red-50",
    iconBg: "bg-red-100",
    iconText: "text-red-700",
    pill: "bg-red-100 text-red-700 border-red-200",
  },
  attendance_late: {
    icon: <Clock className="h-4 w-4" />,
    label: "Late",
    dot: "bg-amber-500",
    rowBg: "bg-amber-50",
    iconBg: "bg-amber-100",
    iconText: "text-amber-700",
    pill: "bg-amber-100 text-amber-700 border-amber-200",
  },
  diary_entry: {
    icon: <BookOpen className="h-4 w-4" />,
    label: "Diary",
    dot: "bg-cyan-500",
    rowBg: "bg-cyan-50",
    iconBg: "bg-cyan-100",
    iconText: "text-cyan-700",
    pill: "bg-cyan-100 text-cyan-700 border-cyan-200",
  },
  communication_received: {
    icon: <MessageSquare className="h-4 w-4" />,
    label: "Message",
    dot: "bg-purple-500",
    rowBg: "bg-purple-50",
    iconBg: "bg-purple-100",
    iconText: "text-purple-700",
    pill: "bg-purple-100 text-purple-700 border-purple-200",
  },
  assessment_result: {
    icon: <BarChart2 className="h-4 w-4" />,
    label: "Result",
    dot: "bg-emerald-500",
    rowBg: "bg-emerald-50",
    iconBg: "bg-emerald-100",
    iconText: "text-emerald-700",
    pill: "bg-emerald-100 text-emerald-700 border-emerald-200",
  },
  announcement: {
    icon: <Megaphone className="h-4 w-4" />,
    label: "Notice",
    dot: "bg-blue-500",
    rowBg: "bg-blue-50",
    iconBg: "bg-blue-100",
    iconText: "text-blue-700",
    pill: "bg-blue-100 text-blue-700 border-blue-200",
  },
  fee_reminder: {
    icon: <CreditCard className="h-4 w-4" />,
    label: "Fee",
    dot: "bg-red-500",
    rowBg: "bg-red-50",
    iconBg: "bg-red-100",
    iconText: "text-red-700",
    pill: "bg-red-100 text-red-700 border-red-200",
  },
};

function relativeTime(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(ts).toLocaleDateString("en-KE", {
    day: "numeric",
    month: "short",
  });
}

const FILTERS = ["All", "Unread", "Attendance", "Academic", "Fee"] as const;
type Filter = (typeof FILTERS)[number];

function matchFilter(
  n: StudentNotification,
  f: Filter,
  isRead: boolean,
): boolean {
  if (f === "Unread") return !isRead;
  if (f === "Attendance") return n.type.startsWith("attendance");
  if (f === "Academic")
    return n.type === "diary_entry" || n.type === "assessment_result";
  if (f === "Fee") return n.type === "fee_reminder";
  return true;
}

interface Props {
  notifications: StudentNotification[];
  studentId: string;
}

export function NotificationsPanel({ notifications, studentId }: Props) {
  const [localRead, setLocalRead] = useState<Set<string>>(
    new Set(notifications.filter((n) => n.is_read).map((n) => n.id)),
  );
  const [isPending, startTransition] = useTransition();
  const [filter, setFilter] = useState<Filter>("All");

  const unread = notifications.filter((n) => !localRead.has(n.id)).length;
  const visible = notifications.filter((n) =>
    matchFilter(n, filter, localRead.has(n.id)),
  );

  const markAll = () => {
    startTransition(async () => {
      const res = await markNotificationsReadAction(studentId);
      if (res.success) {
        setLocalRead(new Set(notifications.map((n) => n.id)));
        toast.success("All marked as read");
      }
    });
  };

  if (notifications.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 py-16 text-center">
        <BellOff className="h-10 w-10 text-slate-300 mb-3" />
        <p className="font-bold text-slate-600">No notifications yet</p>
        <p className="mt-1 text-xs text-slate-400 max-w-[220px] leading-relaxed">
          Attendance alerts, messages and results will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-50 border border-blue-100">
            <Bell className="h-4 w-4 text-blue-600" />
          </div>
          <span className="text-sm font-bold text-slate-600">
            {unread > 0 ? (
              <>
                <span className="text-slate-900">{unread}</span> unread
              </>
            ) : (
              "All caught up"
            )}
          </span>
        </div>
        {unread > 0 && (
          <button
            onClick={markAll}
            disabled={isPending}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-500 transition hover:border-blue-300 hover:text-blue-600 hover:bg-blue-50 active:scale-95 disabled:opacity-40 shadow-sm"
          >
            <CheckCheck className="h-3.5 w-3.5" />
            Mark all read
          </button>
        )}
      </div>

      {/* ── Filter pills — .docket-tab style ───────────────────────────────── */}
      <div className="flex gap-2 overflow-x-auto pb-0.5 scrollbar-none">
        {FILTERS.map((f) => {
          const cnt =
            f === "All"
              ? notifications.length
              : notifications.filter((n) =>
                  matchFilter(n, f, localRead.has(n.id)),
                ).length;
          const on = filter === f;
          return (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={[
                "flex-shrink-0 flex items-center gap-1.5 rounded-full border px-4 py-1.5 text-xs font-bold transition-all active:scale-95",
                on
                  ? "border-blue-600 bg-blue-600 text-white shadow-md shadow-blue-200"
                  : "border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:text-slate-700",
              ].join(" ")}
            >
              {f}
              {cnt > 0 && (
                <span
                  className={`rounded-full px-1.5 py-px text-[9px] font-black ${on ? "bg-white/25 text-white" : "bg-slate-100 text-slate-500"}`}
                >
                  {cnt}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── List ────────────────────────────────────────────────────────────── */}
      {visible.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-slate-200 py-10 text-center">
          <p className="text-xs font-semibold text-slate-400">Nothing here</p>
        </div>
      ) : (
        <div className="space-y-2">
          {visible.map((n) => {
            const cfg = TYPE_CFG[n.type];
            const isRead = localRead.has(n.id);
            return (
              <div
                key={n.id}
                className={[
                  "flex items-start gap-3 rounded-2xl border px-4 py-3.5 transition-colors",
                  isRead
                    ? "border-slate-100 bg-white"
                    : `border-slate-200 ${cfg.rowBg}`,
                ].join(" ")}
              >
                {/* Icon */}
                <div
                  className={[
                    "mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl border",
                    isRead
                      ? "border-slate-200 bg-slate-50 text-slate-400"
                      : `border-transparent ${cfg.iconBg} ${cfg.iconText}`,
                  ].join(" ")}
                >
                  {cfg.icon}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 mb-0.5">
                    <p
                      className={`text-sm font-bold leading-snug ${isRead ? "text-slate-500" : "text-slate-800"}`}
                    >
                      {n.title}
                    </p>
                    {!isRead && (
                      <span
                        className={`mt-1.5 h-2 w-2 flex-shrink-0 rounded-full ${cfg.dot}`}
                      />
                    )}
                  </div>
                  <p
                    className={`text-xs leading-relaxed ${isRead ? "text-slate-400" : "text-slate-600"}`}
                  >
                    {n.body}
                  </p>
                  <div className="mt-2 flex items-center gap-2 flex-wrap">
                    <span
                      className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${cfg.pill}`}
                    >
                      {cfg.label}
                    </span>
                    <span className="flex items-center gap-1 text-[10px] font-semibold text-slate-400">
                      <Clock className="h-3 w-3" />
                      {relativeTime(n.created_at)}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
