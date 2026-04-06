"use client";
// app/teacher/conduct/components/ConductFeed.tsx
// Filters bar + scrollable record cards.
// Presentational with one local state item: the active filters.
// Mutation handlers (notify, delete, resolve) come from the parent so the
// parent owns all records state in one place.

import { useState } from "react";
import { Bell, Shield, Trash2 } from "lucide-react";
import type { ConductRecord } from "@/lib/actions/conduct";
import { CONDUCT_TYPES, type ConductType } from "@/lib/schemas/conduct";
import { TYPE_CFG, SEVERITY_CFG, fmtDate, classLabel } from "../conduct.config";

interface Props {
  records: ConductRecord[];
  grades: string[]; // unique grade strings for the filter dropdown
  totalRecordCount: number;
  isMutating: boolean;
  onNotify: (id: string) => void;
  onDelete: (id: string) => void;
  onResolve: (id: string) => void;
}

// ── Inline score badge ────────────────────────────────────────────────────────

function ScoreBadge({
  records,
  studentId,
}: {
  records: ConductRecord[];
  studentId: string;
}) {
  const mine = records.filter((r) => r.student_id === studentId);
  const net = mine.reduce((s, r) => s + r.points, 0);
  const merits = mine.filter((r) => r.type === "merit").length;
  const dems = mine.filter((r) => r.type === "demerit").length;
  const incs = mine.filter((r) => r.type === "incident").length;
  return (
    <span className="flex items-center gap-1.5 text-[10px] font-bold">
      <span
        className={`px-1.5 py-0.5 rounded-md ${net >= 0 ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}
      >
        {net >= 0 ? "+" : ""}
        {net} pts
      </span>
      {merits > 0 && <span className="text-emerald-600">{merits}M</span>}
      {dems > 0 && <span className="text-amber-600">{dems}D</span>}
      {incs > 0 && (
        <span className="text-rose-600">
          {incs} incident{incs !== 1 ? "s" : ""}
        </span>
      )}
    </span>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function ConductFeed({
  records,
  grades,
  totalRecordCount,
  isMutating,
  onNotify,
  onDelete,
  onResolve,
}: Props) {
  const [filterGrade, setFilterGrade] = useState<string>("all");
  const [filterType, setFilterType] = useState<"all" | ConductType>("all");

  const filtered = records.filter((r) => {
    if (filterGrade !== "all" && r.grade !== filterGrade) return false;
    if (filterType !== "all" && r.type !== filterType) return false;
    return true;
  });

  return (
    <div className="space-y-4">
      {/* ── Filters ──────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200 px-4 py-3 shadow-sm flex flex-wrap items-center gap-3">
        {grades.length > 1 && (
          <select
            aria-label="filter by grade"
            value={filterGrade}
            onChange={(e) => setFilterGrade(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-600 bg-white focus:outline-none"
          >
            <option value="all">All classes</option>
            {grades.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        )}
        <div className="flex gap-1">
          {(["all", ...CONDUCT_TYPES] as const).map((t) => (
            <button
              key={t}
              aria-label={`filter-${t}`}
              onClick={() => setFilterType(t)}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold border capitalize transition-all ${
                filterType === t
                  ? "bg-slate-800 text-white border-slate-800"
                  : "bg-white text-slate-500 border-slate-200 hover:border-slate-300"
              }`}
            >
              {t === "all" ? `All (${totalRecordCount})` : TYPE_CFG[t].label}
            </button>
          ))}
        </div>
        <span className="ml-auto text-xs text-slate-400">
          {filtered.length} records
        </span>
      </div>

      {/* ── Cards ────────────────────────────────────────────────────── */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-14 text-center shadow-sm">
          <Shield className="h-8 w-8 text-slate-200 mx-auto mb-3" />
          <p className="text-slate-400 text-sm">No records yet.</p>
          <p className="text-slate-300 text-xs mt-1">
            Log a merit, demerit, or incident above.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((r) => {
            const cfg = TYPE_CFG[r.type];
            return (
              <div
                key={r.id}
                className={`bg-white rounded-2xl border shadow-sm transition-all ${cfg.border} ${r.is_resolved ? "opacity-60" : ""}`}
              >
                <div className="flex items-start gap-3 px-4 py-3.5">
                  <div
                    className={`mt-0.5 w-2 h-2 rounded-full shrink-0 ${cfg.dot}`}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      {/* Left: content */}
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className={`text-xs font-black px-2 py-0.5 rounded-lg border ${cfg.bg} ${cfg.text} ${cfg.border}`}
                          >
                            {cfg.label}
                            {r.points !== 0
                              ? ` · ${r.points > 0 ? "+" : ""}${r.points}pts`
                              : ""}
                          </span>
                          {r.type === "incident" && r.severity && (
                            <span
                              className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${SEVERITY_CFG[r.severity].cls}`}
                            >
                              {SEVERITY_CFG[r.severity].label}
                            </span>
                          )}
                          {r.is_resolved && (
                            <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-md">
                              Resolved
                            </span>
                          )}
                        </div>
                        <div className="flex items-baseline gap-2 mt-1 flex-wrap">
                          <p className="text-sm font-bold text-slate-800">
                            {r.student_name}
                          </p>
                          <ScoreBadge
                            records={records}
                            studentId={r.student_id}
                          />
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                          {r.description}
                        </p>
                        {r.action_taken && (
                          <p className="text-[10px] text-slate-400 mt-1 italic">
                            Action: {r.action_taken}
                          </p>
                        )}
                        <p className="text-[10px] text-slate-300 mt-1.5">
                          {fmtDate(r.created_at)} · {r.category} ·{" "}
                          {classLabel(r.grade, r.stream)}
                        </p>
                      </div>

                      {/* Right: action buttons */}
                      <div className="flex items-center gap-1 shrink-0">
                        {!r.parent_notified && (
                          <button
                            onClick={() => onNotify(r.id)}
                            disabled={isMutating}
                            title="Notify parent"
                            className="h-7 w-7 rounded-lg flex items-center justify-center text-slate-300 hover:text-violet-600 hover:bg-violet-50 transition-colors disabled:opacity-50"
                          >
                            <Bell className="h-3.5 w-3.5" />
                          </button>
                        )}
                        {r.parent_notified && !r.parent_ack_at && (
                          <span
                            title="Parent notified — awaiting acknowledgement"
                            className="h-7 w-7 rounded-lg flex items-center justify-center text-violet-400"
                          >
                            <Bell className="h-3.5 w-3.5" />
                          </span>
                        )}
                        {r.type === "incident" && !r.is_resolved && (
                          <button
                            onClick={() => onResolve(r.id)}
                            disabled={isMutating}
                            title="Mark resolved"
                            className="h-7 w-7 rounded-lg flex items-center justify-center text-slate-300 hover:text-emerald-600 hover:bg-emerald-50 transition-colors disabled:opacity-50"
                          >
                            <Shield className="h-3.5 w-3.5" />
                          </button>
                        )}
                        <button
                          onClick={() => onDelete(r.id)}
                          disabled={isMutating}
                          title="Delete"
                          className="h-7 w-7 rounded-lg flex items-center justify-center text-slate-300 hover:text-rose-500 hover:bg-rose-50 transition-colors disabled:opacity-50"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    {r.parent_ack_at && (
                      <p className="text-[10px] text-emerald-600 mt-1.5">
                        ✓ Parent acknowledged {fmtDate(r.parent_ack_at)}
                      </p>
                    )}
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
