// components/AnnCard.tsx — single announcement card, no state, no actions

import { PRIORITY_CONFIG } from "../constants";
import { fmt, fmtShort } from "../utils";
import type { Announcement } from "../types";
import { Trash2, Users } from "lucide-react";

interface Props {
  ann: Announcement;
  onDelete: () => void;
  isPending: boolean;
}

export function AnnCard({ ann, onDelete, isPending }: Props) {
  const cfg = PRIORITY_CONFIG[ann.priority === "urgent" ? "urgent" : "normal"];
  const now = new Date();
  const expiringSoon =
    ann.expires_at &&
    new Date(ann.expires_at) > now &&
    new Date(ann.expires_at).getTime() - now.getTime() < 3 * 86400000;

  return (
    <div
      className={`rounded-2xl border p-4 flex gap-4 transition-all hover:bg-white/[0.02] ${cfg.card}`}
    >
      <div className="mt-0.5 shrink-0">
        <span className={cfg.dot === "bg-rose-400" ? "text-rose-400" : "text-sky-400"}>
          {cfg.icon}
        </span>
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2 mb-1">
          <p className="text-sm font-bold text-white leading-snug">{ann.title}</p>

          <div className="flex items-center gap-1.5 shrink-0">
            {ann.priority === "urgent" && (
              <span className={`text-[9px] font-black border px-2 py-0.5 rounded-lg ${cfg.badge}`}>
                URGENT
              </span>
            )}
            {ann.target_grade && (
              <span className="text-[9px] font-semibold bg-white/[0.06] text-white/50 border border-white/10 px-2 py-0.5 rounded-lg">
                {ann.target_grade}
              </span>
            )}
            <span className="text-[9px] text-white/35 border border-white/[0.07] px-2 py-0.5 rounded-lg capitalize flex items-center gap-1">
              <Users className="h-2.5 w-2.5" />
              {ann.audience === "all" ? "Everyone" : ann.audience}
            </span>
            <button
              onClick={onDelete}
              disabled={isPending}
              aria-label="Delete announcement"
              className="text-white/20 hover:text-rose-400 transition-colors ml-0.5 disabled:opacity-40"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        <p className="text-xs text-white/50 leading-relaxed line-clamp-3">{ann.body}</p>

        <div className="flex items-center gap-3 mt-2">
          <p className="text-[10px] text-white/25">Published {fmt(ann.created_at)}</p>
          {ann.expires_at && (
            <p className={`text-[10px] font-semibold ${expiringSoon ? "text-amber-400" : "text-white/25"}`}>
              {expiringSoon && "⚠ "}Expires {fmtShort(ann.expires_at)}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}