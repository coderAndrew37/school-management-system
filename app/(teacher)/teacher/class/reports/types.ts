export type CbcScore = "EE" | "ME" | "AE" | "BE";

export interface SubjectScore {
  subject_name: string;
  strand_id: string;
  score: CbcScore;
  teacher_remarks: string | null;
  term: number;
}

export interface StudentReport {
  id: string;
  full_name: string;
  readable_id: string | null;
  gender: "Male" | "Female" | null;
  date_of_birth: string;
  present: number;
  absent: number;
  late: number;
  total_days: number;
  attendance_rate: number;
  scores: SubjectScore[];
  report_card_id: string | null;
  class_teacher_remarks: string | null;
  conduct_grade: string | null;
  effort_grade: string | null;
  status: "draft" | "published" | null;
}
