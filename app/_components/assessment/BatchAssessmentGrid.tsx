"use client";

import { useState, useCallback, useTransition, useRef, useEffect } from "react";
import { toast } from "sonner";
import {
  CheckCircle2,
  ChevronDown,
  Edit3,
  Loader2,
  RefreshCw,
  Save,
  Sparkles,
  X,
} from "lucide-react";
import {
  batchUpsertAssessmentsAction,
  generateNarrativeAction,
  saveNarrativeAction,
} from "@/lib/actions/assessment";
import {
  buildTemplateRemark,
  summariseScores,
} from "@/lib/utils/remark-templates";
import { getStrands, formatStrand, SCORE_COLORS } from "@/lib/types/assessment";
import type {
  CbcScore,
  AssessmentGridState,
  GridStudent,
} from "@/lib/types/assessment";

const SCORES: CbcScore[] = ["EE", "ME", "AE", "BE"];

// ── Score styling — light mode ────────────────────────────────────────────────

const SCORE_LIGHT: Record<
  CbcScore,
  { active: string; text: string; ring: string; pill: string }
> = {
  EE: {
    active: "bg-emerald-500 border-emerald-600 shadow-emerald-200",
    text: "text-white",
    ring: "ring-emerald-300",
    pill: "bg-emerald-100 text-emerald-700 border border-emerald-200",
  },
  ME: {
    active: "bg-sky-500 border-sky-600 shadow-sky-200",
    text: "text-white",
    ring: "ring-sky-300",
    pill: "bg-sky-100 text-sky-700 border border-sky-200",
  },
  AE: {
    active: "bg-amber-400 border-amber-500 shadow-amber-200",
    text: "text-white",
    ring: "ring-amber-300",
    pill: "bg-amber-100 text-amber-700 border border-amber-200",
  },
  BE: {
    active: "bg-red-400 border-red-500 shadow-red-200",
    text: "text-white",
    ring: "ring-red-300",
    pill: "bg-red-100 text-red-700 border border-red-200",
  },
};

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  students: GridStudent[];
  subjectName: string;
  grade: string;
  term: number;
  academicYear: number;
  initialGrid: AssessmentGridState;
  prevTermScores: AssessmentGridState | null; // Term N-1 scores for copy-forward
  hasPrevTerm: boolean; // true if prev term has any scores
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
  prevTermScores,
  hasPrevTerm,
}: Props) {
  const strands = getStrands(grade, subjectName);
  const [grid, setGrid] = useState<AssessmentGridState>(initialGrid);
  const [narratives, setNarratives] = useState<Record<string, string | null>>(
    () => Object.fromEntries(students.map((s) => [s.id, s.narrative ?? null])),
  );
  const [editingNarrative, setEditingNarrative] = useState<string | null>(null);
  const [draftNarrative, setDraftNarrative] = useState("");
  const [isSaving, startSave] = useTransition();
  const [isGenerating, startGenerate] = useTransition();
  const dirtyCount = countDirty(grid);
  const gridRef = useRef<HTMLTableElement>(null);

  // ── Score toggle ─────────────────────────────────────────────────────────
  const toggleScore = useCallback(
    (studentId: string, strandId: string, score: CbcScore) => {
      const key = cellKey(studentId, subjectName, strandId);
      const current = grid[key];
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

  // ── Batch save ────────────────────────────────────────────────────────────
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
        );
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

  // ── Keyboard navigation ───────────────────────────────────────────────────
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

    if (e.key === "ArrowRight") nextCol = Math.min(colIdx + 1, totalCols - 1);
    else if (e.key === "ArrowLeft") nextCol = Math.max(colIdx - 1, 0);
    else if (e.key === "ArrowDown")
      nextRow = Math.min(rowIdx + 1, students.length - 1);
    else if (e.key === "ArrowUp") nextRow = Math.max(rowIdx - 1, 0);
    else return;

    e.preventDefault();
    gridRef.current
      ?.querySelector<HTMLButtonElement>(
        `[data-row="${nextRow}"][data-col="${nextCol}"]`,
      )
      ?.focus();
  };

  // ── Narrative editing ─────────────────────────────────────────────────────
  const startEdit = (studentId: string) => {
    const existing = narratives[studentId];
    if (existing) {
      // Has existing remark — edit it as-is
      setDraftNarrative(existing);
    } else {
      // No remark yet — pre-fill with template based on current scores
      const student = students.find((s) => s.id === studentId);
      const summary = summariseScores(studentId, subjectName, strands, grid);
      setDraftNarrative(
        student
          ? buildTemplateRemark(student.full_name, grade, subjectName, summary)
          : "",
      );
    }
    setEditingNarrative(studentId);
  };
  const cancelEdit = () => {
    setEditingNarrative(null);
    setDraftNarrative("");
  };

  const applyTemplate = (studentId: string) => {
    const student = students.find((s) => s.id === studentId);
    if (!student) return;
    const summary = summariseScores(studentId, subjectName, strands, grid);
    setDraftNarrative(
      buildTemplateRemark(student.full_name, grade, subjectName, summary),
    );
  };

  const generateAiRemark = (student: GridStudent) => {
    startGenerate(async () => {
      const fd = new FormData();
      fd.append("student_id", student.id);
      fd.append("student_name", student.full_name);
      fd.append("subject_name", subjectName);
      fd.append("grade", grade);
      fd.append("term", String(term));
      fd.append("academic_year", String(academicYear));
      const res = await generateNarrativeAction(fd);
      if (res.success && res.narrative) {
        setDraftNarrative(res.narrative);
        toast.success("AI remark generated — review and save.");
      } else {
        toast.error(res.message ?? "Generation failed");
      }
    });
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
      toast.success("Remark saved");
    } else {
      toast.error(res.message);
    }
  };

  // ── Score summary per student ─────────────────────────────────────────────
  const getStudentSummary = (studentId: string) => {
    const counts: Record<CbcScore, number> = { EE: 0, ME: 0, AE: 0, BE: 0 };
    for (const strandId of strands) {
      const key = cellKey(studentId, subjectName, strandId);
      const score = grid[key]?.score;
      if (score) counts[score]++;
    }
    return counts;
  };

  // ── Fill down ─────────────────────────────────────────────────────────────
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

  // ── Clear strand column ───────────────────────────────────────────────────
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

  // ── Copy from previous term ───────────────────────────────────────────────
  const copyFromPrevTerm = useCallback(() => {
    if (!prevTermScores) return;
    setGrid((prev) => {
      const next = { ...prev };
      // Only copy into cells that are currently empty
      for (const [key, cell] of Object.entries(prevTermScores)) {
        if (!cell.score) continue;
        // Rekey: prevTermScores uses same key format, same subjectName
        if (!next[key]?.score) {
          next[key] = { assessmentId: null, score: cell.score, dirty: true };
        }
      }
      return next;
    });
    toast.info(`Copied Term ${term - 1} scores as a starting point`, {
      duration: 3000,
    });
  }, [prevTermScores, term]);

  const narrativeCount = students.filter((s) => narratives[s.id]).length;

  return (
    <div className="space-y-5">
      {/* ── Toolbar ───────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
        <div className="flex items-center gap-3 flex-wrap">
          {/* Score legend */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {SCORES.map((s) => (
              <span
                key={s}
                className={`text-[10px] font-bold px-2 py-0.5 rounded-lg ${SCORE_LIGHT[s].pill}`}
              >
                {s}
              </span>
            ))}
          </div>

          {/* Copy-forward banner */}
          {hasPrevTerm && term > 1 && (
            <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2">
              <span className="text-[11px] text-amber-700 font-semibold">
                Term {term - 1} scores available
              </span>
              <button
                onClick={copyFromPrevTerm}
                className="flex items-center gap-1 rounded-lg bg-amber-100 hover:bg-amber-200 border border-amber-200 px-2.5 py-1 text-[10px] font-bold text-amber-800 transition-colors"
              >
                Copy as starting point →
              </button>
            </div>
          )}
          {/* Unsaved indicator */}
          {dirtyCount > 0 && (
            <span className="text-[11px] text-amber-600 font-semibold">
              {dirtyCount} unsaved change{dirtyCount !== 1 ? "s" : ""}
            </span>
          )}
        </div>

        <button
          onClick={handleSave}
          disabled={isSaving || dirtyCount === 0}
          className="flex items-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 px-5 py-2.5 text-sm font-bold text-white transition-all shadow-sm shadow-emerald-200"
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

      {/* ── Grid ─────────────────────────────────────────────────────────── */}
      <div
        className="overflow-x-auto rounded-2xl border border-slate-200 shadow-sm bg-white"
        style={{ maxHeight: "70vh" }}
      >
        <table
          ref={gridRef}
          className="w-full border-collapse text-sm"
          style={{ minWidth: `${240 + strands.length * 200}px` }}
        >
          {/* ── THEAD ───────────────────────────────────────────────────── */}
          <thead className="sticky top-0 z-20">
            {/* Row 1: Strand names */}
            <tr className="bg-slate-50 border-b border-slate-200">
              <th
                className="sticky left-0 z-30 bg-slate-50 px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-slate-400 min-w-[220px] border-r border-slate-200"
                rowSpan={2}
              >
                Learner
              </th>
              {strands.map((strandId) => (
                <th
                  key={strandId}
                  colSpan={SCORES.length}
                  className="px-2 py-2.5 text-center text-xs font-bold text-slate-700 border-l border-slate-200 group"
                >
                  <div className="flex items-center justify-center gap-1.5">
                    <span className="truncate max-w-[140px]">
                      {formatStrand(strandId)}
                    </span>
                    <StrandMenu
                      strandId={strandId}
                      onFillDown={fillDown}
                      onClear={clearStrand}
                    />
                  </div>
                </th>
              ))}
              <th
                className="px-3 py-2.5 text-center text-[10px] font-black uppercase tracking-widest text-indigo-500 border-l border-slate-200 min-w-[220px]"
                rowSpan={2}
              >
                Teacher's Remark
              </th>
            </tr>

            {/* Row 2: Score label pills */}
            <tr className="bg-slate-50 border-b border-slate-200">
              {strands.flatMap((strandId) =>
                SCORES.map((score) => (
                  <th
                    key={`${strandId}-${score}`}
                    className="px-1 py-1.5 text-center border-l border-slate-100"
                    style={{ minWidth: 44 }}
                  >
                    <span
                      className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md ${SCORE_LIGHT[score].pill}`}
                    >
                      {score}
                    </span>
                  </th>
                )),
              )}
            </tr>
          </thead>

          {/* ── TBODY ───────────────────────────────────────────────────── */}
          <tbody className="divide-y divide-slate-100">
            {students.length === 0 ? (
              <tr>
                <td
                  colSpan={1 + strands.length * SCORES.length + 1}
                  className="py-16 text-center text-sm text-slate-400"
                >
                  No learners found in {grade}
                </td>
              </tr>
            ) : (
              students.map((student, rowIdx) => {
                const summary = getStudentSummary(student.id);
                const rowNarrative = narratives[student.id];
                const isEditing = editingNarrative === student.id;
                const hasAnyScore = strands.some(
                  (st) => grid[cellKey(student.id, subjectName, st)]?.score,
                );

                // Row stripe: alternate very slightly for readability
                const rowBg = rowIdx % 2 === 0 ? "bg-white" : "bg-slate-50/60";

                return (
                  <tr
                    key={student.id}
                    className={`${rowBg} hover:bg-emerald-50/40 transition-colors group/row`}
                  >
                    {/* ── Name cell ─────────────────────────────────────── */}
                    <td
                      className={`sticky left-0 z-10 ${rowBg} group-hover/row:bg-emerald-50/40 border-r border-slate-200 px-4 py-3 min-w-[220px] transition-colors`}
                    >
                      <div className="flex flex-col gap-0.5">
                        <p className="text-sm font-semibold text-slate-800 leading-tight truncate">
                          {student.full_name}
                        </p>
                        {student.readable_id && (
                          <p className="text-[10px] font-mono text-slate-400">
                            {student.readable_id}
                          </p>
                        )}
                        {/* Score summary pills */}
                        <div className="flex gap-1 mt-1 flex-wrap">
                          {(Object.entries(summary) as [CbcScore, number][])
                            .filter(([, count]) => count > 0)
                            .map(([score, count]) => (
                              <span
                                key={score}
                                className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md ${SCORE_LIGHT[score].pill}`}
                              >
                                {score}·{count}
                              </span>
                            ))}
                        </div>
                      </div>
                    </td>

                    {/* ── Score cells ───────────────────────────────────── */}
                    {strands.flatMap((strandId, strandIdx) =>
                      SCORES.map((score, scoreIdx) => {
                        const key = cellKey(student.id, subjectName, strandId);
                        const cell = grid[key];
                        const isActive = cell?.score === score;
                        const isDirty = cell?.dirty;
                        const colIdx = strandIdx * SCORES.length + scoreIdx;
                        const sc = SCORE_LIGHT[score];

                        return (
                          <td
                            key={`${strandId}-${score}`}
                            className={[
                              "p-0.5 text-center border-l",
                              strandIdx > 0 && scoreIdx === 0
                                ? "border-slate-200"
                                : "border-slate-100",
                            ].join(" ")}
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
                                  ? `${sc.active} ${sc.text} border shadow-sm ring-1 ${sc.ring} scale-105`
                                  : "text-slate-300 hover:bg-slate-100 hover:text-slate-600",
                                isDirty && isActive
                                  ? `ring-2 ring-offset-1 ring-offset-white`
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

                    {/* ── Remark cell ───────────────────────────────────── */}
                    <td className="border-l border-slate-200 px-3 py-3 align-top min-w-[220px]">
                      {isEditing ? (
                        <div className="space-y-2">
                          {/* Template + AI helper buttons */}
                          <div className="flex gap-1.5">
                            <button
                              type="button"
                              onClick={() => applyTemplate(student.id)}
                              title="Fill with score-based template"
                              className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 px-2 py-1 text-[9px] font-bold text-slate-500 transition-colors"
                            >
                              <RefreshCw className="h-2.5 w-2.5" /> Template
                            </button>
                            <button
                              type="button"
                              onClick={() => generateAiRemark(student)}
                              disabled={isGenerating}
                              title="Generate richer remark with AI"
                              className="flex items-center gap-1 rounded-lg border border-violet-200 bg-violet-50 hover:bg-violet-100 px-2 py-1 text-[9px] font-bold text-violet-600 transition-colors disabled:opacity-50"
                            >
                              {isGenerating ? (
                                <Loader2 className="h-2.5 w-2.5 animate-spin" />
                              ) : (
                                <Sparkles className="h-2.5 w-2.5" />
                              )}
                              AI Generate
                            </button>
                          </div>
                          <textarea
                            value={draftNarrative}
                            onChange={(e) => setDraftNarrative(e.target.value)}
                            rows={4}
                            autoFocus
                            className="w-full rounded-lg border border-indigo-200 bg-indigo-50/50 px-2.5 py-2 text-xs text-slate-700 placeholder-slate-400 outline-none focus:border-indigo-400 resize-none leading-relaxed"
                            placeholder="Write teacher's remark…"
                          />
                          <div className="flex gap-1.5">
                            <button
                              onClick={() => saveEdit(student)}
                              className="flex-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 py-1.5 text-[10px] font-bold text-white transition-colors flex items-center justify-center gap-1"
                            >
                              <Save className="h-3 w-3" /> Save
                            </button>
                            <button
                              aria-label="cancel editing"
                              onClick={cancelEdit}
                              className="px-2.5 rounded-lg border border-slate-200 text-slate-400 hover:text-slate-700 text-[10px] transition-colors"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      ) : rowNarrative ? (
                        /* Has remark */
                        <div className="group/remark relative">
                          <p className="text-xs text-slate-600 leading-relaxed line-clamp-3 pr-6">
                            {rowNarrative}
                          </p>
                          <button
                            onClick={() => startEdit(student.id)}
                            className="absolute top-0 right-0 p-1 rounded opacity-0 group-hover/remark:opacity-100 hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-all"
                            title="Edit remark"
                          >
                            <Edit3 className="h-3 w-3" />
                          </button>
                        </div>
                      ) : (
                        /* No remark yet */
                        <button
                          onClick={() => startEdit(student.id)}
                          className="flex items-center gap-1.5 rounded-lg border border-dashed border-slate-200 px-3 py-2 text-[10px] font-semibold text-slate-400 hover:border-indigo-300 hover:text-indigo-600 hover:bg-indigo-50/50 transition-all w-full"
                        >
                          <Edit3 className="h-3 w-3 flex-shrink-0" />
                          Write remark
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between pt-1">
        <p className="text-xs text-slate-400 font-medium">
          {narrativeCount}/{students.length} remarks written
        </p>
        {dirtyCount > 0 && (
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 active:scale-95 px-4 py-2 text-xs font-bold text-white transition-all shadow-sm"
          >
            {isSaving ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Save className="h-3.5 w-3.5" />
            )}
            Save {dirtyCount} change{dirtyCount !== 1 ? "s" : ""}
          </button>
        )}
        {dirtyCount === 0 &&
          narrativeCount === students.length &&
          students.length > 0 && (
            <span className="flex items-center gap-1.5 text-xs text-emerald-600 font-semibold">
              <CheckCircle2 className="h-3.5 w-3.5" />
              All complete
            </span>
          )}
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
        className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-slate-200 text-slate-400 hover:text-slate-700 transition-all"
        title="Column actions"
      >
        <ChevronDown className="h-3 w-3" />
      </button>
      {open && (
        <div className="absolute left-1/2 -translate-x-1/2 top-full mt-1 z-50 w-44 rounded-xl border border-slate-200 bg-white shadow-xl py-1.5 text-xs">
          <p className="px-3 pt-0.5 pb-1.5 text-[9px] uppercase tracking-widest text-slate-400 font-bold">
            Fill all learners
          </p>
          {SCORES.map((score) => (
            <button
              key={score}
              onClick={() => {
                onFillDown(strandId, score);
                setOpen(false);
              }}
              className="w-full flex items-center gap-2.5 px-3 py-1.5 hover:bg-slate-50 transition-colors text-slate-700"
            >
              <span
                className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md ${SCORE_LIGHT[score].pill}`}
              >
                {score}
              </span>
              <span className="text-[10px] text-slate-600">
                Set all to {score}
              </span>
            </button>
          ))}
          <div className="border-t border-slate-100 my-1" />
          <button
            onClick={() => {
              onClear(strandId);
              setOpen(false);
            }}
            className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-slate-50 transition-colors text-slate-400"
          >
            <X className="h-3 w-3" />
            <span className="text-[10px]">Clear column</span>
          </button>
        </div>
      )}
    </div>
  );
}
