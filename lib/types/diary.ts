// lib/types/diary.ts
// Pure type definitions — no "use client" needed (types are erased at runtime).

export type DiaryEntryType = "homework" | "notice" | "observation";

// ── Base shared by all entries ────────────────────────────────────────────────

export interface DiaryBase {
  id: string;
  grade: string;
  entry_type: DiaryEntryType;
  title: string;
  content: string | null;
  created_at: string;
  // Derived on the client from created_at — not a DB column
  diary_date: string;
  subject_name?: string | null;
  author_name?: string | null;
}

// ── Class-wide entries: homework and notice ────────────────────────────────────

export interface ClassDiaryEntry extends DiaryBase {
  entry_type: "homework" | "notice";
  student_id: null;
  due_date: string | null;
  is_completed: boolean;
}

// ── Individual observation ────────────────────────────────────────────────────

export interface ObservationEntry extends DiaryBase {
  entry_type: "observation";
  student_id: string;
  student_name: string;
  due_date: null;
  is_completed: false;
}

// ── Union ─────────────────────────────────────────────────────────────────────

export type TeacherDiaryEntry = ClassDiaryEntry | ObservationEntry;

// ── ActionState for useActionState ────────────────────────────────────────────

export interface DiaryActionState {
  success: boolean;
  message: string;
  // Field-level errors keyed by form field name
  errors?: Partial<
    Record<"grade" | "title" | "content" | "student_id" | "due_date", string>
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
