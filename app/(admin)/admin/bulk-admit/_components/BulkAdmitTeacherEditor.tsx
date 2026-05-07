"use client";

import { useRef, KeyboardEvent } from "react";
import { Plus, Trash2, UserCheck, Save, ClipboardList, Copy } from "lucide-react";
import type { BulkTeacherRow } from "@/lib/actions/bulk-teacher";

interface Props {
  rows: BulkTeacherRow[];
  setRows: React.Dispatch<React.SetStateAction<BulkTeacherRow[]>>;
  isPending: boolean;
  onSubmit: () => void;
}

const BLANK_TEACHER: BulkTeacherRow = { fullName: "", email: "", phone: "", tscNumber: "" };

export function BulkAdmitTeacherEditor({ rows, setRows, isPending, onSubmit }: Props) {
  const tbodyRef = useRef<HTMLTableSectionElement>(null);

  // ── Mutations ──────────────────────────────────────────────────────────
  const addRow = (after?: Partial<BulkTeacherRow>) => {
    setRows((prev) => [...prev, { ...BLANK_TEACHER, ...after, fullName: "", email: "" }]);
    requestAnimationFrame(() => {
      const cells = tbodyRef.current?.querySelectorAll<HTMLElement>(
        "tr:last-child td input"
      );
      cells?.[0]?.focus();
    });
  };

  const duplicateRow = (index: number) => {
    setRows((prev) => {
      const copy = { ...prev[index], fullName: "", email: "" };
      const next = [...prev];
      next.splice(index + 1, 0, copy);
      return next;
    });
  };

  const removeRow = (index: number) => {
    setRows((prev) => (prev.length === 1 ? prev : prev.filter((_, i) => i !== index)));
  };

  const updateRow = (index: number, field: keyof BulkTeacherRow, value: string) => {
    setRows((prev) =>
      prev.map((row, i) => (i === index ? { ...row, [field]: value } : row))
    );
  };

  // ── Keyboard nav ───────────────────────────────────────────────────────
  const handleKeyDown = (
    e: KeyboardEvent<HTMLInputElement>,
    rowIdx: number,
    colIdx: number
  ) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (rowIdx === rows.length - 1) {
        addRow();
      } else {
        const allRows = tbodyRef.current?.querySelectorAll("tr");
        const nextRow = allRows?.[rowIdx + 1];
        const inputs = nextRow?.querySelectorAll<HTMLElement>("input");
        inputs?.[colIdx]?.focus();
      }
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      const allRows = tbodyRef.current?.querySelectorAll("tr");
      const nextRow = allRows?.[rowIdx + 1];
      nextRow?.querySelectorAll<HTMLElement>("input")?.[colIdx]?.focus();
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      if (rowIdx > 0) {
        const allRows = tbodyRef.current?.querySelectorAll("tr");
        const prevRow = allRows?.[rowIdx - 1];
        prevRow?.querySelectorAll<HTMLElement>("input")?.[colIdx]?.focus();
      }
    }
  };

  const filledCount = rows.filter((r) => r.fullName.trim() && r.email.trim()).length;

  return (
    <div className="relative space-y-4">
      <div className="pointer-events-none absolute -top-24 -right-24 w-96 h-96 rounded-full bg-emerald-500/[0.03] blur-[100px] -z-10" />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-400/10 border border-emerald-400/20">
            <UserCheck className="h-5 w-5 text-emerald-400" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              Staff Batch Entry
              <span className="text-emerald-400 font-mono text-sm">
                ({filledCount}/{rows.length})
              </span>
            </h2>
            <p className="text-xs text-white/35 mt-0.5">
              Press <kbd className="px-1.5 py-0.5 rounded bg-white/10 text-white/50 font-mono text-[10px]">Enter</kbd> to add rows ·{" "}
              <kbd className="px-1.5 py-0.5 rounded bg-white/10 text-white/50 font-mono text-[10px]">↑↓</kbd> to navigate
            </p>
          </div>
        </div>

        <button
          onClick={() => addRow()}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/[0.03] border border-white/10 text-white/70 hover:text-emerald-400 hover:border-emerald-400/30 transition-all text-xs font-bold uppercase tracking-wider"
        >
          <Plus className="h-4 w-4" /> Add Teacher
        </button>
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] backdrop-blur-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-white/[0.07] bg-white/[0.03]">
                <th className="w-10 px-3 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-white/25">#</th>
                <th className="px-3 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-white/30 min-w-[200px]">
                  Full Name <span className="text-rose-400">*</span>
                </th>
                <th className="px-3 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-white/30 min-w-[200px]">
                  Email Address <span className="text-rose-400">*</span>
                </th>
                <th className="px-3 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-white/30 w-40">
                  Phone Number
                </th>
                <th className="px-3 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-emerald-400/60 w-36">
                  TSC Number
                </th>
                <th className="w-16 px-3 py-3" />
              </tr>
            </thead>

            <tbody ref={tbodyRef} className="divide-y divide-white/[0.03]">
              {rows.map((row, i) => {
                const isFilled = row.fullName.trim() && row.email.trim();
                return (
                  <tr
                    key={i}
                    className={`group transition-colors ${
                      isFilled ? "hover:bg-emerald-400/[0.02]" : "hover:bg-white/[0.015]"
                    }`}
                  >
                    <td className="px-3 py-2 text-white/20 font-mono text-xs text-center select-none">
                      {i + 1}
                    </td>

                    {/* Full Name */}
                    <td className="px-1.5 py-1.5">
                      <input
                        type="text"
                        placeholder="Full name…"
                        value={row.fullName}
                        onChange={(e) => updateRow(i, "fullName", e.target.value)}
                        onKeyDown={(e) => handleKeyDown(e, i, 0)}
                        className="teacher-cell w-full"
                        autoComplete="off"
                      />
                    </td>

                    {/* Email */}
                    <td className="px-1.5 py-1.5">
                      <input
                        type="email"
                        placeholder="email@school.ac.ke"
                        value={row.email}
                        onChange={(e) => updateRow(i, "email", e.target.value)}
                        onKeyDown={(e) => handleKeyDown(e, i, 1)}
                        className="teacher-cell w-full"
                        autoComplete="off"
                      />
                    </td>

                    {/* Phone */}
                    <td className="px-1.5 py-1.5">
                      <input
                        type="tel"
                        placeholder="+254…"
                        value={row.phone}
                        onChange={(e) => updateRow(i, "phone", e.target.value)}
                        onKeyDown={(e) => handleKeyDown(e, i, 2)}
                        className="teacher-cell w-full"
                        autoComplete="off"
                      />
                    </td>

                    {/* TSC */}
                    <td className="px-1.5 py-1.5">
                      <div className="relative group/tsc">
                        <ClipboardList className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/20 group-focus-within/tsc:text-emerald-400/50 transition-colors" />
                        <input
                          type="text"
                          placeholder="TSC/XXXXX"
                          value={row.tscNumber ?? ""}
                          onChange={(e) => updateRow(i, "tscNumber", e.target.value)}
                          onKeyDown={(e) => handleKeyDown(e, i, 3)}
                          className="teacher-cell w-full pl-8 text-emerald-300/70"
                          autoComplete="off"
                        />
                      </div>
                    </td>

                    {/* Actions */}
                    <td className="px-2 py-1.5">
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          aria-label="Duplicate row"
                          onClick={() => duplicateRow(i)}
                          title="Duplicate row"
                          className="p-1.5 rounded-md text-white/20 hover:text-emerald-400 hover:bg-emerald-400/10 transition-all"
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
          className="w-full py-2.5 flex items-center justify-center gap-2 text-white/20 hover:text-emerald-400/70 hover:bg-emerald-400/[0.03] transition-all border-t border-white/[0.05] text-xs font-medium tracking-wide"
        >
          <Plus className="h-3.5 w-3.5" />
          Add another teacher
        </button>

        {/* Footer */}
        <div className="px-6 py-4 bg-white/[0.03] border-t border-white/[0.07] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <p className="text-[10px] text-white/30 uppercase tracking-widest font-bold">
              {filledCount} of {rows.length} rows ready
            </p>
            {filledCount < rows.length && (
              <p className="text-[10px] text-emerald-400/40">
                {rows.length - filledCount} incomplete row{rows.length - filledCount > 1 ? "s" : ""} will be skipped
              </p>
            )}
          </div>

          <button
            onClick={onSubmit}
            disabled={isPending || filledCount === 0}
            className="group flex items-center gap-2 bg-emerald-400 disabled:bg-white/10 text-[#0c0f1a] font-bold px-8 py-3 rounded-xl hover:bg-emerald-300 active:scale-95 transition-all shadow-lg shadow-emerald-400/10 disabled:text-white/20 disabled:shadow-none"
          >
            <Save className="h-4 w-4" />
            {isPending ? "Processing…" : `Register ${filledCount || rows.length} Staff`}
          </button>
        </div>
      </div>

      <style>{`
        .teacher-cell {
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
        .teacher-cell::placeholder { color: rgba(255,255,255,0.18); }
        .teacher-cell:hover { border-color: rgba(255,255,255,0.12); background: rgba(255,255,255,0.03); }
        .teacher-cell:focus { border-color: rgba(52,211,153,0.5); background: rgba(52,211,153,0.05); box-shadow: 0 0 0 2px rgba(52,211,153,0.08); }
        .teacher-cell option { background: #0c0f1a; color: rgba(255,255,255,0.85); }
      `}</style>
    </div>
  );
}