"use client";

import { markNotificationsReadAction } from "@/lib/actions/parent";
import type { StudentNotification } from "@/lib/types/parent";
import { NOTIF_STYLE } from "@/lib/types/parent";
import { Bell, CheckCheck, Clock } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

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

interface Props {
  notifications: StudentNotification[];
  studentId: string;
}

export function NotificationsPanel({ notifications, studentId }: Props) {
  const [localRead, setLocalRead] = useState<Set<string>>(
    new Set(notifications.filter((n) => n.is_read).map((n) => n.id)),
  );
  const [isPending, startTransition] = useTransition();

  const unreadCount = notifications.filter((n) => !localRead.has(n.id)).length;

  const handleMarkAllRead = () => {
    startTransition(async () => {
      const res = await markNotificationsReadAction(studentId);
      if (res.success) {
        setLocalRead(new Set(notifications.map((n) => n.id)));
        toast.success("All notifications marked as read");
      }
    });
  };

  if (notifications.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-white/10 py-16 text-center">
        <p className="text-3xl mb-2">🔔</p>
        <p className="text-sm text-white/40">No notifications yet</p>
        <p className="text-xs text-white/25 mt-1">
          Attendance alerts, diary posts, and messages will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bell className="h-4 w-4 text-white/40" />
          {unreadCount > 0 ? (
            <span className="text-xs text-white/60">{unreadCount} unread</span>
          ) : (
            <span className="text-xs text-white/30">All caught up</span>
          )}
        </div>
        {unreadCount > 0 && (
          <button
            onClick={handleMarkAllRead}
            disabled={isPending}
            className="flex items-center gap-1.5 text-xs text-sky-400/70 hover:text-sky-400 transition-colors disabled:opacity-50"
          >
            <CheckCheck className="h-3.5 w-3.5" />
            Mark all read
          </button>
        )}
      </div>

      {/* List */}
      <div className="space-y-2">
        {notifications.map((notif) => {
          const style = NOTIF_STYLE[notif.type];
          const isRead = localRead.has(notif.id);

          return (
            <div
              key={notif.id}
              className={[
                "rounded-2xl border px-4 py-3.5 transition-colors",
                isRead
                  ? "border-white/[0.06] bg-white/[0.02]"
                  : "border-sky-400/15 bg-sky-400/[0.04]",
              ].join(" ")}
            >
              <div className="flex items-start gap-3">
                {/* Icon dot */}
                <span className="text-lg flex-shrink-0 mt-0.5">
                  {style.icon}
                </span>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 justify-between">
                    <p
                      className={`text-sm font-semibold ${isRead ? "text-white/60" : "text-white"}`}
                    >
                      {notif.title}
                    </p>
                    {!isRead && (
                      <span className="flex-shrink-0 w-2 h-2 rounded-full bg-sky-400" />
                    )}
                  </div>
                  <p
                    className={`text-xs mt-0.5 leading-relaxed ${isRead ? "text-white/30" : "text-white/55"}`}
                  >
                    {notif.body}
                  </p>
                  <p className="text-[10px] text-white/20 mt-1.5 flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {relativeTime(notif.created_at)}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
