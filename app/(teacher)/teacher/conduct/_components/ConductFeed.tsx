"use client";

import { useState, useMemo } from "react";
import { Bell, Shield, Trash2, Inbox } from "lucide-react";
import type { ConductRecord } from "@/lib/actions/conduct";
import { CONDUCT_TYPES, type ConductType } from "@/lib/schemas/conduct";
import { TYPE_CFG, SEVERITY_CFG, fmtDate, classLabel } from "../conduct.config";

interface Props {
  records: ConductRecord[];
  grades: string[];
  totalRecordCount: number;
  isMutating: boolean;
  onNotify: (id: string) => void;
  onDelete: (id: string) => void;
  onResolve: (id: string) => void;
}

// ── ScoreBadge (Optimized) ──────────────────────────────────────────────────

function ScoreBadge({ 
  studentRecords 
}: { 
  studentRecords: ConductRecord[] 
}) {
  const stats = useMemo(() => {
    const net = studentRecords.reduce((s, r) => s + r.points, 0);
    return {
      net,
      merits: studentRecords.filter((r) => r.type === "merit").length,
      demerits: studentRecords.filter((r) => r.type === "demerit").length,
      incidents: studentRecords.filter((r) => r.type === "incident").length,
    };
  }, [studentRecords]);

  return (
    <span className="flex items-center gap-1.5 text-[10px] font-bold">
      <span className={`px-1.5 py-0.5 rounded-md ${stats.net >= 0 ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>
        {stats.net >= 0 ? "+" : ""}{stats.net} pts
      </span>
      {stats.merits > 0 && <span className="text-emerald-600">{stats.merits}M</span>}
      {stats.demerits > 0 && <span className="text-amber-600">{stats.demerits}D</span>}
      {stats.incidents > 0 && (
        <span className="text-rose-600">
          {stats.incidents} incident{stats.incidents !== 1 ? "s" : ""}
        </span>
      )}
    </span>
  );
}

// ── ConductCard (Extracted) ──────────────────────────────────────────────────

function ConductCard({
  record,
  allRecords,
  isMutating,
  onNotify,
  onDelete,
  onResolve,
}: {
  record: ConductRecord;
  allRecords: ConductRecord[];
  isMutating: boolean;
  onNotify: (id: string) => void;
  onDelete: (id: string) => void;
  onResolve: (id: string) => void;
}) {
  const cfg = TYPE_CFG[record.type];
  const studentRecords = allRecords.filter(r => r.student_id === record.student_id);

  return (
    <div className={`bg-white rounded-2xl border shadow-sm transition-all ${cfg.border} ${record.is_resolved ? "opacity-60" : ""}`}>
      <div className="flex items-start gap-3 px-4 py-3.5">
        <div className={`mt-0.5 w-2 h-2 rounded-full shrink-0 ${cfg.dot}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-xs font-black px-2 py-0.5 rounded-lg border ${cfg.bg} ${cfg.text} ${cfg.border}`}>
                  {cfg.label} {record.points !== 0 && `· ${record.points > 0 ? "+" : ""}${record.points}pts`}
                </span>
                {record.type === "incident" && record.severity && (
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${SEVERITY_CFG[record.severity].cls}`}>
                    {SEVERITY_CFG[record.severity].label}
                  </span>
                )}
                {record.is_resolved && (
                  <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-md">Resolved</span>
                )}
              </div>
              <div className="flex items-baseline gap-2 mt-1 flex-wrap">
                <p className="text-sm font-bold text-slate-800">{record.student_name}</p>
                <ScoreBadge studentRecords={studentRecords} />
              </div>
              <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{record.description}</p>
              {record.action_taken && <p className="text-[10px] text-slate-400 mt-1 italic">Action: {record.action_taken}</p>}
              <p className="text-[10px] text-slate-300 mt-1.5">
                {fmtDate(record.created_at)} · {record.category} · {classLabel(record.grade, record.stream)}
              </p>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              {!record.parent_notified ? (
                <button onClick={() => onNotify(record.id)} disabled={isMutating} title="Notify parent" className="action-btn hover:text-violet-600 hover:bg-violet-50">
                  <Bell className="h-3.5 w-3.5" />
                </button>
              ) : !record.parent_ack_at && (
                <span title="Awaiting acknowledgement" className="h-7 w-7 flex items-center justify-center text-violet-400">
                  <Bell className="h-3.5 w-3.5" />
                </span>
              )}
              {record.type === "incident" && !record.is_resolved && (
                <button onClick={() => onResolve(record.id)} disabled={isMutating} title="Mark resolved" className="action-btn hover:text-emerald-600 hover:bg-emerald-50">
                  <Shield className="h-3.5 w-3.5" />
                </button>
              )}
              <button onClick={() => onDelete(record.id)} disabled={isMutating} title="Delete" className="action-btn hover:text-rose-500 hover:bg-rose-50">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
          {record.parent_ack_at && (
            <p className="text-[10px] text-emerald-600 mt-1.5">✓ Parent acknowledged {fmtDate(record.parent_ack_at)}</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main ConductFeed ──────────────────────────────────────────────────────────

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

  const filtered = useMemo(() => {
    return records.filter((r) => {
      const matchGrade = filterGrade === "all" || r.grade === filterGrade;
      const matchType = filterType === "all" || r.type === filterType;
      return matchGrade && matchType;
    });
  }, [records, filterGrade, filterType]);

  return (
    <div className="space-y-4">
      {/* Filters Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 px-4 py-3 shadow-sm flex flex-wrap items-center gap-3">
        {grades.length > 1 && (
          <select
          aria-label="filter by grade"
            value={filterGrade}
            onChange={(e) => setFilterGrade(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-600 bg-white focus:ring-2 focus:ring-slate-100 outline-none"
          >
            <option value="all">All classes</option>
            {grades.map((g) => <option key={g} value={g}>{g}</option>)}
          </select>
        )}
        
        <div className="flex gap-1 overflow-x-auto pb-1 sm:pb-0">
          {(["all", ...CONDUCT_TYPES] as const).map((t) => (
            <button
              key={t}
              onClick={() => setFilterType(t)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all whitespace-nowrap ${
                filterType === t ? "bg-slate-800 text-white border-slate-800" : "bg-white text-slate-500 border-slate-200 hover:border-slate-300"
              }`}
            >
              {t === "all" ? `All (${totalRecordCount})` : TYPE_CFG[t].label}
            </button>
          ))}
        </div>
        <span className="ml-auto text-[10px] font-medium text-slate-400 uppercase tracking-wider">
          {filtered.length} Displayed
        </span>
      </div>

      {/* Cards List */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-slate-200 p-16 text-center">
          <Inbox className="h-10 w-10 text-slate-200 mx-auto mb-4" />
          <p className="text-slate-500 font-medium">No records matching filters</p>
          <button 
            onClick={() => { setFilterGrade("all"); setFilterType("all"); }}
            className="text-violet-600 text-xs mt-2 hover:underline"
          >
            Clear all filters
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((r) => (
            <ConductCard
              key={r.id}
              record={r}
              allRecords={records}
              isMutating={isMutating}
              onNotify={onNotify}
              onDelete={onDelete}
              onResolve={onResolve}
            />
          ))}
        </div>
      )}

      {/* Global CSS for cleaner buttons */}
      <style jsx>{`
        .action-btn {
          height: 1.75rem;
          width: 1.75rem;
          border-radius: 0.5rem;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #cbd5e1;
          transition: all 0.2s;
        }
        .action-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );
}