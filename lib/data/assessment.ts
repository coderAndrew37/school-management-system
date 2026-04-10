// lib/data/assessment.ts
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { SubjectLevel } from "@/lib/types/allocation";
import type { CbcScore, AssessmentGridState } from "@/lib/types/assessment";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface TeacherAllocationSummary {
  id: string;
  classId: string;
  grade: string;
  stream: string;
  subjectName: string;
  subjectCode: string;
  subjectLevel: SubjectLevel;
  weeklyLessons: number;
  studentCount: number;
}

export interface ClassStudent {
  id: string;
  full_name: string;
  readable_id: string | null;
  gender: "Male" | "Female" | null;
  class_id: string;
}

export interface ClassAssessmentData {
  students: ClassStudent[];
  gridState: AssessmentGridState;
  prevTermScores: AssessmentGridState | null;
  hasPrevTerm: boolean;
}

export interface AttendanceRecord {
  id: string;
  student_id: string;
  status: "Present" | "Absent" | "Late";
  date: string;
  remarks: string | null;
}

// Internal interface for Supabase Joins
interface JoinedAllocationRow {
  id: string;
  teacher_id: string;
  subject_id: string;
  class_id: string;
  academic_year: number;
  subjects: {
    id: string;
    name: string;
    code: string;
    level: SubjectLevel;
    weekly_lessons: number;
  } | null;
  classes: {
    id: string;
    grade: string;
    stream: string;
  } | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function fetchStudentCountsByClass(
  classIds: string[],
): Promise<Record<string, number>> {
  if (classIds.length === 0) return {};
  const supabase = await createSupabaseServerClient();

  const { data } = await supabase
    .from("students")
    .select("class_id")
    .in("class_id", classIds)
    .eq("status", "active");

  const counts: Record<string, number> = {};
  for (const row of (data ?? []) as { class_id: string }[]) {
    counts[row.class_id] = (counts[row.class_id] ?? 0) + 1;
  }
  return counts;
}

function buildGridState(
  rows: { student_id: string; strand_id: string; score: CbcScore | null }[],
  subjectName: string,
  dirty = false,
): AssessmentGridState {
  const grid: AssessmentGridState = {};
  for (const row of rows) {
    if (!row.score) continue;
    const key = `${row.student_id}:${subjectName}:${row.strand_id}`;
    grid[key] = { assessmentId: null, score: row.score, dirty };
  }
  return grid;
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function fetchTeacherAssessmentAllocations(
  teacherId: string,
  academicYear = 2026,
): Promise<TeacherAllocationSummary[]> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("teacher_subject_allocations")
    .select(`
      id, teacher_id, subject_id, class_id, academic_year,
      subjects ( id, name, code, level, weekly_lessons ),
      classes ( id, grade, stream )
    `)
    .eq("teacher_id", teacherId)
    .eq("academic_year", academicYear);

  if (error || !data) return [];

  const typedData = data as unknown as JoinedAllocationRow[];
  const classIds = [...new Set(typedData.map((r) => r.class_id))];
  const studentCounts = await fetchStudentCountsByClass(classIds);

  return typedData.map((row): TeacherAllocationSummary => {
    const sub = row.subjects;
    const cls = row.classes;
    
    return {
      id: row.id,
      classId: row.class_id,
      grade: cls?.grade ?? "Unknown",
      stream: cls?.stream ?? "—",
      subjectName: sub?.name ?? "Unknown Subject",
      subjectCode: sub?.code ?? "—",
      subjectLevel: sub?.level ?? "upper_primary",
      weeklyLessons: sub?.weekly_lessons ?? 0,
      studentCount: studentCounts[row.class_id] ?? 0,
    };
  });
}

export async function fetchClassAssessments(
  classId: string,
  subjectName: string,
  term: 1 | 2 | 3,
  academicYear = 2026,
): Promise<ClassAssessmentData> {
  const supabase = await createSupabaseServerClient();
  const prevTerm = term > 1 ? ((term - 1) as 1 | 2) : null;

  type AssessRow = {
    student_id: string;
    strand_id: string;
    score: CbcScore | null;
  };

  const [studentsRes, currentRes, prevRes] = await Promise.all([
    supabase
      .from("students")
      .select("id, full_name, readable_id, gender, class_id")
      .eq("class_id", classId)
      .eq("status", "active")
      .order("full_name"),

    supabase
      .from("assessments")
      .select("student_id, strand_id, score")
      .eq("subject_name", subjectName)
      .eq("term", term)
      .eq("academic_year", academicYear),

    prevTerm
      ? supabase
          .from("assessments")
          .select("student_id, strand_id, score")
          .eq("subject_name", subjectName)
          .eq("term", prevTerm)
          .eq("academic_year", academicYear)
      : Promise.resolve({ data: [] as AssessRow[], error: null }),
  ]);

  const students = (studentsRes.data ?? []) as ClassStudent[];
  const assessments = (currentRes.data ?? []) as AssessRow[];
  const prevAssessments = (prevRes.data ?? []) as AssessRow[];

  const gridState = buildGridState(assessments, subjectName, false);
  const prevTermScores = prevTerm
    ? buildGridState(prevAssessments, subjectName, false)
    : null;

  return {
    students,
    gridState,
    prevTermScores,
    hasPrevTerm:
      prevTerm !== null && Object.keys(prevTermScores ?? {}).length > 0,
  };
}

export async function fetchClassStudents(
  classId: string,
): Promise<ClassStudent[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("students")
    .select("id, full_name, readable_id, gender, class_id")
    .eq("class_id", classId)
    .eq("status", "active")
    .order("full_name");

  if (error) {
    console.error("[fetchClassStudents]", error.message);
    return [];
  }
  return (data ?? []) as ClassStudent[];
}

export async function fetchClassAttendance(
  classId: string,
  date: string,
): Promise<AttendanceRecord[]> {
  const supabase = await createSupabaseServerClient();

  const { data: students } = await supabase
    .from("students")
    .select("id")
    .eq("class_id", classId)
    .eq("status", "active");

  if (!students || students.length === 0) return [];

  const studentIds = students.map((s) => s.id);

  const { data, error } = await supabase
    .from("attendance")
    .select("id, student_id, status, date, remarks")
    .in("student_id", studentIds)
    .eq("date", date);

  if (error) {
    console.error("[fetchClassAttendance]", error.message);
    return [];
  }
  return (data ?? []) as AttendanceRecord[];
}