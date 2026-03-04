// ─────────────────────────────────────────────────────────────────────────────
// lib/data/students.ts
// Server-side data for the admin students management page.
// ─────────────────────────────────────────────────────────────────────────────
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ALL_GRADES } from "@/lib/types/allocation";
import { GRADE_LEVEL_MAP } from "@/lib/types/assessment";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface StudentWithParent {
  id: string;
  readable_id: string | null;
  upi_number: string | null;
  full_name: string;
  date_of_birth: string;
  gender: "Male" | "Female" | null;
  current_grade: string;
  parent_id: string | null;
  created_at: string;
  parent: {
    full_name: string;
    email: string;
    phone_number: string;
  } | null;
  assessmentCount: number;
}

export interface GradeGroup {
  grade: string;
  level: string;
  students: StudentWithParent[];
}

export interface StudentsPageData {
  students: StudentWithParent[];
  byGrade: GradeGroup[];
  gradeEnrollment: Record<string, number>;
  totalStudents: number;
  totalWithParents: number;
  totalAssessed: number;
}

// ── Fetch ─────────────────────────────────────────────────────────────────────

export async function fetchStudentsWithParents(): Promise<StudentsPageData> {
  const supabase = await createSupabaseServerClient();

  const [studentsRes, assessRes] = await Promise.all([
    supabase
      .from("students")
      .select(
        `
        id, readable_id, upi_number, full_name, date_of_birth,
        gender, current_grade, parent_id, created_at,
        parents ( full_name, email, phone_number )
      `,
      )
      .order("full_name"),
    supabase
      .from("assessments")
      .select("student_id", { count: "exact" })
      .eq("academic_year", 2026)
      .eq("term", 1)
      .not("score", "is", null),
  ]);

  const raw = (studentsRes.data ?? []) as (Omit<
    StudentWithParent,
    "parent" | "assessmentCount"
  > & {
    parents: { full_name: string; email: string; phone_number: string } | null;
  })[];

  // Count assessments per student
  const assessCounts: Record<string, number> = {};
  for (const a of (assessRes.data ?? []) as { student_id: string }[]) {
    assessCounts[a.student_id] = (assessCounts[a.student_id] ?? 0) + 1;
  }

  const students: StudentWithParent[] = raw.map((s) => ({
    ...s,
    parent: s.parents ?? null,
    assessmentCount: assessCounts[s.id] ?? 0,
  }));

  // Group by grade (preserving CBC order)
  const byGrade: GradeGroup[] = ALL_GRADES.map((grade) => ({
    grade,
    level: GRADE_LEVEL_MAP[grade] ?? "lower_primary",
    students: students.filter((s) => s.current_grade === grade),
  })).filter((g) => g.students.length > 0);

  const gradeEnrollment: Record<string, number> = {};
  for (const s of students) {
    gradeEnrollment[s.current_grade] =
      (gradeEnrollment[s.current_grade] ?? 0) + 1;
  }

  return {
    students,
    byGrade,
    gradeEnrollment,
    totalStudents: students.length,
    totalWithParents: students.filter((s) => s.parent_id !== null).length,
    totalAssessed: students.filter((s) => (assessCounts[s.id] ?? 0) > 0).length,
  };
}
