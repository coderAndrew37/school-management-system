"use client";
// app/teacher/conduct/components/ConductForm.tsx

import type { RefObject } from "react";
import { Minus, Plus } from "lucide-react";
import type { ClassStudent } from "@/lib/data/assessment";
import {
  CONDUCT_CATEGORIES,
  CONDUCT_TYPES,
  SEVERITIES,
  type ActionState,
  type ConductCategory,
  type ConductType,
  type Severity,
} from "@/lib/schemas/conduct";
import type { ConductRecord } from "@/lib/actions/conduct";
import { TYPE_CFG, SEVERITY_CFG, QUICK_DESCRIPTIONS } from "../conduct.config";

// ── Types ────────────────────────────────────────────────────────────────────

export interface ClassInfo {
  id: string; // maps to uuid
  grade: string; // e.g., "Grade 1"
  stream: string; // e.g., "Main"
}

// ── Sub-components ────────────────────────────────────────────────────────────

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
      {children}
    </p>
  );
}

function FieldError({ errors }: { errors?: string[] }) {
  if (!errors?.length) return null;
  return (
    <p className="mt-1 text-[10px] font-semibold text-rose-500">{errors[0]}</p>
  );
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  formRef: RefObject<HTMLFormElement | null>;
  formAction: (payload: FormData) => void;
  isSubmitting: boolean;
  state: ActionState;
  // Controlled UI state
  selectedType: ConductType;
  onTypeChange: (t: ConductType) => void;
  selectedClass: ClassInfo | null;
  onClassChange: (c: ClassInfo) => void;
  selectedCategory: ConductCategory;
  onCategoryChange: (c: ConductCategory) => void;
  selectedSeverity: Severity;
  onSeverityChange: (s: Severity) => void;
  points: number;
  onPointsChange: (p: number) => void;
  // Data
  classes: ClassInfo[];
  students: ClassStudent[];
  records: ConductRecord[];
  // Session constants
  academicYear: number;
  term: number;
  onCancel: () => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ConductForm({
  formRef,
  formAction,
  isSubmitting,
  state,
  selectedType,
  onTypeChange,
  selectedClass,
  onClassChange,
  selectedCategory,
  onCategoryChange,
  selectedSeverity,
  onSeverityChange,
  points,
  onPointsChange,
  classes,
  students,
  records,
  academicYear,
  term,
  onCancel,
}: Props) {
  const fieldErrors = state.status === "error" ? state.fieldErrors || {} : {};
  const cfg = TYPE_CFG[selectedType];

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
        <p className="text-sm font-black text-slate-700">New Record</p>
        <button
          type="button"
          onClick={onCancel}
          className="text-xs text-slate-400 hover:text-slate-600 transition-colors"
        >
          Cancel
        </button>
      </div>

      <form ref={formRef} action={formAction} className="px-5 py-4 space-y-4">
        {/* ── Hidden: button-controlled values ──────────────────────── */}
        <input type="hidden" name="type" value={selectedType} />
        <input type="hidden" name="category" value={selectedCategory} />
        <input type="hidden" name="severity" value={selectedSeverity} />
        <input type="hidden" name="points" value={String(points)} />

        {/* ── Hidden: Database identifiers ──────────────────────────── */}
        <input type="hidden" name="class_id" value={selectedClass?.id ?? ""} />
        <input type="hidden" name="grade" value={selectedClass?.grade ?? ""} />
        <input
          type="hidden"
          name="stream"
          value={selectedClass?.stream ?? ""}
        />

        {/* ── Hidden: session constants ─────────────────────────────── */}
        <input
          type="hidden"
          name="academic_year"
          value={String(academicYear)}
        />
        <input type="hidden" name="term" value={String(term)} />

        {/* ── Type selector ─────────────────────────────────────────── */}
        <div>
          <div className="grid grid-cols-3 gap-1.5">
            {CONDUCT_TYPES.map((t) => {
              const c = TYPE_CFG[t];
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => onTypeChange(t)}
                  className={`flex flex-col items-center gap-1 py-2.5 rounded-xl border text-xs font-bold transition-all ${
                    selectedType === t
                      ? `${c.bg} ${c.text} ${c.border}`
                      : "bg-slate-50 text-slate-500 border-slate-200 hover:border-slate-300"
                  }`}
                >
                  {t === "merit" ? "🏅" : t === "demerit" ? "—" : "⚠"}
                  {c.label}
                </button>
              );
            })}
          </div>
          <FieldError errors={fieldErrors.type} />
        </div>

        {/* ── Class selector ─────────────────────────────────────────── */}
        {classes.length > 1 && (
          <div>
            <FieldLabel>Class</FieldLabel>
            <div className="flex flex-wrap gap-1.5">
              {classes.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => onClassChange(c)}
                  className={`px-3 py-1.5 rounded-lg border text-xs font-bold transition-all ${
                    selectedClass?.id === c.id
                      ? "bg-emerald-600 text-white border-emerald-600"
                      : "bg-white text-slate-600 border-slate-200 hover:border-emerald-300"
                  }`}
                >
                  {c.grade} {c.stream}
                </button>
              ))}
            </div>
            <FieldError errors={fieldErrors.grade} />
          </div>
        )}

        {/* ── Student select ─────────────────────────────────────────── */}
        <div>
          <FieldLabel>Student</FieldLabel>
          <select
            name="student_id"
            aria-label="select student"
            defaultValue=""
            className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-violet-400"
          >
            <option value="" disabled>
              — Select student —
            </option>
            {students.map((s) => (
              <option key={s.id} value={s.id}>
                {s.full_name}
                {records.some((r) => r.student_id === s.id) ? " ●" : ""}
              </option>
            ))}
          </select>
          <FieldError errors={fieldErrors.student_id} />
        </div>

        {/* ── Category ──────────────────────────────────────────────── */}
        <div>
          <FieldLabel>Category</FieldLabel>
          <div className="flex flex-wrap gap-1.5">
            {CONDUCT_CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => onCategoryChange(cat)}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold border capitalize transition-all ${
                  selectedCategory === cat
                    ? "bg-slate-800 text-white border-slate-800"
                    : "bg-white text-slate-500 border-slate-200 hover:border-slate-300"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
          <FieldError errors={fieldErrors.category} />
        </div>

        {/* ── Points (merits / demerits only) ───────────────────────── */}
        {selectedType !== "incident" && (
          <div>
            <FieldLabel>Points</FieldLabel>
            <div className="flex items-center gap-2">
              <button
                type="button"
                aria-label="decrease points"
                onClick={() => onPointsChange(Math.max(1, points - 1))}
                className="h-8 w-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-50"
              >
                <Minus className="h-3.5 w-3.5" />
              </button>
              <span className="text-lg font-black text-slate-800 w-8 text-center">
                {points}
              </span>
              <button
                type="button"
                aria-label="increase points"
                onClick={() => onPointsChange(Math.min(10, points + 1))}
                className="h-8 w-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-50"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
            <FieldError errors={fieldErrors.points} />
          </div>
        )}

        {/* ── Severity (incidents only) ──────────────────────────────── */}
        {selectedType === "incident" && (
          <div>
            <FieldLabel>Severity</FieldLabel>
            <div className="flex gap-2">
              {SEVERITIES.map((s) => (
                <button
                  key={s}
                  type="button"
                  aria-label={`severity-${s}`}
                  onClick={() => onSeverityChange(s)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold border capitalize transition-all ${
                    selectedSeverity === s
                      ? `${SEVERITY_CFG[s].cls} border-current`
                      : "bg-white text-slate-500 border-slate-200"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
            <FieldError errors={fieldErrors.severity} />
          </div>
        )}

        {/* ── Description ───────────────────────────────────────────── */}
        <div>
          <FieldLabel>Description</FieldLabel>
          <textarea
            name="description"
            rows={3}
            placeholder="What happened / what did the student do?"
            className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-violet-400 resize-none placeholder-slate-300"
          />
          <div className="flex flex-wrap gap-1 mt-1.5">
            {QUICK_DESCRIPTIONS[selectedType].map((d) => (
              <button
                key={d}
                type="button"
                onClick={(e) => {
                  const area = e.currentTarget
                    .closest("form")
                    ?.querySelector<HTMLTextAreaElement>(
                      "textarea[name=description]",
                    );
                  if (area) area.value = d;
                }}
                className="px-2 py-0.5 text-[10px] rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors"
              >
                {d}
              </button>
            ))}
          </div>
          <FieldError errors={fieldErrors.description} />
        </div>

        {/* ── Action taken (optional) ────────────────────────────────── */}
        <div>
          <FieldLabel>
            Action taken{" "}
            <span className="font-normal normal-case">(optional)</span>
          </FieldLabel>
          <input
            type="text"
            name="action_taken"
            placeholder="e.g. Letter sent home, counselling, detention…"
            className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-violet-400 placeholder-slate-300"
          />
        </div>

        {/* ── Submit ────────────────────────────────────────────────── */}
        <div className="pt-1 border-t border-slate-100">
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-2.5 rounded-xl bg-violet-600 text-white text-sm font-black hover:bg-violet-700 disabled:opacity-50 transition-colors"
          >
            {isSubmitting ? "Saving…" : `Save ${cfg.label} Record`}
          </button>
          {state.status === "error" &&
            Object.keys(fieldErrors).length === 0 && (
              <p className="mt-2 text-xs text-rose-500 text-center">
                {state.message}
              </p>
            )}
        </div>
      </form>
    </div>
  );
}
