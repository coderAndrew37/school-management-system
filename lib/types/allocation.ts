// lib/types/allocation.ts

export type SubjectLevel =
  | "lower_primary"
  | "upper_primary"
  | "junior_secondary";

export interface Class {
  id: string;
  grade: string;
  stream: string;
  level: SubjectLevel;
}

export interface Subject {
  id: string;
  name: string;
  code: string;
  level: SubjectLevel;
  weekly_lessons: number;
  created_at: string;
}

export interface TeacherSubjectAllocation {
  id: string;
  teacher_id: string;
  subject_id: string;
  class_id: string; // Changed from grade: string
  academic_year: number;
  created_at: string;
  // joined
  teachers: {
    id: string;
    full_name: string;
    email: string;
    tsc_number: string | null;
  } | null;
  subjects: {
    id: string;
    name: string;
    code: string;
    level: SubjectLevel;
    weekly_lessons: number;
  } | null;
  classes: Class | null; // Added joined class data
}

export interface TimetableSlot {
  id: string;
  allocation_id: string;
  grade: string; // This remains a string label (e.g. "Grade 4-North") for the UI grid
  day_of_week: number; // 1–5
  period: number; // 1–8
  academic_year: number;
  created_at: string;
  // joined
  teacher_subject_allocations: {
    class_id: string;
    teachers: { id: string; full_name: string } | null;
    subjects: { name: string; code: string } | null;
  } | null;
}

// ── UI timetable cell ─────────────────────────────────────────────────────────

export interface TimetableCell {
  slotId: string;
  teacherName: string;
  subjectName: string;
  subjectCode: string;
  allocationId: string;
  teacherId: string;
}

// Keyed by `${day}-${period}`
export type TimetableGrid = Record<string, TimetableCell | null>;

export interface AllocationFormValues {
  teacherId: string;
  subjectId: string;
  classId: string; // Changed from grade
  academicYear: number;
}

// These are now used as "Levels" rather than the final list of grades,
// since specific grades (e.g. Grade 4 Alpha) come from the DB.
export const CBC_LEVEL_LABELS: Record<SubjectLevel, string> = {
  lower_primary: "Lower Primary (PP1 - Grade 3)",
  upper_primary: "Upper Primary (Grade 4 - Grade 6)",
  junior_secondary: "Junior Secondary (Grade 7 - Grade 9)",
};

export const DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
] as const;
export type Day = (typeof DAYS)[number];

export const PERIODS = [1, 2, 3, 4, 5, 6, 7, 8] as const;
export type Period = (typeof PERIODS)[number];

export const PERIOD_TIMES: Record<number, string> = {
  1: "7:30–8:20",
  2: "8:20–9:10",
  3: "9:10–10:00",
  4: "10:20–11:10",
  5: "11:10–12:00",
  6: "12:00–12:50",
  7: "1:30–2:20",
  8: "2:20–3:10",
};
