/**
 * bulk-admit/types.ts
 *
 * Shared types, constants, and pure factory functions.
 * No React imports — safe to import from anywhere.
 */

import type { BulkAdmitRow } from "@/lib/actions/bulk-admit";
import type { ParentSearchResult } from "@/lib/actions/admit";

export const CURRENT_YEAR = 2026;

export const RELATIONSHIP_OPTIONS = [
  { value: "mother", label: "Mother" },
  { value: "father", label: "Father" },
  { value: "guardian", label: "Guardian" },
  { value: "other", label: "Other" },
] as const;

// ── Row meta: UI-only state that doesn't belong in BulkAdmitRow ──────────
export interface RowMeta {
  parentExpanded: boolean;
  selectedParent: ParentSearchResult | null;
  /** Base64 data-URL preview shown in the UI before upload */
  photoPreview: string | null;
  /** The actual File object to be uploaded on submit */
  photoFile: File | null;
}

export type ClassOption = { id: string; grade: string; stream: string };

// ── Factories ─────────────────────────────────────────────────────────────
export function blankRow(grade: string, stream: string): BulkAdmitRow {
  return {
    studentName: "",
    dateOfBirth: "",
    gender: "Male",
    currentGrade: grade,
    stream,
    academicYear: CURRENT_YEAR,
    relationshipType: "guardian",
    parentMode: "new",
    existingParentId: null,
    parentName: "",
    parentEmail: "",
    parentPhone: "",
  };
}

export function blankMeta(): RowMeta {
  return {
    parentExpanded: false,
    selectedParent: null,
    photoPreview: null,
    photoFile: null,
  };
}

// ── Completion check ──────────────────────────────────────────────────────
export function isRowComplete(row: BulkAdmitRow, meta: RowMeta): boolean {
  if (!row.studentName.trim() || !row.dateOfBirth) return false;
  if (row.parentMode === "existing") return !!meta.selectedParent;
  return !!(row.parentName?.trim() && row.parentEmail?.trim() && row.parentPhone?.trim());
}

/**
 * Returns true when a class only has the synthetic "Main" stream, meaning
 * the school hasn't set up streams for that grade — the UI should hide the
 * stream selector entirely to avoid confusion.
 */
export function gradeHasRealStreams(
  grade: string,
  classes: ClassOption[]
): boolean {
  const streams = classes.filter((c) => c.grade === grade).map((c) => c.stream);
  // "Real" streams: more than one, or the single stream is not "Main"
  return streams.length > 1 || (streams.length === 1 && streams[0] !== "Main");
}