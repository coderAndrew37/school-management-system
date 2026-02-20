"use client";

import { useState, useCallback, useTransition, useRef, useEffect } from "react";
import { toast } from "sonner";
import {
  Save,
  Loader2,
  Sparkles,
  ChevronDown,
  CheckCircle2,
  Edit3,
  X,
  RotateCcw,
} from "lucide-react";
import {
  batchUpsertAssessmentsAction,
  generateNarrativeAction,
  saveNarrativeAction,
} from "@/lib/actions/assessment";
import { getStrands, formatStrand, SCORE_COLORS } from "@/lib/types/assessment";
import type {
  CbcScore,
  AssessmentGridState,
  GridStudent,
} from "@/lib/types/assessment";

const SCORES: CbcScore[] = ["EE", "ME", "AE", "BE"];

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  students: GridStudent[];
  subjectName: string;
  grade: string;
  term: number;
  academicYear: number;
  initialGrid: AssessmentGridState;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function cellKey(studentId: string, subjectName: string, strandId: string) {
  return `${studentId}:${subjectName}:${strandId}`;
}

function countDirty(grid: AssessmentGridState) {
  return Object.values(grid).filter((c) => c.dirty).length;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function BatchAssessmentGrid({
  students,
  subjectName,
  grade,
  term,
  academicYear,
  initialGrid,
}: Props) {
  const strands = getStrands(grade, subjectName);
  const [grid, setGrid] = useState<AssessmentGridState>(initialGrid);
  const [narratives, setNarratives] = useState<Record<string, string | null>>(
    () => Object.fromEntries(students.map((s) => [s.id, s.narrative ?? null])),
  );
  const [editingNarrative, setEditingNarrative] = useState<string | null>(null); // student id
  const [draftNarrative, setDraftNarrative] = useState("");
  const [isSaving, startSave] = useTransition();
  const [genLoading, setGenLoading] = useState<Record<string, boolean>>({});
  const dirtyCount = countDirty(grid);

  // ── Score toggle ────────────────────────────────────────────────────────────
  const toggleScore = useCallback(
    (studentId: string, strandId: string, score: CbcScore) => {
      const key = cellKey(studentId, subjectName, strandId);
      const current = grid[key];
      // Clicking the active score clears it
      const next: CbcScore | null = current?.score === score ? null : score;
      setGrid((prev) => ({
        ...prev,
        [key]: {
          assessmentId: current?.assessmentId ?? null,
          score: next,
          dirty: true,
        },
      }));
    },
    [grid, subjectName],
  );

  // ── Batch save ──────────────────────────────────────────────────────────────
  const handleSave = () => {
    const dirtyRows = Object.entries(grid)
      .filter(([, cell]) => cell.dirty)
      .map(([key, cell]) => {
        const [studentId, subject, strandId] = key.split(":");
        return {
          studentId: studentId!,
          subjectName: subject!,
          strandId: strandId!,
          score: cell.score,
          term,
          academicYear,
        };
      });

    if (dirtyRows.length === 0) {
      toast.info("No changes to save");
      return;
    }

    startSave(async () => {
      const res = await batchUpsertAssessmentsAction(dirtyRows);
      if (res.success) {
        toast.success(
          `Saved ${res.savedCount} assessment${res.savedCount !== 1 ? "s" : ""}`,
          {
            icon: "✅",
          },
        );
        // Mark all dirty cells as clean
        setGrid((prev) => {
          const next = { ...prev };
          for (const key of Object.keys(next)) {
            if (next[key]!.dirty) next[key] = { ...next[key]!, dirty: false };
          }
          return next;
        });
      } else {
        toast.error("Save failed", { description: res.message });
      }
    });
  };

  // ── Keyboard navigation (Tab / Shift-Tab / Arrow keys) ─────────────────────
  // Grid cells have data-row and data-col; on arrow key move focus there
  const gridRef = useRef<HTMLTableElement>(null);

  const handleKeyDown = (
    e: React.KeyboardEvent<HTMLButtonElement>,
    rowIdx: number,
    strandIdx: number,
    scoreIdx: number,
  ) => {
    const colIdx = strandIdx * SCORES.length + scoreIdx;
    const totalCols = strands.length * SCORES.length;

    let nextRow = rowIdx;
    let nextCol = colIdx;

    if (e.key === "ArrowRight") {
      nextCol = Math.min(colIdx + 1, totalCols - 1);
    } else if (e.key === "ArrowLeft") {
      nextCol = Math.max(colIdx - 1, 0);
    } else if (e.key === "ArrowDown") {
      nextRow = Math.min(rowIdx + 1, students.length - 1);
    } else if (e.key === "ArrowUp") {
      nextRow = Math.max(rowIdx - 1, 0);
    } else return;

    e.preventDefault();
    const cell = gridRef.current?.querySelector<HTMLButtonElement>(
      `[data-row="${nextRow}"][data-col="${nextCol}"]`,
    );
    cell?.focus();
  };

  // ── AI narrative generation ─────────────────────────────────────────────────
  const generateNarrative = async (student: GridStudent) => {
    setGenLoading((prev) => ({ ...prev, [student.id]: true }));
    const fd = new FormData();
    fd.append("student_id", student.id);
    fd.append("student_name", student.full_name);
    fd.append("subject_name", subjectName);
    fd.append("grade", grade);
    fd.append("term", String(term));
    fd.append("academic_year", String(academicYear));

    const res = await generateNarrativeAction(fd);
    setGenLoading((prev) => ({ ...prev, [student.id]: false }));

    if (res.success && res.narrative) {
      setNarratives((prev) => ({ ...prev, [student.id]: res.narrative! }));
      toast.success("Narrative generated", { icon: "✨", duration: 2500 });
    } else {
      toast.error(res.message);
    }
  };

  // ── Narrative editing ───────────────────────────────────────────────────────
  const startEdit = (studentId: string) => {
    setDraftNarrative(narratives[studentId] ?? "");
    setEditingNarrative(studentId);
  };
  const cancelEdit = () => {
    setEditingNarrative(null);
    setDraftNarrative("");
  };
  const saveEdit = async (student: GridStudent) => {
    const fd = new FormData();
    fd.append("student_id", student.id);
    fd.append("subject_name", subjectName);
    fd.append("term", String(term));
    fd.append("academic_year", String(academicYear));
    fd.append("narrative", draftNarrative);
    const res = await saveNarrativeAction(fd);
    if (res.success) {
      setNarratives((prev) => ({ ...prev, [student.id]: draftNarrative }));
      setEditingNarrative(null);
      toast.success("Narrative saved");
    } else {
      toast.error(res.message);
    }
  };

  // ── Student score summary (for narrative section) ───────────────────────────
  const getStudentSummary = (studentId: string) => {
    const counts: Record<CbcScore, number> = { EE: 0, ME: 0, AE: 0, BE: 0 };
    for (const strandId of strands) {
      const key = cellKey(studentId, subjectName, strandId);
      const score = grid[key]?.score;
      if (score) counts[score]++;
    }
    return counts;
  };

  // ── Fill down (copy first row score to all students in same strand) ─────────
  const fillDown = (strandId: string, score: CbcScore) => {
    setGrid((prev) => {
      const next = { ...prev };
      for (const student of students) {
        const key = cellKey(student.id, subjectName, strandId);
        next[key] = {
          assessmentId: prev[key]?.assessmentId ?? null,
          score,
          dirty: true,
        };
      }
      return next;
    });
    toast.info(`All students set to ${score} for ${formatStrand(strandId)}`, {
      duration: 2000,
    });
  };

  // ── Clear strand column ──────────────────────────────────────────────────────
  const clearStrand = (strandId: string) => {
    setGrid((prev) => {
      const next = { ...prev };
      for (const student of students) {
        const key = cellKey(student.id, subjectName, strandId);
        next[key] = {
          assessmentId: prev[key]?.assessmentId ?? null,
          score: null,
          dirty: true,
        };
      }
      return next;
    });
  };

  return (
    <div className="space-y-6">
      {/* ── Toolbar ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {/* Legend */}
          <div className="flex items-center gap-2 flex-wrap">
            {SCORES.map((s) => (
              <span
                key={s}
                className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${SCORE_COLORS[s].bg} ${SCORE_COLORS[s].text} ${SCORE_COLORS[s].border}`}
              >
                {s}
              </span>
            ))}
          </div>
          {dirtyCount > 0 && (
            <span className="text-[11px] text-amber-400 font-semibold animate-pulse">
              {dirtyCount} unsaved change{dirtyCount !== 1 ? "s" : ""}
            </span>
          )}
        </div>
        <button
          onClick={handleSave}
          disabled={isSaving || dirtyCount === 0}
          className="flex items-center gap-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 px-5 py-2.5 text-sm font-bold text-white transition-all"
        >
          {isSaving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          {isSaving
            ? "Saving…"
            : `Save${dirtyCount > 0 ? ` (${dirtyCount})` : ""}`}
        </button>
      </div>

      {/* ── Grid ─────────────────────────────────────────────────────────────── */}
      <div
        className="overflow-x-auto rounded-2xl border border-white/[0.09]"
        style={{ maxHeight: "70vh" }}
      >
        <table
          ref={gridRef}
          className="w-full border-collapse text-sm"
          style={{ minWidth: `${220 + strands.length * 200}px` }}
        >
          {/* ── HEADER ──────────────────────────────────────────────────────── */}
          <thead className="sticky top-0 z-20">
            {/* Row 1: Strand names */}
            <tr className="bg-[#0f1623] border-b border-white/[0.09]">
              {/* Sticky name column */}
              <th
                className="sticky left-0 z-30 bg-[#0f1623] px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-widest text-white/30 min-w-[200px] border-r border-white/[0.07]"
                rowSpan={2}
              >
                Student
              </th>
              {strands.map((strandId) => (
                <th
                  key={strandId}
                  colSpan={SCORES.length}
                  className="px-2 py-2 text-center text-xs font-bold text-white border-l border-white/[0.07] group"
                >
                  <div className="flex items-center justify-center gap-1.5">
                    <span className="truncate max-w-[140px]">
                      {formatStrand(strandId)}
                    </span>
                    {/* Column actions dropdown */}
                    <StrandMenu
                      strandId={strandId}
                      onFillDown={fillDown}
                      onClear={clearStrand}
                    />
                  </div>
                </th>
              ))}
              {/* Narrative column */}
              <th
                className="px-3 py-2.5 text-center text-[10px] font-semibold uppercase tracking-widest text-purple-400/70 border-l border-white/[0.07] min-w-[220px]"
                rowSpan={2}
              >
                Narrative Remark
              </th>
            </tr>

            {/* Row 2: Score labels */}
            <tr className="bg-[#0f1623] border-b border-white/[0.09]">
              {strands.flatMap((strandId) =>
                SCORES.map((score) => (
                  <th
                    key={`${strandId}-${score}`}
                    className="px-1 py-1.5 text-center text-[9px] font-bold uppercase tracking-wider border-l border-white/[0.04]"
                    style={{ minWidth: 44 }}
                  >
                    <span
                      className={`px-1.5 py-0.5 rounded ${SCORE_COLORS[score].bg} ${SCORE_COLORS[score].text}`}
                    >
                      {score}
                    </span>
                  </th>
                )),
              )}
            </tr>
          </thead>

          {/* ── BODY ────────────────────────────────────────────────────────── */}
          <tbody>
            {students.length === 0 ? (
              <tr>
                <td
                  colSpan={1 + strands.length * SCORES.length + 1}
                  className="py-16 text-center text-sm text-white/30"
                >
                  No students found in {grade}
                </td>
              </tr>
            ) : (
              students.map((student, rowIdx) => {
                const summary = getStudentSummary(student.id);
                const rowNarrative = narratives[student.id];
                const isEditing = editingNarrative === student.id;
                const isGenLoading = genLoading[student.id] ?? false;
                const rowHasData = strands.some(
                  (st) => grid[cellKey(student.id, subjectName, st)]?.score,
                );

                return (
                  <tr
                    key={student.id}
                    className="border-b border-white/[0.05] hover:bg-white/[0.02] transition-colors group/row"
                  >
                    {/* ── Sticky name cell ──────────────────────────────────── */}
                    <td className="sticky left-0 z-10 bg-[#0c0f1a] group-hover/row:bg-[#101520] border-r border-white/[0.07] px-4 py-3 min-w-[200px] transition-colors">
                      <div className="flex flex-col gap-0.5">
                        <p className="text-sm font-semibold text-white leading-tight truncate">
                          {student.full_name}
                        </p>
                        {student.readable_id && (
                          <p className="text-[10px] font-mono text-white/25">
                            {student.readable_id}
                          </p>
                        )}
                        {/* Mini score summary badges */}
                        <div className="flex gap-1 mt-1 flex-wrap">
                          {(Object.entries(summary) as [CbcScore, number][])
                            .filter(([, count]) => count > 0)
                            .map(([score, count]) => (
                              <span
                                key={score}
                                className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${SCORE_COLORS[score].bg} ${SCORE_COLORS[score].text}`}
                              >
                                {score}·{count}
                              </span>
                            ))}
                        </div>
                      </div>
                    </td>

                    {/* ── Score cells ───────────────────────────────────────── */}
                    {strands.flatMap((strandId, strandIdx) =>
                      SCORES.map((score, scoreIdx) => {
                        const key = cellKey(student.id, subjectName, strandId);
                        const cell = grid[key];
                        const isActive = cell?.score === score;
                        const isDirty = cell?.dirty;
                        const colIdx = strandIdx * SCORES.length + scoreIdx;
                        const sc = SCORE_COLORS[score];

                        return (
                          <td
                            key={`${strandId}-${score}`}
                            className={`p-0.5 text-center border-l border-white/[0.04] ${strandIdx > 0 && scoreIdx === 0 ? "border-l border-white/[0.09]" : ""}`}
                          >
                            <button
                              data-row={rowIdx}
                              data-col={colIdx}
                              onClick={() =>
                                toggleScore(student.id, strandId, score)
                              }
                              onKeyDown={(e) =>
                                handleKeyDown(e, rowIdx, strandIdx, scoreIdx)
                              }
                              title={`${formatStrand(strandId)} — ${score}`}
                              className={[
                                "w-10 h-9 rounded-lg text-xs font-bold transition-all duration-100",
                                "focus:outline-none focus-visible:ring-2",
                                isActive
                                  ? `${sc.bg} ${sc.text} ${sc.border} border ${sc.ring} ring-1 scale-105`
                                  : "text-white/15 hover:bg-white/[0.06] hover:text-white/50",
                                isDirty && isActive
                                  ? "ring-2 ring-offset-1 ring-offset-[#0c0f1a]"
                                  : "",
                              ]
                                .filter(Boolean)
                                .join(" ")}
                            >
                              {isActive ? score : "·"}
                            </button>
                          </td>
                        );
                      }),
                    )}

                    {/* ── Narrative cell ────────────────────────────────────── */}
                    <td className="border-l border-white/[0.07] px-3 py-3 align-top min-w-[220px]">
                      {isEditing ? (
                        /* Edit mode */
                        <div className="space-y-2">
                          <textarea
                            value={draftNarrative}
                            onChange={(e) => setDraftNarrative(e.target.value)}
                            rows={4}
                            autoFocus
                            className="w-full rounded-lg border border-purple-400/30 bg-purple-400/5 px-2.5 py-2 text-xs text-white placeholder-white/25 outline-none focus:border-purple-400/60 resize-none leading-relaxed"
                            placeholder="Write narrative remark…"
                          />
                          <div className="flex gap-1.5">
                            <button
                              onClick={() => saveEdit(student)}
                              className="flex-1 rounded-lg bg-purple-500 hover:bg-purple-400 py-1.5 text-[10px] font-bold text-white transition-colors flex items-center justify-center gap-1"
                            >
                              <Save className="h-3 w-3" /> Save
                            </button>
                            <button
                              onClick={cancelEdit}
                              className="px-2.5 rounded-lg border border-white/10 text-white/40 hover:text-white text-[10px] transition-colors"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      ) : rowNarrative ? (
                        /* Has narrative */
                        <div className="group/narr relative">
                          <p className="text-xs text-white/60 leading-relaxed line-clamp-3">
                            {rowNarrative}
                          </p>
                          <div className="absolute top-0 right-0 flex gap-1 opacity-0 group-hover/narr:opacity-100 transition-opacity">
                            <button
                              onClick={() => startEdit(student.id)}
                              className="p-1 rounded hover:bg-white/10 text-white/30 hover:text-white transition-colors"
                              title="Edit"
                            >
                              <Edit3 className="h-3 w-3" />
                            </button>
                            <button
                              onClick={() =>
                                rowHasData && generateNarrative(student)
                              }
                              disabled={isGenLoading || !rowHasData}
                              className="p-1 rounded hover:bg-purple-400/10 text-white/30 hover:text-purple-400 disabled:opacity-30 transition-colors"
                              title="Regenerate"
                            >
                              {isGenLoading ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <RotateCcw className="h-3 w-3" />
                              )}
                            </button>
                          </div>
                        </div>
                      ) : (
                        /* No narrative yet */
                        <div className="flex flex-col gap-1.5">
                          <button
                            onClick={() =>
                              rowHasData && generateNarrative(student)
                            }
                            disabled={isGenLoading || !rowHasData}
                            title={
                              !rowHasData
                                ? "Enter scores first"
                                : "Generate AI narrative"
                            }
                            className={[
                              "flex items-center justify-center gap-1.5 rounded-lg px-2.5 py-2 text-[10px] font-semibold transition-all",
                              rowHasData
                                ? "border border-purple-400/30 bg-purple-400/5 text-purple-400 hover:bg-purple-400/15 hover:border-purple-400/50"
                                : "border border-white/5 text-white/20 cursor-not-allowed",
                            ].join(" ")}
                          >
                            {isGenLoading ? (
                              <>
                                <Loader2 className="h-3 w-3 animate-spin" />
                                Generating…
                              </>
                            ) : (
                              <>
                                <Sparkles className="h-3 w-3" />
                                Generate Remark
                              </>
                            )}
                          </button>
                          <button
                            onClick={() => startEdit(student.id)}
                            className="flex items-center justify-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[10px] text-white/30 hover:text-white/60 border border-transparent hover:border-white/10 transition-all"
                          >
                            <Edit3 className="h-3 w-3" /> Write manually
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* ── Footer: bulk generate all ────────────────────────────────────────── */}
      <div className="flex items-center justify-between pt-2 border-t border-white/[0.06]">
        <p className="text-xs text-white/30">
          {students.filter((s) => narratives[s.id]).length} / {students.length}{" "}
          narratives generated
        </p>
        <BulkGenerateButton
          students={students}
          narratives={narratives}
          onGenerate={generateNarrative}
          loading={genLoading}
          gridHasData={(sid) =>
            strands.some((st) => grid[cellKey(sid, subjectName, st)]?.score)
          }
        />
      </div>
    </div>
  );
}

// ── Strand column context menu ────────────────────────────────────────────────

function StrandMenu({
  strandId,
  onFillDown,
  onClear,
}: {
  strandId: string;
  onFillDown: (strandId: string, score: CbcScore) => void;
  onClear: (strandId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div ref={ref} className="relative inline-block">
      <button
        onClick={() => setOpen((v) => !v)}
        className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-white/10 text-white/30 hover:text-white transition-all"
        title="Column actions"
      >
        <ChevronDown className="h-3 w-3" />
      </button>
      {open && (
        <div className="absolute left-1/2 -translate-x-1/2 top-full mt-1 z-50 w-44 rounded-xl border border-white/[0.12] bg-[#141925] shadow-2xl py-1 text-xs">
          <p className="px-3 pt-1 pb-1.5 text-[9px] uppercase tracking-widest text-white/30 font-semibold">
            Fill all students
          </p>
          {SCORES.map((score) => (
            <button
              key={score}
              onClick={() => {
                onFillDown(strandId, score);
                setOpen(false);
              }}
              className={`w-full flex items-center gap-2 px-3 py-1.5 hover:bg-white/[0.06] transition-colors ${SCORE_COLORS[score].text}`}
            >
              <span
                className={`text-[9px] font-bold px-1.5 rounded ${SCORE_COLORS[score].bg}`}
              >
                {score}
              </span>
              <span className="text-white/70 text-[10px]">
                Set all to {score}
              </span>
            </button>
          ))}
          <div className="border-t border-white/[0.07] my-1" />
          <button
            onClick={() => {
              onClear(strandId);
              setOpen(false);
            }}
            className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-white/[0.06] transition-colors text-white/40"
          >
            <X className="h-3 w-3" />
            <span className="text-[10px]">Clear column</span>
          </button>
        </div>
      )}
    </div>
  );
}

// ── Bulk generate narratives button ──────────────────────────────────────────

function BulkGenerateButton({
  students,
  narratives,
  onGenerate,
  loading,
  gridHasData,
}: {
  students: GridStudent[];
  narratives: Record<string, string | null>;
  onGenerate: (student: GridStudent) => Promise<void>;
  loading: Record<string, boolean>;
  gridHasData: (studentId: string) => boolean;
}) {
  const [isRunning, setIsRunning] = useState(false);
  const pending = students.filter(
    (s) => !narratives[s.id] && gridHasData(s.id),
  );

  const handleBulk = async () => {
    if (pending.length === 0) return;
    setIsRunning(true);
    for (const student of pending) {
      await onGenerate(student);
    }
    setIsRunning(false);
    toast.success(
      `Generated ${pending.length} narrative${pending.length !== 1 ? "s" : ""}`,
      { icon: "✨" },
    );
  };

  if (pending.length === 0) {
    return (
      <span className="flex items-center gap-1.5 text-xs text-emerald-400/60">
        <CheckCircle2 className="h-3.5 w-3.5" />
        All narratives complete
      </span>
    );
  }

  return (
    <button
      onClick={handleBulk}
      disabled={isRunning}
      className="flex items-center gap-2 rounded-xl border border-purple-400/30 bg-purple-400/5 hover:bg-purple-400/15 disabled:opacity-50 px-4 py-2 text-xs font-semibold text-purple-400 transition-all"
    >
      {isRunning ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <Sparkles className="h-3.5 w-3.5" />
      )}
      {isRunning
        ? "Generating…"
        : `Generate ${pending.length} missing remark${pending.length !== 1 ? "s" : ""}`}
    </button>
  );
}
