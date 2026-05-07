"use client";

/**
 * StudentRow
 *
 * Renders a single student card (inline fields + collapsible parent panel).
 * Receives all data and callbacks from the parent editor — no local state
 * except the file-input ref.
 */

import type { BulkAdmitRow } from "@/lib/actions/bulk-admit";
import type { ParentSearchResult } from "@/lib/actions/admit";
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Copy,
  Trash2,
  Users,
} from "lucide-react";
import { ParentPanel } from "./ParentPanel";
import { StudentPhotoCell } from "./StudentPhotoCell";
import { RowMeta, ClassOption, isRowComplete, gradeHasRealStreams } from "./types";


interface StudentRowProps {
  index: number;
  row: BulkAdmitRow;
  meta: RowMeta;
  availableGrades: string[];
  classes: ClassOption[];
  streamsFor: (grade: string) => string[];
  onRowChange: <K extends keyof BulkAdmitRow>(field: K, value: BulkAdmitRow[K]) => void;
  onMetaChange: (patch: Partial<RowMeta>) => void;
  onSelectParent: (p: ParentSearchResult | null) => void;
  onDuplicate: () => void;
  onRemove: () => void;
  canRemove: boolean;
}

export function StudentRow({
  index,
  row,
  meta,
  availableGrades,
  classes,
  streamsFor,
  onRowChange,
  onMetaChange,
  onSelectParent,
  onDuplicate,
  onRemove,
  canRemove,
}: StudentRowProps) {
  const complete = isRowComplete(row, meta);
  const hasName = row.studentName.trim().length > 0;
  const needsParent = hasName && !!row.dateOfBirth && !complete;
  const streams = streamsFor(row.currentGrade);
  const showStream = gradeHasRealStreams(row.currentGrade, classes);
  const { parentExpanded } = meta;

  // Parent button label
  const parentLabel = meta.selectedParent
    ? meta.selectedParent.full_name.split(" ")[0]
    : row.parentEmail?.split("@")[0] || "Parent";

  return (
    <li
      aria-label={`Student row ${index + 1}${row.studentName ? `: ${row.studentName}` : ""}`}
      className={`rounded-2xl border overflow-hidden transition-all duration-200 ${
        complete
          ? "border-emerald-500/20 bg-gradient-to-r from-emerald-500/[0.03] to-transparent"
          : hasName
          ? "border-amber-400/12 bg-white/[0.02]"
          : "border-white/[0.05] bg-white/[0.01]"
      }`}
    >
      {/* ── Inline fields ── */}
      <div className="px-4 py-3 flex items-center gap-2 flex-wrap lg:flex-nowrap">

        {/* Photo thumbnail */}
        <StudentPhotoCell
          rowIndex={index}
          preview={meta.photoPreview}
          onChange={(file, preview) => onMetaChange({ photoFile: file, photoPreview: preview })}
          onRemove={() => onMetaChange({ photoFile: null, photoPreview: null })}
        />

        {/* Index / complete badge */}
        <div
          className={`h-7 w-7 rounded-lg flex items-center justify-center text-xs font-mono font-bold shrink-0 transition-all ${
            complete ? "bg-emerald-500/15 text-emerald-400" : "bg-white/[0.04] text-white/20"
          }`}
          aria-label={complete ? `Row ${index + 1} complete` : `Row ${index + 1}`}
        >
          {complete ? (
            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
          ) : (
            index + 1
          )}
        </div>

        {/* Student name */}
        <input
          type="text"
          placeholder="Student full name…"
          value={row.studentName}
          onChange={(e) => onRowChange("studentName", e.target.value)}
          className="g-input flex-1 min-w-[180px] font-medium"
          autoComplete="off"
          aria-label={`Student ${index + 1} full name`}
        />

        {/* Date of birth */}
        <input
          type="date"
          aria-label={`Student ${index + 1} date of birth`}
          value={row.dateOfBirth}
          onChange={(e) => onRowChange("dateOfBirth", e.target.value)}
          className="g-input w-36 shrink-0 text-xs"
        />

        {/* Gender */}
        <div className="relative w-[88px] shrink-0">
          <select
            aria-label={`Student ${index + 1} gender`}
            value={row.gender}
            onChange={(e) => onRowChange("gender", e.target.value as "Male" | "Female")}
            className="g-input w-full appearance-none pr-5 text-xs"
          >
            <option value="Male">Male</option>
            <option value="Female">Female</option>
          </select>
          <ChevronDown
            className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 text-white/20"
            aria-hidden="true"
          />
        </div>

        {/* Grade */}
        <div className="relative w-28 shrink-0">
          <select
            aria-label={`Student ${index + 1} grade`}
            value={row.currentGrade}
            onChange={(e) => onRowChange("currentGrade", e.target.value)}
            className="g-input w-full appearance-none pr-5 text-xs text-amber-300/80"
          >
            {availableGrades.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
          <ChevronDown
            className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 text-amber-400/25"
            aria-hidden="true"
          />
        </div>

        {/* Stream — hidden when the grade only has the default "Main" stream */}
        {showStream && (
          <div className="relative w-24 shrink-0">
            <select
              aria-label={`Student ${index + 1} stream`}
              value={row.stream}
              onChange={(e) => onRowChange("stream", e.target.value)}
              className="g-input w-full appearance-none pr-5 text-xs text-amber-200/50"
            >
              {streams.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <ChevronDown
              className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 text-amber-400/15"
              aria-hidden="true"
            />
          </div>
        )}

        {/* Parent toggle */}
        <button
          type="button"
          onClick={() => onMetaChange({ parentExpanded: !parentExpanded })}
          onKeyDown={(e) => e.key === "Escape" && onMetaChange({ parentExpanded: false })}
          aria-expanded={parentExpanded ? "true" : "false"}
          aria-controls={`parent-panel-${index}`}
          aria-label={`${parentExpanded ? "Collapse" : "Expand"} parent info for student ${index + 1}`}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shrink-0 border ${
            parentExpanded
              ? "bg-amber-400/12 text-amber-300 border-amber-400/25"
              : complete
              ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/20"
              : needsParent
              ? "bg-amber-400/8 text-amber-400/70 border-amber-400/20 animate-pulse"
              : "bg-white/[0.03] text-white/35 border-white/[0.07] hover:text-white/60 hover:border-white/15"
          }`}
        >
          <Users className="h-3.5 w-3.5" aria-hidden="true" />
          <span>{parentLabel}</span>
          {parentExpanded ? (
            <ChevronUp className="h-3 w-3" aria-hidden="true" />
          ) : (
            <ChevronDown className="h-3 w-3" aria-hidden="true" />
          )}
        </button>

        {/* Row actions */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={onDuplicate}
            aria-label={`Duplicate row ${index + 1}`}
            className="p-1.5 rounded-lg text-white/15 hover:text-amber-400 hover:bg-amber-400/10 transition-all"
          >
            <Copy className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={onRemove}
            disabled={!canRemove}
            aria-label={`Remove row ${index + 1}`}
            className="p-1.5 rounded-lg text-white/15 hover:text-rose-400 hover:bg-rose-400/10 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Nudge when parent info is missing */}
      {!parentExpanded && hasName && !complete && (
        <div className="px-4 pb-3 flex items-center gap-2 ml-[4.75rem]" role="alert" aria-live="polite">
          <AlertCircle className="h-3 w-3 text-amber-400/40 shrink-0" aria-hidden="true" />
          <button
            type="button"
            onClick={() => onMetaChange({ parentExpanded: true })}
            className="text-[11px] text-amber-400/50 hover:text-amber-400 transition-colors"
          >
            Parent / guardian info required — click to add
          </button>
        </div>
      )}

      {/* Parent panel */}
      {parentExpanded && (
        <ParentPanel
          rowIndex={index}
          row={row}
          selectedParent={meta.selectedParent}
          onRowChange={onRowChange}
          onSelectParent={onSelectParent}
        />
      )}
    </li>
  );
}