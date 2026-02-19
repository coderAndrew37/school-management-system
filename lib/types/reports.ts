export interface ReportStudent {
  full_name: string;
  readable_id: string | null;
  date_of_birth: string;
  gender: "Male" | "Female" | null;
  current_grade: string;
  parent_name: string | null;
  parent_phone: string | null;
  assessments: ReportAssessment[];
}

export interface ReportAssessment {
  subject_name: string;
  strand_id: string;
  score: "EE" | "ME" | "AE" | "BE" | null;
  teacher_remarks: string | null;
  teacher_name: string | null;
  term: number;
  academic_year: number;
}

export interface ReportGenerationPayload {
  students: ReportStudent[];
  term: number;
  academic_year: number;
  mode: "bulk" | "single";
}

export type ReportTerm = 1 | 2 | 3;

export interface ReportFilter {
  grade: string;
  term: ReportTerm;
  academic_year: number;
}
