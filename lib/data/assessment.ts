import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { AssessmentGridState, GridStudent } from "@/lib/types/assessment";

// ── Types for raw DB rows ─────────────────────────────────────────────────────

interface RawAssessment {
  id: string;
  student_id: string;
  subject_name: string;
  strand_id: string;
  score: "EE" | "ME" | "AE" | "BE" | null;
  term: number;
  academic_year: number;
}

interface RawNarrative {
  student_id: string;
  subject_name: string;
  narrative: string;
}

// ── Fetch a teacher's own record from their profile teacher_id ────────────────

export async function fetchTeacherRecord(teacherId: string) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("teachers")
    .select("id, full_name, email, tsc_number")
    .eq("id", teacherId)
    .single();
  return data;
}

// ── Fetch students in a grade with existing assessments for a term ────────────

export interface ClassAssessmentData {
  students: GridStudent[];
  gridState: AssessmentGridState;
}

export async function fetchClassAssessments(
  grade: string,
  subjectName: string,
  term: number,
  academicYear: number = 2026,
): Promise<ClassAssessmentData> {
  const supabase = await createSupabaseServerClient();

  // Fetch students in this grade
  const { data: studentData, error: sErr } = await supabase
    .from("students")
    .select("id, full_name, readable_id, current_grade")
    .eq("current_grade", grade)
    .order("full_name");

  if (sErr) {
    console.error("[fetchClassAssessments] students:", sErr.message);
    return { students: [], gridState: {} };
  }

  const students = (studentData ?? []) as GridStudent[];
  const studentIds = students.map((s) => s.id);

  if (studentIds.length === 0) return { students: [], gridState: {} };

  // Fetch existing assessments for this subject/term
  const { data: assessData } = await supabase
    .from("assessments")
    .select(
      "id, student_id, subject_name, strand_id, score, term, academic_year",
    )
    .in("student_id", studentIds)
    .eq("subject_name", subjectName)
    .eq("term", term)
    .eq("academic_year", academicYear);

  // Fetch cached narrative remarks
  const { data: narrativeData } = await supabase
    .from("assessment_narratives")
    .select("student_id, subject_name, narrative")
    .in("student_id", studentIds)
    .eq("subject_name", subjectName)
    .eq("term", term)
    .eq("academic_year", academicYear);

  // Build narrative lookup
  const narrativeMap: Record<string, string> = {};
  for (const n of (narrativeData ?? []) as RawNarrative[]) {
    narrativeMap[n.student_id] = n.narrative;
  }

  // Attach narratives to students
  const studentsWithNarratives: GridStudent[] = students.map((s) => ({
    ...s,
    narrative: narrativeMap[s.id] ?? null,
  }));

  // Build grid state from existing DB rows
  const gridState: AssessmentGridState = {};
  for (const a of (assessData ?? []) as RawAssessment[]) {
    const key = `${a.student_id}:${a.subject_name}:${a.strand_id}`;
    gridState[key] = {
      assessmentId: a.id,
      score: a.score,
      dirty: false,
    };
  }

  return { students: studentsWithNarratives, gridState };
}

// ── Fetch teacher's allocations (grade+subject combos) ───────────────────────

export interface TeacherAllocationSummary {
  id: string;
  grade: string;
  subjectName: string;
  subjectCode: string;
  subjectLevel: string;
  studentCount: number;
}

export async function fetchTeacherAssessmentAllocations(
  teacherId: string,
  academicYear: number = 2026,
): Promise<TeacherAllocationSummary[]> {
  const supabase = await createSupabaseServerClient();

  const { data: allocData, error } = await supabase
    .from("teacher_subject_allocations")
    .select(
      `
      id, grade, academic_year,
      subjects ( name, code, level )
    `,
    )
    .eq("teacher_id", teacherId)
    .eq("academic_year", academicYear)
    .order("grade");

  if (error) {
    console.error("[fetchTeacherAssessmentAllocations]", error.message);
    return [];
  }

  if (!allocData || allocData.length === 0) return [];

  // Count students per grade
  const grades = [...new Set(allocData.map((a: any) => a.grade as string))];
  const { data: studentData } = await supabase
    .from("students")
    .select("current_grade")
    .in("current_grade", grades);

  const counts: Record<string, number> = {};
  for (const s of (studentData ?? []) as { current_grade: string }[]) {
    counts[s.current_grade] = (counts[s.current_grade] ?? 0) + 1;
  }

  return (allocData as any[]).map((a) => ({
    id: a.id as string,
    grade: a.grade as string,
    subjectName: a.subjects?.name ?? "",
    subjectCode: a.subjects?.code ?? "",
    subjectLevel: a.subjects?.level ?? "",
    studentCount: counts[a.grade as string] ?? 0,
  }));
}
