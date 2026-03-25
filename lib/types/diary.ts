// lib/types/diary.ts
// Single source of truth for all diary-related types and type guards.
// Both the teacher and parent data fetchers import from here.

// ── Entry types ───────────────────────────────────────────────────────────────

export type DiaryEntryType = "homework" | "notice" | "observation";

/**
 * Class-wide entry — homework or notice.
 * student_id is NULL in the DB.
 * Visible to ALL parents in the grade.
 */
export interface ClassDiaryEntry {
  id: string;
  entry_type: "homework" | "notice";
  grade: string;
  title: string;
  content: string | null;
  due_date: string | null;
  is_completed: boolean;
  created_at: string;
}

/**
 * Student-scoped CBC observation / competency note.
 * student_id is set in the DB.
 * Visible ONLY to that student's parent.
 */
export interface ObservationEntry {
  id: string;
  entry_type: "observation";
  grade: string;
  student_id: string;
  student_name: string;
  title: string;
  content: string | null;
  is_completed: boolean;
  created_at: string;
}

/** Discriminated union — used everywhere (teacher UI, parent portal, actions) */
export type TeacherDiaryEntry = ClassDiaryEntry | ObservationEntry;

// ── Type guards ───────────────────────────────────────────────────────────────

export function isObservation(e: TeacherDiaryEntry): e is ObservationEntry {
  return e.entry_type === "observation";
}

export function isClassWide(e: TeacherDiaryEntry): e is ClassDiaryEntry {
  return e.entry_type === "homework" || e.entry_type === "notice";
}

export function isHomework(
  e: TeacherDiaryEntry,
): e is ClassDiaryEntry & { entry_type: "homework" } {
  return e.entry_type === "homework";
}

export function isNotice(
  e: TeacherDiaryEntry,
): e is ClassDiaryEntry & { entry_type: "notice" } {
  return e.entry_type === "notice";
}
