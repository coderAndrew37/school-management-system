export type SubjectLevel =
  | "lower_primary"
  | "upper_primary"
  | "junior_secondary";

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
  grade: string;
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
}

export interface TimetableSlot {
  id: string;
  allocation_id: string;
  grade: string;
  day_of_week: number; // 1–5
  period: number; // 1–8
  academic_year: number;
  created_at: string;
  // joined
  teacher_subject_allocations: {
    grade: string;
    teachers: { full_name: string } | null;
    subjects: { name: string; code: string } | null;
  } | null;
}

// UI-oriented types
export interface TimetableCell {
  teacherName: string;
  subjectName: string;
  subjectCode: string;
  allocationId: string;
}

// Keyed by `${day}-${period}`
export type TimetableGrid = Record<string, TimetableCell | null>;

export interface AllocationFormValues {
  teacherId: string;
  subjectId: string;
  grade: string;
  academicYear: number;
}

export const CBC_GRADES: Record<SubjectLevel, string[]> = {
  lower_primary: ["PP1", "PP2", "Grade 1", "Grade 2", "Grade 3"],
  upper_primary: ["Grade 4", "Grade 5", "Grade 6"],
  junior_secondary: ["Grade 7 / JSS 1", "Grade 8 / JSS 2", "Grade 9 / JSS 3"],
};

export const ALL_GRADES = [
  ...CBC_GRADES.lower_primary,
  ...CBC_GRADES.upper_primary,
  ...CBC_GRADES.junior_secondary,
];

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
  4: "10:20–11:10", // break after period 3
  5: "11:10–12:00",
  6: "12:00–12:50",
  7: "1:30–2:20", // lunch after period 6
  8: "2:20–3:10",
};
