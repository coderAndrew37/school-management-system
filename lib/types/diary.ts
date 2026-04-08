import type { Class } from "./allocation";

export type DiaryEntryType = "homework" | "notice" | "observation";

// ── Base shared by all entries ────────────────────────────────────────────────

export interface DiaryBase {
  id: string;
  entry_type: DiaryEntryType;
  title: string;
  content: string | null;
  subject_name: string | null;
  created_at: string;
  updated_at: string;
  // Derived on the client from created_at — not a DB column
  diary_date: string;
  
  // Optional Joins for rich UI (Nuke-proof relations)
  classes?: Class | null;
  profiles?: { full_name: string | null } | null;
  students?: { full_name: string; readable_id: string | null } | null;
}

// ── Class-wide entries: homework and notice ────────────────────────────────────

export interface ClassDiaryEntry extends DiaryBase {
  entry_type: "homework" | "notice";
  class_id: string;      // Required for class-wide scope
  student_id: null;      // Must be null per chk_diary_scope
  due_date: string | null;
  is_completed: boolean;
}

// ── Individual observation ────────────────────────────────────────────────────

export interface ObservationEntry extends DiaryBase {
  entry_type: "observation";
  class_id: null;        // Must be null per chk_diary_scope
  student_id: string;    // Required for individual scope
  due_date: null;
  is_completed: false;
}

// ── Union & View Types ────────────────────────────────────────────────────────

export type TeacherDiaryEntry = ClassDiaryEntry | ObservationEntry;

// For Parent Dashboard / Student views
export type StudentDiaryView = TeacherDiaryEntry;

// ── ActionState for useActionState ────────────────────────────────────────────

export interface DiaryActionState {
  success: boolean;
  message: string;
  // Fields updated to match refactored DB columns
  errors?: Partial<
    Record<
      "class_id" | "student_id" | "title" | "content" | "subject_name" | "due_date",
      string
    >
  >;
}

export const DIARY_INITIAL_STATE: DiaryActionState = {
  success: false,
  message: "",
};

// ── Type guards ───────────────────────────────────────────────────────────────

export function isObservation(e: TeacherDiaryEntry): e is ObservationEntry {
  return e.entry_type === "observation";
}

export function isClassWide(e: TeacherDiaryEntry): e is ClassDiaryEntry {
  return e.entry_type === "homework" || e.entry_type === "notice";
}

export function isHomework(e: TeacherDiaryEntry): e is ClassDiaryEntry {
  return e.entry_type === "homework";
}