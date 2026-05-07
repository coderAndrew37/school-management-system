"use client";

/**
 * BulkAdmitStudentEditor
 *
 * Slim orchestrator: owns rows + metas state, wires callbacks, renders
 * the list. All rendering concerns live in child components.
 *
 * File map:
 *   BulkAdmitStudentEditor.tsx   ← you are here (state + layout shell)
 *   StudentRow.tsx               ← single row card (fields + parent toggle)
 *   ParentPanel.tsx              ← collapsible parent section
 *   ParentSearch.tsx             ← combobox search widget
 *   StudentPhotoCell.tsx         ← thumbnail + file picker
 *   useParentSearch.ts           ← async search hook (useReducer, no setState-in-effect)
 *   types.ts                     ← shared types, factories, pure helpers
 */

import type { BulkAdmitRow } from "@/lib/actions/bulk-admit";
import type { ParentSearchResult } from "@/lib/actions/admit";
import { GraduationCap, Loader2, Plus, Save } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { StudentRow } from "./StudentRow";
import { blankMeta, blankRow, isRowComplete, type ClassOption, type RowMeta } from "./types";

interface Props {
  classes: ClassOption[];
  rows: BulkAdmitRow[];
  setRows: React.Dispatch<React.SetStateAction<BulkAdmitRow[]>>;
  isPending: boolean;
  onSubmit: () => void;
}

export function BulkAdmitStudentEditor({ classes, rows, setRows, isPending, onSubmit }: Props) {
  const [metas, setMetas] = useState<RowMeta[]>([blankMeta()]);

  // ── Derived ──────────────────────────────────────────────────────────────
  const availableGrades = useMemo(
    () => Array.from(new Set(classes.map((c) => c.grade))).sort(),
    [classes]
  );

  const streamsFor = useCallback(
    (grade: string) => classes.filter((c) => c.grade === grade).map((c) => c.stream),
    [classes]
  );

  const firstGrade = availableGrades[0] ?? "";
  const firstStream = streamsFor(firstGrade)[0] ?? "Main";

  const safeMeta = (i: number) => metas[i] ?? blankMeta();
  const completedCount = rows.filter((r, i) => isRowComplete(r, safeMeta(i))).length;
  const namedCount = rows.filter((r) => r.studentName.trim()).length;

  // ── Row mutations — always update rows + metas atomically ────────────────
  const addRow = () => {
    setRows((p) => [...p, blankRow(firstGrade, firstStream)]);
    setMetas((p) => [...p, blankMeta()]);
  };

  const duplicateRow = (i: number) => {
    setRows((p) => {
      const n = [...p];
      n.splice(i + 1, 0, { ...p[i], studentName: "", dateOfBirth: "" });
      return n;
    });
    setMetas((p) => {
      const n = [...p];
      // Inherit parent selection but not photo — photos are per-student
      n.splice(i + 1, 0, {
        ...blankMeta(),
        selectedParent: p[i].selectedParent,
      });
      return n;
    });
  };

  const removeRow = (i: number) => {
    if (rows.length === 1) return;
    setRows((p) => p.filter((_, x) => x !== i));
    setMetas((p) => p.filter((_, x) => x !== i));
  };

  const updateRow = useCallback(
    <K extends keyof BulkAdmitRow>(i: number, field: K, value: BulkAdmitRow[K]) => {
      setRows((prev) =>
        prev.map((row, idx) => {
          if (idx !== i) return row;
          if (field === "currentGrade") {
            return {
              ...row,
              currentGrade: value as string,
              stream: streamsFor(value as string)[0] ?? "Main",
            };
          }
          return { ...row, [field]: value };
        })
      );
    },
    [streamsFor, setRows]
  );

  const updateMeta = useCallback((i: number, patch: Partial<RowMeta>) => {
    setMetas((p) => p.map((m, idx) => (idx === i ? { ...m, ...patch } : m)));
  }, []);

  const selectParent = useCallback(
    (i: number, parent: ParentSearchResult | null) => {
      updateMeta(i, { selectedParent: parent });
      setRows((prev) =>
        prev.map((row, idx) => {
          if (idx !== i) return row;
          if (parent)
            return {
              ...row,
              parentMode: "existing",
              existingParentId: parent.id,
              parentName: "",
              parentEmail: "",
              parentPhone: "",
            };
          return { ...row, parentMode: "new", existingParentId: null };
        })
      );
    },
    [updateMeta, setRows]
  );

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className="h-9 w-9 rounded-xl bg-amber-400/10 border border-amber-400/20 flex items-center justify-center"
            aria-hidden="true"
          >
            <GraduationCap className="h-4.5 w-4.5 text-amber-400" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              Student Batch Admission
              <span
                className="text-xs font-mono text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-lg border border-amber-400/15"
                aria-label={`${completedCount} of ${rows.length} students complete`}
              >
                {completedCount}/{rows.length}
              </span>
            </h2>
            <p className="text-xs text-white/30 mt-0.5">
              Expand each row to add parent · press{" "}
              <kbd className="px-1 py-0.5 rounded bg-white/10 font-mono text-[10px]">Esc</kbd> to
              close panel
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={addRow}
          aria-label="Add another student row"
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.08] text-white/50 hover:text-amber-400 hover:border-amber-400/25 hover:bg-amber-400/[0.03] transition-all text-xs font-bold uppercase tracking-wider"
        >
          <Plus className="h-3.5 w-3.5" aria-hidden="true" /> Add Student
        </button>
      </div>

      {/* Column headers — desktop only */}
      <div
        className="hidden lg:flex items-center gap-2 px-4 pb-1 text-[10px] font-bold uppercase tracking-widest text-white/20"
        aria-hidden="true"
      >
        <div className="w-10 shrink-0">Photo</div>
        <div className="w-7 shrink-0">#</div>
        <div className="flex-1 min-w-[180px]">Student Name</div>
        <div className="w-36">Date of Birth</div>
        <div className="w-[88px]">Gender</div>
        <div className="w-28">Grade</div>
        {/* Stream header only when at least one grade has real streams */}
        {classes.some((c) => c.stream !== "Main") && (
          <div className="w-24">Stream</div>
        )}
        <div className="w-[104px]">Guardian</div>
        <div className="w-[72px]"></div>
      </div>

      {/* Rows */}
      <ol className="space-y-2.5" aria-label="Student admission rows">
        {rows.map((row, i) => (
          <StudentRow
            key={i}
            index={i}
            row={row}
            meta={safeMeta(i)}
            availableGrades={availableGrades}
            classes={classes}
            streamsFor={streamsFor}
            onRowChange={(field, value) => updateRow(i, field, value)}
            onMetaChange={(patch) => updateMeta(i, patch)}
            onSelectParent={(p) => selectParent(i, p)}
            onDuplicate={() => duplicateRow(i)}
            onRemove={() => removeRow(i)}
            canRemove={rows.length > 1}
          />
        ))}
      </ol>

      {/* Add row CTA */}
      <button
        type="button"
        onClick={addRow}
        aria-label="Add another student"
        className="w-full py-3.5 flex items-center justify-center gap-2 rounded-2xl border border-dashed border-white/[0.07] hover:border-amber-400/20 text-white/20 hover:text-amber-400/60 hover:bg-amber-400/[0.02] transition-all text-xs font-medium tracking-wide"
      >
        <Plus className="h-3.5 w-3.5" aria-hidden="true" /> Add another student
      </button>

      {/* Progress bar */}
      {rows.length > 0 && (
        <div className="space-y-1.5">
          <div className="flex justify-between text-[10px] text-white/25" aria-hidden="true">
            <span>{completedCount} of {rows.length} complete</span>
            {namedCount > completedCount && (
              <span className="text-amber-400/40">
                {namedCount - completedCount} missing parent info
              </span>
            )}
          </div>
          <div
            className="h-0.5 rounded-full bg-white/[0.05] overflow-hidden"
            role="progressbar"
           aria-label={`${completedCount} of ${rows.length} students complete`}
          >
            <div
              className="h-full rounded-full bg-gradient-to-r from-amber-400 to-amber-300 transition-all duration-500"
              style={{ width: `${rows.length ? (completedCount / rows.length) * 100 : 0}%` }}
            />
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between pt-1">
        <p className="text-xs text-white/30" aria-live="polite">
          {completedCount > 0
            ? `${completedCount} student${completedCount > 1 ? "s" : ""} ready — parent accounts will be created and invited`
            : "Fill in student details and expand to add parent info"}
        </p>
        <button
          type="button"
          onClick={onSubmit}
          disabled={isPending || completedCount === 0}
          aria-label={
            isPending
              ? "Processing admission"
              : `Admit ${completedCount} student${completedCount !== 1 ? "s" : ""}`
          }
          className="flex items-center gap-2.5 bg-amber-400 disabled:bg-white/[0.06] text-[#0c0f1a] font-bold px-8 py-3.5 rounded-xl hover:bg-amber-300 active:scale-[0.97] transition-all shadow-lg shadow-amber-400/15 disabled:text-white/15 disabled:shadow-none text-sm"
        >
          {isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Processing…
            </>
          ) : (
            <>
              <Save className="h-4 w-4" aria-hidden="true" /> Admit {completedCount || ""}{" "}
              Student{completedCount !== 1 ? "s" : ""}
            </>
          )}
        </button>
      </div>

      {/* Shared input styles */}
      <style>{`
        .g-input {
          background: transparent;
          border: 1px solid transparent;
          border-radius: 8px;
          padding: 6px 10px;
          color: rgba(255,255,255,0.82);
          font-size: 13px;
          outline: none;
          transition: border-color .12s, background .12s;
        }
        .g-input::placeholder { color: rgba(255,255,255,0.18); }
        .g-input:hover { border-color: rgba(255,255,255,0.1); background: rgba(255,255,255,0.025); }
        .g-input:focus { border-color: rgba(251,191,36,.45); background: rgba(251,191,36,.04); box-shadow: 0 0 0 3px rgba(251,191,36,.06); }
        .g-input option { background: #0c0f1a; }
        input[type="date"].g-input::-webkit-calendar-picker-indicator { filter: invert(0.35); cursor: pointer; }

        .p-input {
          background: rgba(255,255,255,.035);
          border: 1px solid rgba(255,255,255,.08);
          border-radius: 10px;
          padding: 8px 12px;
          color: rgba(255,255,255,.82);
          font-size: 13px;
          outline: none;
          transition: border-color .12s, background .12s;
        }
        .p-input::placeholder { color: rgba(255,255,255,.18); }
        .p-input:hover { border-color: rgba(255,255,255,.12); }
        .p-input:focus { border-color: rgba(251,191,36,.4); background: rgba(251,191,36,.04); box-shadow: 0 0 0 3px rgba(251,191,36,.06); outline: none; }
        .p-input option { background: #0c0f1a; }
      `}</style>
    </div>
  );
}