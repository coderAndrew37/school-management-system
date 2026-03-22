// app/teacher/class/attendance/RegisterTab.tsx
"use client";

import type { ClassStudent } from "@/lib/data/assessment";
import {
  CheckCircle2,
  ChevronUp,
  Clock,
  FileText,
  Phone,
  Save,
  Users,
  XCircle,
} from "lucide-react";
import { useState } from "react";
import type { ParentContact, Status, StudentRow } from "./attendance-types";
import { STATUSES, STATUS_CFG, getInitials } from "./attendance-types";
import { ContactPopover } from "./ContactPopover";

const STATUS_ICONS: Record<Status, React.ReactNode> = {
  Present: <CheckCircle2 className="h-4 w-4" />,
  Late: <Clock className="h-4 w-4" />,
  Absent: <XCircle className="h-4 w-4" />,
  Excused: <FileText className="h-4 w-4" />,
};

interface Props {
  grade: string;
  students: ClassStudent[];
  studentsWithParents: (ClassStudent & { parents: ParentContact[] })[];
  rows: StudentRow[];
  isFuture: boolean;
  isPending: boolean;
  saved: boolean;
  selectedDate: string;
  onSetStatus: (id: string, status: Status) => void;
  onSetRemarks: (id: string, remarks: string) => void;
  onToggleRemarks: (id: string) => void;
  onMarkAll: (status: Status) => void;
  onSave: () => void;
}

export function RegisterTab({
  grade,
  students,
  studentsWithParents,
  rows,
  isFuture,
  isPending,
  saved,
  selectedDate,
  onSetStatus,
  onSetRemarks,
  onToggleRemarks,
  onMarkAll,
  onSave,
}: Props) {
  const [contactId, setContactId] = useState<string | null>(null);

  const counts = rows.reduce<Record<Status, number>>(
    (acc, r) => {
      acc[r.status] = (acc[r.status] ?? 0) + 1;
      return acc;
    },
    { Present: 0, Late: 0, Absent: 0, Excused: 0 },
  );
  const rate =
    rows.length > 0
      ? Math.round(((counts.Present + counts.Late) / rows.length) * 100)
      : 0;
  const absentRows = rows.filter(
    (r) => r.status === "Absent" || r.status === "Late",
  );

  return (
    <>
      {/* Stats */}
      <div className="grid grid-cols-5 gap-2">
        <div className="col-span-1 bg-white rounded-2xl border border-slate-200 p-3 text-center shadow-sm">
          <p className="text-xl font-black text-slate-800">{rate}%</p>
          <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mt-0.5">
            Rate
          </p>
        </div>
        {STATUSES.map((st) => (
          <div
            key={st}
            className="bg-white rounded-2xl border border-slate-200 p-3 text-center shadow-sm"
          >
            <p className={`text-xl font-black ${STATUS_CFG[st].text}`}>
              {counts[st]}
            </p>
            <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mt-0.5">
              {STATUS_CFG[st].label}
            </p>
          </div>
        ))}
      </div>

      {/* Quick mark */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
          Mark all:
        </span>
        {STATUSES.map((st) => (
          <button
            key={st}
            onClick={() => onMarkAll(st)}
            disabled={isFuture}
            className="flex items-center gap-1 text-xs font-bold px-2.5 py-1.5 rounded-xl border bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50 transition-all disabled:opacity-40"
          >
            <span className={`w-2 h-2 rounded-full ${STATUS_CFG[st].dot}`} />
            {STATUS_CFG[st].label}
          </button>
        ))}
        <span className="ml-auto flex items-center gap-1.5 text-xs text-slate-400">
          <Users className="h-3.5 w-3.5" /> {rows.length}
        </span>
      </div>

      {/* Roll list */}
      <div className="space-y-2">
        {rows.map((row, idx) => {
          const parentData = studentsWithParents.find(
            (s) => s.id === row.studentId,
          );
          const parents = parentData?.parents ?? [];
          const isOpen = contactId === row.studentId;
          return (
            <div
              key={row.studentId}
              className={`bg-white rounded-2xl border shadow-sm overflow-visible transition-all ${
                row.status === "Absent"
                  ? "border-rose-200"
                  : row.status === "Late"
                    ? "border-amber-200"
                    : "border-slate-200"
              }`}
            >
              <div className="flex items-center gap-3 px-4 py-3">
                <span className="text-[10px] font-bold text-slate-300 w-5 text-right shrink-0">
                  {idx + 1}
                </span>
                <div
                  className={`h-9 w-9 rounded-xl flex items-center justify-center text-xs font-black shrink-0 ${row.gender === "Female" ? "bg-pink-100 text-pink-700" : "bg-blue-100 text-blue-700"}`}
                >
                  {getInitials(row.full_name)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-slate-800 truncate">
                    {row.full_name}
                  </p>
                  {row.readable_id && (
                    <p className="text-[10px] font-mono text-slate-400">
                      #{row.readable_id}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {STATUSES.map((st) => (
                    <button
                      key={st}
                      onClick={() =>
                        !isFuture && onSetStatus(row.studentId, st)
                      }
                      disabled={isFuture}
                      title={STATUS_CFG[st].label}
                      className={`h-8 w-8 rounded-xl flex items-center justify-center transition-all disabled:cursor-not-allowed ${
                        row.status === st
                          ? STATUS_CFG[st].active
                          : STATUS_CFG[st].inactive
                      }`}
                    >
                      {STATUS_ICONS[st]}
                    </button>
                  ))}
                  <button
                    onClick={() => onToggleRemarks(row.studentId)}
                    title="Note"
                    className="h-8 w-8 rounded-xl flex items-center justify-center text-slate-400 hover:bg-slate-100 transition-colors"
                  >
                    {row.remarksOpen ? (
                      <ChevronUp className="h-3.5 w-3.5" />
                    ) : (
                      <FileText
                        className={`h-3.5 w-3.5 ${row.remarks ? "text-amber-500" : ""}`}
                      />
                    )}
                  </button>
                  <div className="relative">
                    <button
                      onClick={() =>
                        setContactId(isOpen ? null : row.studentId)
                      }
                      className={`h-8 w-8 rounded-xl flex items-center justify-center transition-colors ${isOpen ? "bg-violet-100 text-violet-600" : "text-slate-300 hover:bg-slate-100 hover:text-slate-500"}`}
                    >
                      <Phone className="h-3.5 w-3.5" />
                    </button>
                    {isOpen && (
                      <ContactPopover
                        studentName={row.full_name}
                        parents={parents}
                        grade={grade}
                        onClose={() => setContactId(null)}
                      />
                    )}
                  </div>
                </div>
              </div>
              {row.remarksOpen && (
                <div className="px-4 pb-3 pt-0 border-t border-slate-100">
                  <input
                    type="text"
                    value={row.remarks}
                    onChange={(e) =>
                      onSetRemarks(row.studentId, e.target.value)
                    }
                    placeholder="Note (e.g. sick, permission letter, left early)…"
                    className="w-full text-xs px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-300 focus:bg-white"
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Absent summary */}
      {absentRows.length > 0 && (
        <div className="bg-white rounded-2xl border border-rose-200 p-4 shadow-sm space-y-2">
          <p className="text-xs font-black uppercase tracking-wider text-rose-500">
            ⚠ Follow-up ({absentRows.length})
          </p>
          {absentRows.map((r) => (
            <div
              key={r.studentId}
              className="flex items-center gap-2 flex-wrap"
            >
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${r.status === "Absent" ? "bg-rose-50 text-rose-600 border-rose-100" : "bg-amber-50 text-amber-600 border-amber-100"}`}
              >
                {r.status}
              </span>
              <span className="text-xs text-slate-700 font-semibold">
                {r.full_name}
              </span>
              {r.remarks && (
                <span className="text-xs text-slate-400 truncate">
                  — {r.remarks}
                </span>
              )}
            </div>
          ))}
          <p className="text-[10px] text-slate-400 pt-1">
            Parent notifications sent automatically on save.
          </p>
        </div>
      )}

      {/* Save footer */}
      <div className="pb-6">
        <button
          onClick={onSave}
          disabled={isPending || isFuture}
          className="w-full py-3.5 rounded-2xl bg-sky-600 text-white font-black text-sm hover:bg-sky-700 disabled:opacity-40 transition-colors shadow-lg shadow-sky-200/50 flex items-center justify-center gap-2"
        >
          <Save className="h-4 w-4" />
          {isPending ? "Saving…" : `Save ${grade} Register`}
        </button>
        <p className="text-center text-[10px] text-slate-400 mt-2">
          Parents of absent students will be notified automatically
        </p>
      </div>
    </>
  );
}
