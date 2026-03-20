"use client";

// app/_components/allocation/TimetableView.tsx
// Editable timetable with:
//   - Drag-and-drop to swap or move lessons
//   - Click empty cell → assign lesson from dropdown
//   - Click filled cell → X to clear, or drag handle to move
//   - Teacher conflict detection (client-side preview + server validation)

import { useState, useCallback, useTransition, useRef } from "react";
import { toast } from "sonner";
import {
  GripVertical,
  X,
  Plus,
  ChevronDown,
  Loader2,
  RotateCcw,
} from "lucide-react";
import { DAYS, PERIOD_TIMES, PERIODS } from "@/lib/types/allocation";
import type { TimetableGrid } from "@/lib/types/allocation";
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
  // allocationsByGrade: passed from the page so each grade has its assign options
  allocationsByGrade: Record<string, GradeAllocation[]>;
  academicYear: number;
}

type DragPayload = { type: "slot"; slotId: string; fromKey: string } | null;

// ── Colour per subject code (deterministic) ───────────────────────────────────

const PALETTE = [
  {
    bg: "bg-amber-400/15   border-amber-400/30   text-amber-300",
    dot: "bg-amber-400",
  },
  {
    bg: "bg-sky-400/15     border-sky-400/30     text-sky-300",
    dot: "bg-sky-400",
  },
  {
    bg: "bg-emerald-400/15 border-emerald-400/30 text-emerald-300",
    dot: "bg-emerald-400",
  },
  {
    bg: "bg-rose-400/15    border-rose-400/30    text-rose-300",
    dot: "bg-rose-400",
  },
  {
    bg: "bg-violet-400/15  border-violet-400/30  text-violet-300",
    dot: "bg-violet-400",
  },
  {
    bg: "bg-cyan-400/15    border-cyan-400/30    text-cyan-300",
    dot: "bg-cyan-400",
  },
  {
    bg: "bg-orange-400/15  border-orange-400/30  text-orange-300",
    dot: "bg-orange-400",
  },
  {
    bg: "bg-teal-400/15    border-teal-400/30    text-teal-300",
    dot: "bg-teal-400",
  },
  {
    bg: "bg-pink-400/15    border-pink-400/30    text-pink-300",
    dot: "bg-pink-400",
  },
  {
    bg: "bg-indigo-400/15  border-indigo-400/30  text-indigo-300",
    dot: "bg-indigo-400",
  },
];

function palette(code: string) {
  let h = 0;
  for (let i = 0; i < code.length; i++) h = code.charCodeAt(i) + ((h << 5) - h);
  return PALETTE[Math.abs(h) % PALETTE.length]!;
}

// ── Break rows ────────────────────────────────────────────────────────────────

const BREAKS: Record<number, string> = {
  4: "SHORT BREAK  10:00 – 10:20",
  7: "LUNCH  12:50 – 1:30",
};

// ── Assign cell popover ───────────────────────────────────────────────────────

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
          a.teacherName.toLowerCase().includes(q.toLowerCase()),
      )
    : allocations;

  return (
    <div className="absolute z-50 top-full left-0 mt-1 w-64 rounded-xl border border-white/[0.12] bg-[#111827] shadow-2xl overflow-hidden">
      <div className="p-2 border-b border-white/[0.07]">
        <input
          autoFocus
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search subject or teacher…"
          className="w-full bg-white/[0.06] rounded-lg px-3 py-1.5 text-xs text-white placeholder-white/25 outline-none focus:ring-1 focus:ring-amber-400/30"
        />
      </div>
      <div className="max-h-48 overflow-y-auto">
        {filtered.length === 0 ? (
          <p className="text-xs text-white/25 text-center py-4">No matches</p>
        ) : (
          filtered.map((a) => {
            const pal = palette(a.subjectCode);
            return (
              <button
                key={a.allocationId}
                onClick={() => onSelect(a)}
                className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-white/[0.06] transition-colors text-left"
              >
                <span
                  className={`text-[9px] font-bold font-mono px-1.5 py-0.5 rounded border ${pal.bg}`}
                >
                  {a.subjectCode}
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-white/80 truncate">
                    {a.subjectName}
                  </p>
                  <p className="text-[10px] text-white/35 truncate">
                    {a.teacherName.split(" ")[0]}
                  </p>
                </div>
              </button>
            );
          })
        )}
      </div>
      <div className="border-t border-white/[0.06] px-3 py-2 text-right">
        <button
          onClick={onClose}
          className="text-[10px] text-white/30 hover:text-white/60"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function TimetableView({
  gradeGrids,
  availableGrades,
  allocationsByGrade,
  academicYear,
}: TimetableViewProps) {
  const [selectedGrade, setSelectedGrade] = useState(availableGrades[0] ?? "");
  const [grid, setGrid] = useState<TimetableGrid>(
    () => gradeGrids[availableGrades[0] ?? ""] ?? {},
  );
  const [isDirty, setIsDirty] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Drag state
  const dragPayload = useRef<DragPayload>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);

  // Assign popover
  const [assignCell, setAssignCell] = useState<string | null>(null); // key e.g. "3-2"

  const allocations = allocationsByGrade[selectedGrade] ?? [];

  // Switch grade
  const switchGrade = (grade: string) => {
    setSelectedGrade(grade);
    setGrid(gradeGrids[grade] ?? {});
    setIsDirty(false);
    setAssignCell(null);
  };

  // ── Drag handlers ──────────────────────────────────────────────────────────

  const handleDragStart = (e: React.DragEvent, key: string) => {
    const cell = grid[key];
    if (!cell) return;
    dragPayload.current = { type: "slot", slotId: cell.slotId, fromKey: key };
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent, key: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
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
      // Swap two filled cells (optimistic)
      setGrid((prev) => ({
        ...prev,
        [payload.fromKey]: toCell,
        [toKey]: fromCell,
      }));
      setIsDirty(true);

      startTransition(async () => {
        const result = await swapSlotsAction(fromCell.slotId, toCell.slotId);
        if (!result.success) {
          // Revert
          setGrid((prev) => ({
            ...prev,
            [payload.fromKey]: fromCell,
            [toKey]: toCell,
          }));
          toast.error(result.message);
        } else {
          toast.success("Lessons swapped.");
        }
      });
    } else {
      // Move to empty cell (optimistic)
      setGrid((prev) => {
        const next = { ...prev };
        delete next[payload.fromKey];
        next[toKey] = fromCell;
        return next;
      });
      setIsDirty(true);

      startTransition(async () => {
        const result = await moveSlotAction(
          fromCell.slotId,
          selectedGrade,
          toDay,
          toPeriod,
          academicYear,
        );
        if (!result.success) {
          setGrid((prev) => {
            const next = { ...prev };
            delete next[toKey];
            next[payload.fromKey] = fromCell;
            return next;
          });
          toast.error(result.message);
        } else {
          toast.success("Lesson moved.");
        }
      });
    }
  };

  // ── Clear a slot ───────────────────────────────────────────────────────────

  const handleClear = useCallback(
    (key: string) => {
      const cell = grid[key];
      if (!cell) return;

      // Optimistic
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
        } else {
          toast.success("Lesson removed.");
        }
      });
    },
    [grid],
  );

  // ── Assign to empty slot ───────────────────────────────────────────────────

  const handleAssign = useCallback(
    (key: string, allocation: GradeAllocation) => {
      setAssignCell(null);
      const [day, period] = key.split("-").map(Number) as [number, number];

      // Optimistic placeholder
      const optimisticCell = {
        slotId: "pending",
        teacherName: allocation.teacherName,
        subjectName: allocation.subjectName,
        subjectCode: allocation.subjectCode,
        allocationId: allocation.allocationId,
        teacherId: allocation.teacherId,
      };
      setGrid((prev) => ({ ...prev, [key]: optimisticCell }));
      setIsDirty(true);

      startTransition(async () => {
        const result = await assignSlotAction(
          selectedGrade,
          day,
          period,
          academicYear,
          allocation.allocationId,
        );
        if (!result.success) {
          setGrid((prev) => {
            const n = { ...prev };
            delete n[key];
            return n;
          });
          toast.error(result.message);
        } else {
          toast.success("Lesson assigned.");
        }
      });
    },
    [selectedGrade, academicYear],
  );

  // ── Stats ──────────────────────────────────────────────────────────────────

  const cells = Object.values(grid).filter(Boolean);
  const subjects = new Set(cells.map((c) => c!.subjectCode)).size;
  const total = DAYS.length * PERIODS.length;
  const filled = cells.length;

  // ── Render ─────────────────────────────────────────────────────────────────

  if (availableGrades.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 rounded-2xl border border-dashed border-white/10">
        <p className="text-4xl mb-3">📅</p>
        <p className="text-white/40 text-sm font-medium">
          No timetable generated yet
        </p>
        <p className="text-white/20 text-xs mt-1">
          Go to Subject Allocation → Generate Timetable
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Grade tabs */}
      <div className="flex flex-wrap gap-2 items-center">
        {availableGrades.map((grade) => (
          <button
            key={grade}
            onClick={() => switchGrade(grade)}
            className={`rounded-xl px-4 py-2 text-xs font-semibold transition-all ${
              grade === selectedGrade
                ? "bg-amber-400 text-[#0c0f1a] shadow-lg shadow-amber-400/20"
                : "border border-white/10 text-white/50 hover:text-white hover:border-white/20 hover:bg-white/5"
            }`}
          >
            {grade}
          </button>
        ))}

        <div className="ml-auto flex items-center gap-3">
          {isPending && (
            <span className="flex items-center gap-1.5 text-xs text-white/40">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving…
            </span>
          )}
          <span className="text-xs text-white/30">
            {filled}/{total} filled · {subjects} subject
            {subjects !== 1 ? "s" : ""}
          </span>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-[10px] text-white/30 flex-wrap">
        <span className="flex items-center gap-1.5">
          <GripVertical className="h-3 w-3" /> Drag to swap or move
        </span>
        <span className="flex items-center gap-1.5">
          <Plus className="h-3 w-3" /> Click empty cell to assign
        </span>
        <span className="flex items-center gap-1.5">
          <X className="h-3 w-3" /> Hover filled cell → X to remove
        </span>
        {isDirty && (
          <span className="flex items-center gap-1 text-amber-400/70 ml-auto">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            Changes saved automatically
          </span>
        )}
      </div>

      {/* Grid */}
      <div className="overflow-x-auto rounded-2xl border border-white/[0.08]">
        <table className="w-full min-w-[720px] border-collapse">
          <thead>
            <tr className="bg-white/[0.03]">
              <th className="w-28 px-4 py-3.5 text-left text-[10px] font-bold uppercase tracking-widest text-white/25 border-b border-r border-white/[0.07]">
                Period
              </th>
              {DAYS.map((day) => (
                <th
                  key={day}
                  className="px-3 py-3.5 text-center text-[10px] font-bold uppercase tracking-widest text-white/40 border-b border-white/[0.07]"
                >
                  {day}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PERIODS.map((period) => (
              <>
                {/* Break row before period 4 and 7 */}
                {BREAKS[period] && (
                  <tr key={`break-${period}`}>
                    <td
                      colSpan={6}
                      className="px-4 py-2 text-center text-[10px] font-bold uppercase tracking-widest text-white/15 bg-white/[0.015] border-y border-white/[0.05]"
                    >
                      {BREAKS[period]}
                    </td>
                  </tr>
                )}
                <tr key={period} className="group/row">
                  {/* Period label */}
                  <td className="px-4 py-2 border-b border-r border-white/[0.05] align-top w-28">
                    <p className="text-xs font-bold text-white/55">P{period}</p>
                    <p className="text-[10px] font-mono text-white/20 mt-0.5">
                      {PERIOD_TIMES[period]}
                    </p>
                  </td>

                  {/* Day cells */}
                  {DAYS.map((_, dayIdx) => {
                    const day = dayIdx + 1;
                    const key = `${day}-${period}`;
                    const cell = grid[key];
                    const isDropTarget = dragOver === key;
                    const isAssigning = assignCell === key;

                    return (
                      <td
                        key={dayIdx}
                        className="px-1.5 py-1.5 border-b border-white/[0.05] align-middle relative"
                        onDragOver={(e) => handleDragOver(e, key)}
                        onDragLeave={() => setDragOver(null)}
                        onDrop={(e) => handleDrop(e, key)}
                      >
                        {cell ? (
                          // ── Filled cell ──
                          <div
                            draggable
                            onDragStart={(e) => handleDragStart(e, key)}
                            className={[
                              "group/cell relative rounded-xl border px-2 py-2 cursor-grab active:cursor-grabbing transition-all",
                              palette(cell.subjectCode).bg,
                              isDropTarget
                                ? "scale-105 ring-2 ring-amber-400/50 ring-offset-1 ring-offset-transparent"
                                : "",
                              cell.slotId === "pending" ? "opacity-60" : "",
                            ].join(" ")}
                          >
                            {/* Drag handle */}
                            <GripVertical className="absolute top-1 left-1 h-3 w-3 text-white/20 opacity-0 group-hover/cell:opacity-100 transition-opacity" />

                            {/* Clear button */}
                            <button
                              onClick={() => handleClear(key)}
                              disabled={isPending || cell.slotId === "pending"}
                              aria-label="remove lesson"
                              className="absolute top-1 right-1 h-4 w-4 rounded-full bg-black/30 flex items-center justify-center opacity-0 group-hover/cell:opacity-100 hover:bg-rose-500/80 transition-all disabled:cursor-not-allowed"
                            >
                              <X className="h-2.5 w-2.5 text-white" />
                            </button>

                            <p className="text-[10px] font-bold font-mono uppercase tracking-wider mt-1 pl-2">
                              {cell.subjectCode}
                            </p>
                            <p className="text-[10px] leading-tight text-white/65 truncate pl-2 mt-0.5">
                              {cell.subjectName}
                            </p>
                            <p className="text-[9px] text-white/30 mt-1 pl-2 truncate">
                              {cell.teacherName
                                .split(" ")
                                .slice(0, 2)
                                .join(" ")}
                            </p>
                          </div>
                        ) : (
                          // ── Empty cell ──
                          <div
                            className={[
                              "relative h-[72px] rounded-xl border border-dashed transition-all",
                              isDropTarget
                                ? "border-amber-400/60 bg-amber-400/10 scale-[1.02]"
                                : "border-white/[0.06] hover:border-white/[0.18] hover:bg-white/[0.03]",
                            ].join(" ")}
                          >
                            <button
                              onClick={() =>
                                setAssignCell(isAssigning ? null : key)
                              }
                              disabled={isPending}
                              aria-label="assign lesson"
                              className="w-full h-full flex items-center justify-center text-white/15 hover:text-white/40 transition-colors disabled:cursor-not-allowed"
                            >
                              <Plus className="h-4 w-4" />
                            </button>

                            {/* Assign popover */}
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
              </>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
