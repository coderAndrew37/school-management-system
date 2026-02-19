import { createServerClient } from "@/lib/supabase/client";
import { ReportStudent, ReportAssessment } from "@/lib/types/reports";

interface RawAssessment {
  subject_name: string;
  strand_id: string;
  score: "EE" | "ME" | "AE" | "BE" | null;
  teacher_remarks: string | null;
  term: number;
  academic_year: number;
  teachers: { full_name: string } | null;
}

interface RawStudent {
  full_name: string;
  readable_id: string | null;
  date_of_birth: string;
  gender: "Male" | "Female" | null;
  current_grade: string;
  parents: { full_name: string; phone_number: string } | null;
  assessments: RawAssessment[];
}

export async function fetchStudentsForReports(
  grade: string | null,
  term: number,
  academicYear: number,
): Promise<ReportStudent[]> {
  const supabase = createServerClient();

  let query = supabase
    .from("students")
    .select(
      `
      full_name,
      readable_id,
      date_of_birth,
      gender,
      current_grade,
      parents ( full_name, phone_number ),
      assessments (
        subject_name,
        strand_id,
        score,
        teacher_remarks,
        term,
        academic_year,
        teachers ( full_name )
      )
    `,
    )
    .order("current_grade")
    .order("full_name");

  if (grade && grade !== "all") {
    query = query.eq("current_grade", grade);
  }

  const { data, error } = await query;

  if (error) {
    console.error("fetchStudentsForReports error:", error);
    return [];
  }

  return ((data ?? []) as RawStudent[]).map(
    (s): ReportStudent => ({
      full_name: s.full_name,
      readable_id: s.readable_id,
      date_of_birth: s.date_of_birth,
      gender: s.gender,
      current_grade: s.current_grade,
      parent_name: s.parents?.full_name ?? null,
      parent_phone: s.parents?.phone_number ?? null,
      assessments: (s.assessments ?? [])
        .filter((a) => a.term === term && a.academic_year === academicYear)
        .map(
          (a): ReportAssessment => ({
            subject_name: a.subject_name,
            strand_id: a.strand_id,
            score: a.score,
            teacher_remarks: a.teacher_remarks,
            teacher_name: a.teachers?.full_name ?? null,
            term: a.term,
            academic_year: a.academic_year,
          }),
        ),
    }),
  );
}

export async function fetchAllGrades(): Promise<string[]> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("students")
    .select("current_grade");

  if (error) return [];

  const grades = [
    ...new Set(
      (data ?? []).map((r: { current_grade: string }) => r.current_grade),
    ),
  ];

  // Sort by CBC order
  const cbcOrder = [
    "PP1",
    "PP2",
    "Grade 1",
    "Grade 2",
    "Grade 3",
    "Grade 4",
    "Grade 5",
    "Grade 6",
    "Grade 7 / JSS 1",
    "Grade 8 / JSS 2",
    "Grade 9 / JSS 3",
    "Form 1",
    "Form 2",
    "Form 3",
    "Form 4",
  ];

  return grades.sort((a, b) => {
    const ai = cbcOrder.indexOf(a);
    const bi = cbcOrder.indexOf(b);
    if (ai === -1 && bi === -1) return a.localeCompare(b);
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });
}
