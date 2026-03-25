"use client";

export type DiaryEntryType = "homework" | "notice" | "observation";

// ── Base ──────────────────────────────────────────────────────────────────────
export interface DiaryBase {
  id: string;
  grade: string;
  entry_type: DiaryEntryType;
  title: string;
  content: string | null;
  body: string | null;
  created_at: string;
  diary_date: string;
  subject_name?: string | null;
  author_name?: string | null;
  due_date?: string | null;
}

// ── Class-wide (Homework/Notice) ─────────────────────────────────────────────
export interface ClassDiaryEntry extends DiaryBase {
  entry_type: "homework" | "notice";
  student_id: null;
  is_completed: boolean;
  homework?: string | null;
}

// ── Individual Observation ────────────────────────────────────────────────────
export interface ObservationEntry extends DiaryBase {
  entry_type: "observation";
  student_id: string;
  student_name: string;
  is_completed: false;
  homework?: never; // Explicitly tell TS this never exists here
}

export type TeacherDiaryEntry = ClassDiaryEntry | ObservationEntry;

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
