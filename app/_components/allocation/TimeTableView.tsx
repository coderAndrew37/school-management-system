"use client";

import { useState, useCallback, useTransition, useRef } from "react";
import { toast } from "sonner";
import {
  GripVertical,
  X,
  Plus,
  Loader2,
  CalendarDays,
  Search,
} from "lucide-react";
import { DAYS, PERIOD_TIMES, PERIODS } from "@/lib/types/allocation";
import type { TimetableGrid, TimetableCell } from "@/lib/types/allocation";
import type { GradeAllocation } from "@/lib/data/allocation";
import {
  swapSlotsAction,
  clearSlotAction,
  assignSlotAction,
  moveSlotAction,
} from "@/lib/actions/timetable";

// ── Types ─────────────────────────────────────────────────────────────────────

interface TimetableViewProps {
  gradeGrids: Record<string, TimetableGrid>;
  availableGrades: string[];
  allocationsByGrade: Record<string, GradeAllocation[]>;
  academicYear: number;
}

type DragPayload = { type: "slot"; slotId: string; fromKey: string } | null;

// ── UI Palette ───────────────────────────────────────────────────────────────

const PALETTE = [
  { bg: "bg-amber-500/10 border-amber-500/20 text-amber-500", dot: "bg-amber-500" },
  { bg: "bg-sky-500/10 border-sky-500/20 text-sky-500", dot: "bg-sky-500" },
  { bg: "bg-emerald-500/10 border-emerald-500/20 text-emerald-500", dot: "bg-emerald-500" },
  { bg: "bg-rose-500/10 border-rose-500/20 text-rose-500", dot: "bg-rose-500" },
  { bg: "bg-violet-500/10 border-violet-500/20 text-violet-500", dot: "bg-violet-500" },
  { bg: "bg-cyan-500/10 border-cyan-500/20 text-cyan-500", dot: "bg-cyan-500" },
  { bg: "bg-orange-500/10 border-orange-500/20 text-orange-500", dot: "bg-orange-500" },
  { bg: "bg-indigo-500/10 border-indigo-500/20 text-indigo-500", dot: "bg-indigo-500" },
];

function getPalette(code: string) {
  let h = 0;
  for (let i = 0; i < code.length; i++) h = code.charCodeAt(i) + ((h << 5) - h);
  return PALETTE[Math.abs(h) % PALETTE.length]!;
}

const BREAKS: Record<number, string> = {
  4: "SHORT BREAK • 10:00 – 10:20",
  7: "LUNCH BREAK • 12:50 – 1:30",
};

// ── Components ───────────────────────────────────────────────────────────────

function AssignPopover({
  allocations,
  onSelect,
  onClose,
}: {
  allocations: GradeAllocation[];
  onSelect: (a: GradeAllocation) => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState("");
  const filtered = q
    ? allocations.filter(
        (a) =>
          a.subjectName.toLowerCase().includes(q.toLowerCase()) ||
          a.teacherName.toLowerCase().includes(q.toLowerCase()) ||
          a.subjectCode.toLowerCase().includes(q.toLowerCase())
      )
    : allocations;

  return (
    <div className="absolute z-[60] top-full left-0 mt-2 w-72 rounded-xl border border-white/10 bg-[#0c0f1a] shadow-2xl ring-1 ring-black animate-in fade-in zoom-in duration-150">
      <div className="p-3 border-b border-white/5 flex items-center gap-2">
        <Search className="h-3.5 w-3.5 text-white/20" />
        <input
          autoFocus
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search subjects..."
          className="w-full bg-transparent text-xs text-white placeholder-white/20 outline-none"
        />
      </div>
      <div className="max-h-60 overflow-y-auto p-1 custom-scrollbar">
        {filtered.length === 0 ? (
          <p className="text-[10px] text-white/20 text-center py-8">No results found</p>
        ) : (
          filtered.map((a) => {
            const pal = getPalette(a.subjectCode);
            return (
              <button
                key={a.allocationId}
                onClick={() => onSelect(a)}
                className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-white/5 rounded-lg transition-all group text-left"
              >
                <div className={`text-[10px] font-bold font-mono w-12 text-center py-1 rounded border ${pal.bg}`}>
                  {a.subjectCode}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-white/80 group-hover:text-white truncate">
                    {a.subjectName}
                  </p>
                  <p className="text-[10px] text-white/30 truncate">
                    {a.teacherName}
                  </p>
                </div>
              </button>
            );
          })
        )}
      </div>
      <div className="border-t border-white/5 p-2 bg-white/[0.02]">
        <button
          onClick={onClose}
          className="w-full py-1.5 text-[10px] font-medium text-white/40 hover:text-white/60 transition-colors"
        >
          Close Menu
        </button>
      </div>
    </div>
  );
}

export function TimetableView({
  gradeGrids,
  availableGrades,
  allocationsByGrade,
  academicYear,
}: TimetableViewProps) {
  const [selectedGrade, setSelectedGrade] = useState(availableGrades[0] ?? "");
  const [grid, setGrid] = useState<TimetableGrid>(() => gradeGrids[availableGrades[0] ?? ""] ?? {});
  const [isDirty, setIsDirty] = useState(false);
  const [isPending, startTransition] = useTransition();

  const dragPayload = useRef<DragPayload>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [assignCell, setAssignCell] = useState<string | null>(null);

  const allocations = allocationsByGrade[selectedGrade] ?? [];

  const switchGrade = (grade: string) => {
    setSelectedGrade(grade);
    setGrid(gradeGrids[grade] ?? {});
    setIsDirty(false);
    setAssignCell(null);
  };

  const handleDragStart = (e: React.DragEvent, key: string) => {
    const cell = grid[key];
    if (!cell) return;
    dragPayload.current = { type: "slot", slotId: cell.slotId, fromKey: key };
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent, key: string) => {
    e.preventDefault();
    setDragOver(key);
  };

  const handleDrop = (e: React.DragEvent, toKey: string) => {
    e.preventDefault();
    setDragOver(null);
    const payload = dragPayload.current;
    if (!payload || payload.fromKey === toKey) return;
    dragPayload.current = null;

    const fromCell = grid[payload.fromKey];
    const toCell = grid[toKey];
    if (!fromCell) return;

    const [toDay, toPeriod] = toKey.split("-").map(Number) as [number, number];

    if (toCell) {
      setGrid((prev) => ({ ...prev, [payload.fromKey]: toCell, [toKey]: fromCell }));
      setIsDirty(true);
      startTransition(async () => {
        const result = await swapSlotsAction(fromCell.slotId, toCell.slotId);
        if (!result.success) {
          setGrid((prev) => ({ ...prev, [payload.fromKey]: fromCell, [toKey]: toCell }));
          toast.error(result.message);
        } else toast.success("Lessons swapped successfully.");
      });
    } else {
      setGrid((prev) => {
        const next = { ...prev };
        delete next[payload.fromKey];
        next[toKey] = fromCell;
        return next;
      });
      setIsDirty(true);
      startTransition(async () => {
        const result = await moveSlotAction(fromCell.slotId, selectedGrade, toDay, toPeriod, academicYear);
        if (!result.success) {
          setGrid((prev) => {
            const next = { ...prev };
            delete next[toKey];
            next[payload.fromKey] = fromCell;
            return next;
          });
          toast.error(result.message);
        } else toast.success("Lesson moved.");
      });
    }
  };

  const handleClear = useCallback((key: string) => {
    const cell = grid[key];
    if (!cell) return;
    setGrid((prev) => {
      const n = { ...prev };
      delete n[key];
      return n;
    });
    setIsDirty(true);
    startTransition(async () => {
      const result = await clearSlotAction(cell.slotId);
      if (!result.success) {
        setGrid((prev) => ({ ...prev, [key]: cell }));
        toast.error(result.message);
      } else toast.success("Slot cleared.");
    });
  }, [grid]);

  const handleAssign = useCallback((key: string, allocation: GradeAllocation) => {
    setAssignCell(null);
    const [day, period] = key.split("-").map(Number) as [number, number];

    const optimisticCell: TimetableCell = {
      slotId: "pending",
      teacherName: allocation.teacherName,
      subjectName: allocation.subjectName,
      subjectCode: allocation.subjectCode,
      allocationId: allocation.allocationId,
      teacherId: allocation.teacherId,
      className: "", 
    };

    setGrid((prev) => ({ ...prev, [key]: optimisticCell }));
    setIsDirty(true);

    startTransition(async () => {
      const result = await assignSlotAction(selectedGrade, day, period, academicYear, allocation.allocationId);
      if (!result.success) {
        setGrid((prev) => {
          const n = { ...prev };
          delete n[key];
          return n;
        });
        toast.error(result.message);
      } else toast.success("Lesson assigned.");
    });
  }, [selectedGrade, academicYear]);

  if (availableGrades.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-32 rounded-3xl border-2 border-dashed border-white/5 bg-white/[0.01]">
        <CalendarDays className="h-12 w-12 text-white/10 mb-4" />
        <p className="text-white/40 text-sm font-medium">No timetable records found</p>
        <p className="text-white/20 text-xs mt-1">Generate a schedule in the Subject Allocation tab</p>
      </div>
    );
  }

  const cells = Object.values(grid).filter(Boolean);
  const subjects = new Set(cells.map((c) => c!.subjectCode)).size;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white/[0.02] p-4 rounded-2xl border border-white/5">
        <div className="flex flex-wrap gap-2">
          {availableGrades.map((grade) => (
            <button
              key={grade}
              onClick={() => switchGrade(grade)}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border ${
                grade === selectedGrade
                  ? "bg-amber-400 border-amber-400 text-black shadow-lg shadow-amber-400/10"
                  : "bg-white/5 border-white/5 text-white/40 hover:text-white hover:border-white/10"
              }`}
            >
              {grade}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-4 px-2">
          {isPending && (
            <div className="flex items-center gap-2 text-[10px] text-amber-400 font-medium uppercase tracking-widest">
              <Loader2 className="h-3 w-3 animate-spin" /> Auto-Saving
            </div>
          )}
          <div className="h-4 w-px bg-white/10" />
          <div className="text-[10px] font-bold text-white/30 uppercase tracking-widest">
            {cells.length} Periods • {subjects} Subjects
          </div>
        </div>
      </div>

      <div className="relative overflow-hidden rounded-2xl border border-white/5 bg-[#0c0f1a]">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[850px] border-collapse">
            <thead>
              <tr className="bg-white/[0.03]">
                <th className="w-32 p-4 text-left text-[10px] font-black uppercase tracking-[0.2em] text-white/20 border-b border-r border-white/5">
                  Schedule
                </th>
                {DAYS.map((day) => (
                  <th key={day} className="p-4 text-center text-[10px] font-black uppercase tracking-[0.2em] text-white/40 border-b border-white/5">
                    {day}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {PERIODS.map((period) => (
                <React.Fragment key={period}>
                  {BREAKS[period] && (
                    <tr>
                      <td colSpan={6} className="py-3 px-4 bg-white/[0.01] border-y border-white/5">
                        <div className="flex items-center gap-4">
                          <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
                          <span className="text-[9px] font-black uppercase tracking-[0.3em] text-white/15 whitespace-nowrap">
                            {BREAKS[period]}
                          </span>
                          <div className="h-px flex-1 bg-gradient-to-r from-white/10 via-white/10 to-transparent" />
                        </div>
                      </td>
                    </tr>
                  )}
                  <tr className="group/row">
                    <td className="p-4 border-b border-r border-white/5 align-top bg-white/[0.01]">
                      <span className="block text-xs font-black text-white/60 group-hover/row:text-amber-400 transition-colors">P{period}</span>
                      <span className="block text-[10px] font-mono text-white/20 mt-1">{PERIOD_TIMES[period]}</span>
                    </td>
                    {DAYS.map((_, dayIdx) => {
                      const key = `${dayIdx + 1}-${period}`;
                      const cell = grid[key];
                      const isDropTarget = dragOver === key;
                      const isAssigning = assignCell === key;

                      return (
                        <td
                          key={dayIdx}
                          className={`p-2 border-b border-white/5 relative align-middle transition-colors ${isDropTarget ? "bg-amber-400/5" : ""}`}
                          onDragOver={(e) => handleDragOver(e, key)}
                          onDragLeave={() => setDragOver(null)}
                          onDrop={(e) => handleDrop(e, key)}
                        >
                          {cell ? (
                            <div
                              draggable
                              onDragStart={(e) => handleDragStart(e, key)}
                              className={`group/cell relative rounded-xl border p-3 cursor-grab active:cursor-grabbing transition-all hover:shadow-xl ${
                                getPalette(cell.subjectCode).bg
                              } ${isDropTarget ? "scale-95 opacity-50" : "scale-100"} ${cell.slotId === "pending" ? "animate-pulse" : ""}`}
                            >
                              <GripVertical className="absolute top-2 left-2 h-3 w-3 text-current opacity-0 group-hover/cell:opacity-30 transition-opacity" />
                              <button
                              aria-label="clear slot"
                                onClick={() => handleClear(key)}
                                className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-rose-500 text-white flex items-center justify-center opacity-0 group-hover/cell:opacity-100 shadow-lg hover:scale-110 transition-all z-10"
                              >
                                <X className="h-3 w-3" />
                              </button>
                              <div className="pl-2">
                                <span className="block text-[10px] font-black tracking-tighter uppercase opacity-80">{cell.subjectCode}</span>
                                <span className="block text-[11px] font-bold leading-tight mt-1 truncate">{cell.subjectName}</span>
                                <span className="block text-[9px] mt-1.5 opacity-50 font-medium italic truncate">{cell.teacherName}</span>
                              </div>
                            </div>
                          ) : (
                            <div className={`relative h-[76px] rounded-xl border border-dashed transition-all flex items-center justify-center ${
                              isDropTarget ? "border-amber-400/50 bg-amber-400/10" : "border-white/5 hover:border-white/20 hover:bg-white/[0.02]"
                            }`}>
                              <button
                                aria-label="assign subject"
                                onClick={() => setAssignCell(isAssigning ? null : key)}
                                className="w-full h-full text-white/10 hover:text-amber-400 transition-colors"
                              >
                                <Plus className={`h-5 w-5 m-auto transition-transform ${isAssigning ? "rotate-45" : ""}`} />
                              </button>
                              {isAssigning && (
                                <AssignPopover
                                  allocations={allocations}
                                  onSelect={(a) => handleAssign(key, a)}
                                  onClose={() => setAssignCell(null)}
                                />
                              )}
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

import React from "react"; // For React.Fragment