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

// ── Completion checks ─────────────────────────────────────────────────────

/**
 * A row is "ready to submit" when the student fields are filled.
 * Parent info is optional — a student can be admitted and linked to a parent later.
 */
export function isRowReady(row: BulkAdmitRow): boolean {
  return !!(row.studentName.trim() && row.dateOfBirth && row.gender && row.currentGrade);
}

/**
 * A row is "fully complete" when it is ready AND parent info is resolved.
 * Used for the progress bar and the "complete" green state.
 */
export function isRowComplete(row: BulkAdmitRow, meta: RowMeta): boolean {
  if (!isRowReady(row)) return false;

  if (row.parentMode === "existing") return !!meta.selectedParent;

  if (row.parentMode === "new") {
    // Complete only if all three new-parent fields are filled
    return !!(row.parentName?.trim() && row.parentEmail?.trim() && row.parentPhone?.trim());
  }

  // parentMode === "skip" — student-only is fine, mark green
  return true;
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
  return streams.length > 1 || (streams.length === 1 && streams[0] !== "Main");
}