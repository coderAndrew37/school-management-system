"use client";

import { useState } from "react";
import {
  Pin,
  Bell,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Megaphone,
} from "lucide-react";
import type {
  Announcement,
  AnnouncementPriority,
} from "@/lib/types/governance";

const PRIORITY: Record<
  AnnouncementPriority,
  {
    label: string;
    border: string;
    bg: string;
    text: string;
    iconBg: string;
    iconText: string;
    icon: React.ReactNode;
  }
> = {
  urgent: {
    label: "Urgent",
    border: "border-red-200",
    bg: "bg-red-50",
    text: "text-red-700",
    iconBg: "bg-red-100",
    iconText: "text-red-700",
    icon: <AlertTriangle className="h-3.5 w-3.5" />,
  },
  high: {
    label: "Important",
    border: "border-amber-200",
    bg: "bg-amber-50",
    text: "text-amber-700",
    iconBg: "bg-amber-100",
    iconText: "text-amber-700",
    icon: <Bell className="h-3.5 w-3.5" />,
  },
  normal: {
    label: "Notice",
    border: "border-blue-200",
    bg: "bg-blue-50",
    text: "text-blue-700",
    iconBg: "bg-blue-100",
    iconText: "text-blue-700",
    icon: <Megaphone className="h-3.5 w-3.5" />,
  },
  low: {
    label: "Info",
    border: "border-slate-200",
    bg: "bg-slate-50",
    text: "text-slate-500",
    iconBg: "bg-slate-100",
    iconText: "text-slate-500",
    icon: <Megaphone className="h-3.5 w-3.5" />,
  },
};

interface Props {
  announcements: Announcement[];
  /** The specific class_id of the parent's child */
  childClassId: string;
}

export function AnnouncementsView({ announcements, childClassId }: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Filter based on the new implementation
  const visible = announcements.filter((a) => {
    // 1. Expiry Check
    if (a.expires_at && new Date(a.expires_at) < new Date()) return false;
    
    // 2. Role Check
    if (a.audience === "teachers") return false;
    
    // 3. Class/Grade Target Check
    // Using target_class_id as defined in lib/types/governance.ts
    if (a.audience === "grade" && a.target_class_id !== childClassId) return false;
    
    return true;
  });

  const ORDER: AnnouncementPriority[] = ["urgent", "high", "normal", "low"];
  const sorted = [...visible].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    const pa = ORDER.indexOf(a.priority),
      pb = ORDER.indexOf(b.priority);
    if (pa !== pb) return pa - pb;
    return (
      new Date(b.published_at).getTime() - new Date(a.published_at).getTime()
    );
  });

  if (sorted.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 py-16 text-center">
        <Megaphone className="h-8 w-8 text-slate-300 mb-3" />
        <p className="font-bold text-slate-500">
          No announcements at the moment
        </p>
        <p className="text-xs text-slate-400 mt-1">
          Updates for your child&apos;s class will appear here
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
        {sorted.length} announcement{sorted.length !== 1 ? "s" : ""} for you
      </p>

      {sorted.map((a) => {
        const p = PRIORITY[a.priority];
        const isOpen = expandedId === a.id;
        const preview =
          a.body.length > 140 ? a.body.slice(0, 140).trim() + "…" : a.body;

        return (
          <div
            key={a.id}
            className={`rounded-2xl border ${p.border} ${p.bg} overflow-hidden shadow-sm transition-all`}
          >
            <button
              onClick={() => setExpandedId(isOpen ? null : a.id)}
              className="w-full flex items-start gap-3 px-4 py-4 text-left"
            >
              <div
                className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl ${p.iconBg} ${p.iconText} mt-0.5`}
              >
                {p.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  {a.pinned && (
                    <span className="flex items-center gap-1 text-[10px] font-black text-amber-600">
                      <Pin className="h-3 w-3" />
                      Pinned
                    </span>
                  )}
                  <span
                    className={`text-[10px] font-black uppercase tracking-wide px-2.5 py-0.5 rounded-full border ${p.border} ${p.iconBg} ${p.text}`}
                  >
                    {p.label}
                  </span>
                  {a.audience === "grade" && (
                    <span className="text-[10px] text-slate-400 font-mono font-bold">
                      {a.classes?.grade || "Class Update"}
                    </span>
                  )}
                </div>
                <p className="font-black text-slate-800 text-sm leading-snug">
                  {a.title}
                </p>
                {!isOpen && (
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    {preview}
                  </p>
                )}
                <p className="text-[10px] font-semibold text-slate-400 mt-1.5">
                  {new Date(a.published_at).toLocaleDateString("en-KE", {
                    weekday: "short",
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </p>
              </div>
              <div className={`flex-shrink-0 mt-1 ${p.text}`}>
                {isOpen ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </div>
            </button>
            {isOpen && (
              <div className="px-5 pb-5 border-t border-slate-100 pt-4">
                <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                  {a.body}
                </p>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}