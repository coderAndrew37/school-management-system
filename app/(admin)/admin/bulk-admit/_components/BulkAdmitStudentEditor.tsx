"use client";

import type { BulkAdmitRow } from "@/lib/actions/bulk-admit";
import { Plus, Save, Trash2, GraduationCap, Copy, ChevronDown } from "lucide-react";
import { useMemo, useRef, useCallback, KeyboardEvent } from "react";

interface Props {
  classes: { id: string; grade: string; stream: string }[];
  rows: BulkAdmitRow[];
  setRows: React.Dispatch<React.SetStateAction<BulkAdmitRow[]>>;
  isPending: boolean;
  onSubmit: () => void;
}

const CURRENT_YEAR = 2026;

// ── Helper: blank row factory ──────────────────────────────────────────────
function blankRow(
  grade: string,
  stream: string,
  carryover?: Partial<BulkAdmitRow>
): BulkAdmitRow {
  return {
    studentName: "",
    dateOfBirth: "",
    gender: "Male",
    currentGrade: grade,
    stream,
    parentName: carryover?.parentName ?? "",
    parentEmail: carryover?.parentEmail ?? "",
    parentPhone: carryover?.parentPhone ?? "",
    academicYear: CURRENT_YEAR,
  };
}

export function BulkAdmitStudentEditor({
  classes,
  rows,
  setRows,
  isPending,
  onSubmit,
}: Props) {
  const tbodyRef = useRef<HTMLTableSectionElement>(null);

  // ── Derived data ───────────────────────────────────────────────────────
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

  // ── Row mutations ──────────────────────────────────────────────────────
  const addRow = (carryover?: Partial<BulkAdmitRow>) => {
    const grade = carryover?.currentGrade ?? firstGrade;
    const stream = streamsFor(grade)[0] ?? "Main";
    setRows((prev) => [...prev, blankRow(grade, stream, carryover)]);
    // Focus first cell of new row after paint
    requestAnimationFrame(() => {
      const cells = tbodyRef.current?.querySelectorAll<HTMLElement>(
        "tr:last-child td input, tr:last-child td select"
      );
      cells?.[0]?.focus();
    });
  };

  const duplicateRow = (index: number) => {
    setRows((prev) => {
      const copy = { ...prev[index], studentName: "", dateOfBirth: "" };
      const next = [...prev];
      next.splice(index + 1, 0, copy);
      return next;
    });
  };

  const removeRow = (index: number) => {
    setRows((prev) => (prev.length === 1 ? prev : prev.filter((_, i) => i !== index)));
  };

  const updateRow = <K extends keyof BulkAdmitRow>(
    index: number,
    field: K,
    value: BulkAdmitRow[K]
  ) => {
    setRows((prev) =>
      prev.map((row, i) => {
        if (i !== index) return row;
        if (field === "currentGrade") {
          const newStream = streamsFor(value as string)[0] ?? "";
          return { ...row, currentGrade: value as string, stream: newStream };
        }
        return { ...row, [field]: value };
      })
    );
  };

  // ── Excel-style keyboard nav ───────────────────────────────────────────
  const handleKeyDown = (
    e: KeyboardEvent<HTMLInputElement | HTMLSelectElement>,
    rowIdx: number,
    colIdx: number,
    totalCols: number
  ) => {
    if (e.key === "Tab") return; // browser default is fine
    if (e.key === "Enter") {
      e.preventDefault();
      if (rowIdx === rows.length - 1) {
        addRow({ currentGrade: rows[rowIdx].currentGrade, stream: rows[rowIdx].stream });
      } else {
        // Move to same column, next row
        const rows_ = tbodyRef.current?.querySelectorAll("tr");
        const targetRow = rows_?.[rowIdx + 1];
        const inputs = targetRow?.querySelectorAll<HTMLElement>("input, select");
        inputs?.[colIdx]?.focus();
      }
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      const allRows = tbodyRef.current?.querySelectorAll("tr");
      const nextRow = allRows?.[rowIdx + 1];
      const inputs = nextRow?.querySelectorAll<HTMLElement>("input, select");
      inputs?.[colIdx]?.focus();
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      const allRows = tbodyRef.current?.querySelectorAll("tr");
      if (rowIdx > 0) {
        const prevRow = allRows?.[rowIdx - 1];
        const inputs = prevRow?.querySelectorAll<HTMLElement>("input, select");
        inputs?.[colIdx]?.focus();
      }
    }
  };

  // ── Stats ──────────────────────────────────────────────────────────────
  const filledCount = rows.filter((r) => r.studentName.trim()).length;

  return (
    <div className="relative space-y-4">
      {/* Ambient */}
      <div className="pointer-events-none absolute -top-24 -left-24 w-96 h-96 rounded-full bg-amber-500/[0.05] blur-[100px] -z-10" />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            Student Batch Entry
            <span className="text-amber-400 font-mono text-sm">
              ({filledCount}/{rows.length})
            </span>
          </h2>
          <p className="text-xs text-white/40 mt-1">
            Academic Year {CURRENT_YEAR} · Press <kbd className="px-1.5 py-0.5 rounded bg-white/10 text-white/50 font-mono text-[10px]">Enter</kbd> to add rows ·{" "}
            <kbd className="px-1.5 py-0.5 rounded bg-white/10 text-white/50 font-mono text-[10px]">↑↓</kbd> to navigate
          </p>
        </div>
        <button
          onClick={() => addRow()}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/[0.03] border border-white/10 text-white/70 hover:text-amber-400 hover:border-amber-400/30 transition-all text-xs font-bold uppercase tracking-wider"
        >
          <Plus className="h-4 w-4" /> Add Row
        </button>
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] backdrop-blur-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1280px] border-collapse text-sm">

            {/* Column headers */}
            <thead>
              <tr className="border-b border-white/[0.07] bg-white/[0.03]">
                <th className="w-10 px-3 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-white/25">#</th>
                {/* Student */}
                <th className="px-3 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-white/30 min-w-[180px]">
                  Student Name <span className="text-rose-400">*</span>
                </th>
                <th className="px-3 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-white/30 w-36">
                  Date of Birth <span className="text-rose-400">*</span>
                </th>
                <th className="px-3 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-white/30 w-24">Gender</th>
                {/* Class */}
                <th className="px-3 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-amber-400/60 w-28">
                  <span className="flex items-center gap-1"><GraduationCap className="h-3 w-3" /> Grade</span>
                </th>
                <th className="px-3 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-amber-400/60 w-28">Stream</th>
                {/* Parent */}
                <th className="px-3 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-white/30 min-w-[160px]">
                  Parent Name <span className="text-rose-400">*</span>
                </th>
                <th className="px-3 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-white/30 min-w-[180px]">
                  Parent Email <span className="text-rose-400">*</span>
                </th>
                <th className="px-3 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-white/30 w-36">
                  Phone <span className="text-rose-400">*</span>
                </th>
                {/* Actions */}
                <th className="w-16 px-3 py-3" />
              </tr>
            </thead>

            <tbody ref={tbodyRef} className="divide-y divide-white/[0.03]">
              {rows.map((row, i) => {
                const streams = streamsFor(row.currentGrade);
                const isFilled = row.studentName.trim().length > 0;

                return (
                  <tr
                    key={i}
                    className={`group transition-colors ${
                      isFilled ? "hover:bg-amber-400/[0.02]" : "hover:bg-white/[0.015]"
                    }`}
                  >
                    {/* Row number */}
                    <td className="px-3 py-2 text-white/20 font-mono text-xs text-center select-none">
                      {i + 1}
                    </td>

                    {/* Student Name */}
                    <td className="px-1.5 py-1.5">
                      <input
                        type="text"
                        placeholder="Full name…"
                        value={row.studentName}
                        onChange={(e) => updateRow(i, "studentName", e.target.value)}
                        onKeyDown={(e) => handleKeyDown(e, i, 0, 9)}
                        className="excel-cell w-full"
                        autoComplete="off"
                      />
                    </td>

                    {/* DOB */}
                    <td className="px-1.5 py-1.5">
                      <input
                        type="date"
                        aria-label="Date of birth"
                        value={row.dateOfBirth}
                        onChange={(e) => updateRow(i, "dateOfBirth", e.target.value)}
                        onKeyDown={(e) => handleKeyDown(e, i, 1, 9)}
                        className="excel-cell w-full"
                      />
                    </td>

                    {/* Gender */}
                    <td className="px-1.5 py-1.5">
                      <div className="relative">
                        <select
                          aria-label="Gender"
                          value={row.gender}
                          onChange={(e) => updateRow(i, "gender", e.target.value as "Male" | "Female")}
                          onKeyDown={(e) => handleKeyDown(e, i, 2, 9)}
                          className="excel-cell w-full appearance-none pr-6"
                        >
                          <option value="Male">Male</option>
                          <option value="Female">Female</option>
                        </select>
                        <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 text-white/30" />
                      </div>
                    </td>

                    {/* Grade */}
                    <td className="px-1.5 py-1.5">
                      <div className="relative">
                        <select
                          aria-label="Grade"
                          value={row.currentGrade}
                          onChange={(e) => updateRow(i, "currentGrade", e.target.value)}
                          onKeyDown={(e) => handleKeyDown(e, i, 3, 9)}
                          className="excel-cell w-full appearance-none pr-6 text-amber-300/80"
                        >
                          {availableGrades.map((g) => (
                            <option key={g} value={g}>{g}</option>
                          ))}
                        </select>
                        <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 text-amber-400/40" />
                      </div>
                    </td>

                    {/* Stream */}
                    <td className="px-1.5 py-1.5">
                      <div className="relative">
                        <select
                          aria-label="Stream"
                          value={row.stream}
                          onChange={(e) => updateRow(i, "stream", e.target.value)}
                          onKeyDown={(e) => handleKeyDown(e, i, 4, 9)}
                          className="excel-cell w-full appearance-none pr-6 text-amber-300/60"
                        >
                          {streams.map((s) => (
                            <option key={s} value={s}>{s}</option>
                          ))}
                        </select>
                        <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 text-amber-400/40" />
                      </div>
                    </td>

                    {/* Parent Name */}
                    <td className="px-1.5 py-1.5">
                      <input
                        type="text"
                        placeholder="Guardian name…"
                        value={row.parentName}
                        onChange={(e) => updateRow(i, "parentName", e.target.value)}
                        onKeyDown={(e) => handleKeyDown(e, i, 5, 9)}
                        className="excel-cell w-full"
                        autoComplete="off"
                      />
                    </td>

                    {/* Parent Email */}
                    <td className="px-1.5 py-1.5">
                      <input
                        type="email"
                        placeholder="email@example.com"
                        value={row.parentEmail}
                        onChange={(e) => updateRow(i, "parentEmail", e.target.value)}
                        onKeyDown={(e) => handleKeyDown(e, i, 6, 9)}
                        className="excel-cell w-full"
                        autoComplete="off"
                      />
                    </td>

                    {/* Parent Phone */}
                    <td className="px-1.5 py-1.5">
                      <input
                        type="tel"
                        placeholder="+254…"
                        value={row.parentPhone}
                        onChange={(e) => updateRow(i, "parentPhone", e.target.value)}
                        onKeyDown={(e) => handleKeyDown(e, i, 7, 9)}
                        className="excel-cell w-full"
                        autoComplete="off"
                      />
                    </td>

                    {/* Row actions */}
                    <td className="px-2 py-1.5">
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          aria-label="Duplicate row"
                          onClick={() => duplicateRow(i)}
                          title="Duplicate row (keeps parent info)"
                          className="p-1.5 rounded-md text-white/20 hover:text-amber-400 hover:bg-amber-400/10 transition-all"
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </button>
                        <button
                          aria-label="Remove row"
                          onClick={() => removeRow(i)}
                          className="p-1.5 rounded-md text-white/20 hover:text-rose-400 hover:bg-rose-400/10 transition-all"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Add row strip */}
        <button
          onClick={() => addRow()}
          className="w-full py-2.5 flex items-center justify-center gap-2 text-white/20 hover:text-amber-400/70 hover:bg-amber-400/[0.03] transition-all border-t border-white/[0.05] text-xs font-medium tracking-wide"
        >
          <Plus className="h-3.5 w-3.5" />
          Add another student
        </button>

        {/* Footer */}
        <div className="px-6 py-4 bg-white/[0.03] border-t border-white/[0.07] flex items-center justify-between">
          <div className="flex items-center gap-4">
            <p className="text-[10px] text-white/30 uppercase tracking-widest font-medium">
              {filledCount} of {rows.length} rows filled
            </p>
            {filledCount < rows.length && (
              <p className="text-[10px] text-amber-400/40">
                {rows.length - filledCount} empty row{rows.length - filledCount > 1 ? "s" : ""} will be skipped
              </p>
            )}
          </div>

          <button
            onClick={onSubmit}
            disabled={isPending || filledCount === 0}
            className="group flex items-center gap-2 bg-amber-400 disabled:bg-white/10 text-[#0c0f1a] font-bold px-8 py-3 rounded-xl hover:bg-amber-300 active:scale-95 transition-all shadow-lg shadow-amber-400/10 disabled:text-white/20 disabled:shadow-none"
          >
            <Save className="h-4 w-4" />
            {isPending ? "Processing…" : `Admit ${filledCount || rows.length} Student${(filledCount || rows.length) !== 1 ? "s" : ""}`}
          </button>
        </div>
      </div>

      {/* Excel-cell shared styles */}
      <style>{`
        .excel-cell {
          background: transparent;
          border: 1px solid transparent;
          border-radius: 4px;
          padding: 5px 8px;
          color: rgba(255,255,255,0.85);
          font-size: 13px;
          line-height: 1.4;
          transition: border-color 0.1s, background 0.1s;
          outline: none;
        }
        .excel-cell::placeholder { color: rgba(255,255,255,0.18); }
        .excel-cell:hover { border-color: rgba(255,255,255,0.12); background: rgba(255,255,255,0.03); }
        .excel-cell:focus { border-color: rgba(251,191,36,0.5); background: rgba(251,191,36,0.05); box-shadow: 0 0 0 2px rgba(251,191,36,0.08); }
        /* Select options background */
        .excel-cell option { background: #0c0f1a; color: rgba(255,255,255,0.85); }
        /* Date input color fix */
        input[type="date"].excel-cell::-webkit-calendar-picker-indicator { filter: invert(0.4); cursor: pointer; }
      `}</style>
    </div>
  );
}