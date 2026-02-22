"use client";

import { useState } from "react";
import {
  CheckCircle2,
  Clock,
  XCircle,
  ChevronDown,
  ChevronUp,
  Users,
} from "lucide-react";
import type {
  CommunicationLogEntry,
  SentHistoryProps,
} from "@/lib/types/communications";

// ── Status badge ──────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<
  CommunicationLogEntry["status"],
  { icon: React.ReactNode; label: string; classes: string }
> = {
  sent: {
    icon: <CheckCircle2 className="h-3.5 w-3.5" />,
    label: "Sent",
    classes: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20",
  },
  scheduled: {
    icon: <Clock className="h-3.5 w-3.5" />,
    label: "Scheduled",
    classes: "text-amber-400 bg-amber-400/10 border-amber-400/20",
  },
  failed: {
    icon: <XCircle className="h-3.5 w-3.5" />,
    label: "Failed",
    classes: "text-rose-400 bg-rose-400/10 border-rose-400/20",
  },
};

function StatusBadge({ status }: { status: CommunicationLogEntry["status"] }) {
  const cfg = STATUS_CONFIG[status];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold ${cfg.classes}`}
    >
      {cfg.icon}
      {cfg.label}
    </span>
  );
}

// ── Log entry row ─────────────────────────────────────────────────────────────

function LogEntry({ entry }: { entry: CommunicationLogEntry }) {
  const [expanded, setExpanded] = useState<boolean>(false);

  const timestamp =
    entry.status === "scheduled" && entry.scheduled_at
      ? `Scheduled: ${new Date(entry.scheduled_at).toLocaleString("en-KE")}`
      : entry.sent_at
        ? new Date(entry.sent_at).toLocaleString("en-KE")
        : new Date(entry.created_at).toLocaleString("en-KE");

  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden transition-all duration-200">
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="w-full flex items-start gap-3 p-3.5 text-left hover:bg-white/[0.03] transition-colors"
      >
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <StatusBadge status={entry.status} />
            <span className="text-[10px] text-white/25">{timestamp}</span>
          </div>
          <p className="text-sm font-semibold text-white/80 truncate">
            {entry.subject}
          </p>
          <div className="flex items-center gap-2 text-[10px] text-white/30">
            <Users className="h-3 w-3" />
            <span>{entry.audience_label}</span>
            <span>·</span>
            <span>
              {entry.recipient_count} recipient
              {entry.recipient_count !== 1 ? "s" : ""}
            </span>
          </div>
        </div>
        <span className="text-white/20 flex-shrink-0 mt-1">
          {expanded ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
        </span>
      </button>

      {expanded && (
        <div className="border-t border-white/[0.05] px-3.5 py-3 space-y-2">
          <p className="text-[10px] text-white/25 uppercase tracking-wider font-semibold">
            Preview
          </p>
          <p className="text-xs text-white/40 leading-relaxed">
            {entry.body_preview}
            {entry.body_preview.length >= 120 && "…"}
          </p>
          <p className="text-[10px] text-white/20 pt-1">
            Sent by {entry.sent_by_name}
          </p>
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function SentHistory({ log }: SentHistoryProps) {
  if (log.length === 0) {
    return (
      <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-10 text-center">
        <p className="text-4xl mb-3">📭</p>
        <p className="text-white/40 text-sm font-medium">
          No messages sent yet
        </p>
        <p className="text-white/20 text-xs mt-1">
          Your sent communications will appear here.
        </p>
      </div>
    );
  }

  const scheduled = log.filter((e) => e.status === "scheduled");
  const rest = log.filter((e) => e.status !== "scheduled");

  return (
    <div className="space-y-4">
      {scheduled.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-widest text-amber-400/60 px-1">
            Scheduled
          </p>
          {scheduled.map((entry) => (
            <LogEntry key={entry.id} entry={entry} />
          ))}
        </div>
      )}

      {rest.length > 0 && (
        <div className="space-y-2">
          {scheduled.length > 0 && (
            <p className="text-[10px] font-bold uppercase tracking-widest text-white/25 px-1">
              History
            </p>
          )}
          {rest.map((entry) => (
            <LogEntry key={entry.id} entry={entry} />
          ))}
        </div>
      )}
    </div>
  );
}
