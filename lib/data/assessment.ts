import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { SubjectLevel } from "@/lib/types/allocation";
import type { CbcScore, AssessmentGridState } from "@/lib/types/assessment";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface TeacherAllocationSummary {
  id: string;
  grade: string;
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
  current_grade: string;
}

export interface ClassAssessmentData {
  students: ClassStudent[];
  gridState: AssessmentGridState; // flat: `${studentId}:${subjectName}:${strandId}`
  prevTermScores: AssessmentGridState | null; // flat grid from the previous term, null if none
  hasPrevTerm: boolean; // true when prevTermScores has at least one score
}

export interface TeacherDiaryEntry {
  id: string;
  student_id: string;
  student_name: string;
  grade: string;
  title: string;
  content: string | null;
  homework: boolean;
  due_date: string | null;
  is_completed: boolean;
  created_at: string;
}

export interface AttendanceRecord {
  id: string;
  student_id: string;
  status: "Present" | "Absent" | "Late";
  date: string;
  remarks: string | null;
}

// ── Raw DB shapes ─────────────────────────────────────────────────────────────

interface RawAllocationRow {
  id: string;
  teacher_id: string;
  subject_id: string;
  grade: string;
  academic_year: number;
  created_at: string;
  teachers:
    | {
        id: string;
        full_name: string;
        email: string;
        tsc_number: string | null;
      }[]
    | null;
  subjects:
    | {
        id: string;
        name: string;
        code: string;
        level: SubjectLevel;
        weekly_lessons: number;
      }[]
    | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function fetchStudentCountsByGrade(
  grades: string[],
): Promise<Record<string, number>> {
  if (grades.length === 0) return {};
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("students")
    .select("current_grade")
    .in("current_grade", grades);
  const counts: Record<string, number> = {};
  for (const row of (data ?? []) as { current_grade: string }[])
    counts[row.current_grade] = (counts[row.current_grade] ?? 0) + 1;
  return counts;
}

/** Build a flat AssessmentGridState from raw DB rows.
 *  Key format: `${studentId}:${subjectName}:${strandId}` — matches BatchAssessmentGrid. */
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
    .select(
      `
      id, teacher_id, subject_id, grade, academic_year, created_at,
      teachers ( id, full_name, email, tsc_number ),
      subjects ( id, name, code, level, weekly_lessons )
    `,
    )
    .eq("teacher_id", teacherId)
    .eq("academic_year", academicYear)
    .order("grade")
    .returns<RawAllocationRow[]>();

  if (error || !data) return [];

  const grades = [...new Set(data.map((r) => r.grade))];
  const studentCounts = await fetchStudentCountsByGrade(grades);

  return data.map(
    (row): TeacherAllocationSummary => ({
      id: row.id,
      grade: row.grade,
      subjectName: row.subjects?.[0]?.name ?? "Unknown Subject",
      subjectCode: row.subjects?.[0]?.code ?? "—",
      subjectLevel: row.subjects?.[0]?.level ?? "upper_primary",
      weeklyLessons: row.subjects?.[0]?.weekly_lessons ?? 0,
      studentCount: studentCounts[row.grade] ?? 0,
    }),
  );
}

/**
 * Fetch students + their existing assessments for one class/subject/term.
 * Also fetches the previous term's scores so the grid can offer copy-forward.
 *
 * Grid state key format: `${studentId}:${subjectName}:${strandId}`
 */
export async function fetchClassAssessments(
  grade: string,
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

  // Three-way parallel fetch.
  // prevTerm slot resolves to empty array when term === 1 to avoid the
  // PostgrestFilterBuilder-is-not-a-Promise type error from a dynamic queries array.
  const [studentsRes, currentRes, prevRes] = await Promise.all([
    supabase
      .from("students")
      .select("id, full_name, readable_id, gender, current_grade")
      .eq("current_grade", grade)
      .eq("status", "active")
      .order("full_name")
      .returns<ClassStudent[]>(),

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

/**
 * All students in a grade — used for attendance + diary views.
 */
export async function fetchClassStudents(
  grade: string,
): Promise<ClassStudent[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("students")
    .select("id, full_name, readable_id, gender, current_grade")
    .eq("current_grade", grade)
    .eq("status", "active")
    .order("full_name")
    .returns<ClassStudent[]>();
  if (error) {
    console.error("[fetchClassStudents]", error.message);
    return [];
  }
  return data ?? [];
}

export async function fetchClassAttendance(
  grade: string,
  date: string,
): Promise<AttendanceRecord[]> {
  const supabase = await createSupabaseServerClient();
  const students = await fetchClassStudents(grade);
  if (students.length === 0) return [];
  const { data, error } = await supabase
    .from("attendance")
    .select("id, student_id, status, date, remarks")
    .in(
      "student_id",
      students.map((s) => s.id),
    )
    .eq("date", date)
    .returns<AttendanceRecord[]>();
  if (error) {
    console.error("[fetchClassAttendance]", error.message);
    return [];
  }
  return data ?? [];
}

export async function fetchTeacherDiaryEntries(
  grades: string[],
  limit = 20,
): Promise<TeacherDiaryEntry[]> {
  if (grades.length === 0) return [];
  const supabase = await createSupabaseServerClient();
  const { data: studentRows } = await supabase
    .from("students")
    .select("id, full_name, current_grade")
    .in("current_grade", grades);
  const studentMap: Record<string, { name: string; grade: string }> = {};
  for (const s of (studentRows ?? []) as any[])
    studentMap[s.id] = { name: s.full_name, grade: s.current_grade };
  const studentIds = Object.keys(studentMap);
  if (studentIds.length === 0) return [];
  const { data, error } = await supabase
    .from("student_diary")
    .select(
      "id, student_id, title, content, homework, due_date, is_completed, created_at",
    )
    .in("student_id", studentIds)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) {
    console.error("[fetchTeacherDiaryEntries]", error.message);
    return [];
  }
  return (data ?? []).map((row) => ({
    id: row.id,
    student_id: row.student_id,
    student_name: studentMap[row.student_id]?.name ?? "Unknown",
    grade: studentMap[row.student_id]?.grade ?? "—",
    title: row.title,
    content: row.content,
    homework: row.homework,
    due_date: row.due_date,
    is_completed: row.is_completed,
    created_at: row.created_at,
  }));
}
