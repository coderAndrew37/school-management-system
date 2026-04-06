import { createServerClient } from "@/lib/supabase/client";
import type {
  Subject,
  TeacherSubjectAllocation,
  TimetableGrid,
} from "@/lib/types/allocation";

// ── 1. Fetch Subjects ─────────────────────────────────────────────────────────

export async function fetchSubjects(): Promise<Subject[]> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("subjects")
    .select("*")
    .order("level")
    .order("name");
  if (error) {
    console.error("fetchSubjects:", error);
    return [];
  }
  return (data ?? []) as Subject[];
}

// Helper to flatten Supabase's joined array responses
function mapAllocationRow(row: any): TeacherSubjectAllocation {
  return {
    ...row,
    // Flatten joins if they come back as single-item arrays
    teachers: Array.isArray(row.teachers) ? row.teachers[0] : row.teachers,
    subjects: Array.isArray(row.subjects) ? row.subjects[0] : row.subjects,
    classes: Array.isArray(row.classes) ? row.classes[0] : row.classes,
  };
}

// ── 2. Fetch All Allocations ──────────────────────────────────────────────────

export async function fetchAllocations(
  academicYear = 2026,
): Promise<TeacherSubjectAllocation[]> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("teacher_subject_allocations")
    .select(
      `
      id, teacher_id, subject_id, class_id, academic_year, created_at,
      teachers ( id, full_name, email, tsc_number ),
      subjects ( id, name, code, level, weekly_lessons ),
      classes ( id, grade, stream )
    `,
    )
    .eq("academic_year", academicYear)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("fetchAllocations:", error);
    return [];
  }
  return (data ?? []).map(mapAllocationRow);
}

// ── 3. Fetch Allocations by Teacher ───────────────────────────────────────────

export async function fetchAllocationsByTeacher(
  teacherId: string,
  academicYear = 2026,
): Promise<TeacherSubjectAllocation[]> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("teacher_subject_allocations")
    .select(
      `
      id, teacher_id, subject_id, class_id, academic_year, created_at,
      teachers ( id, full_name, email, tsc_number ),
      subjects ( id, name, code, level, weekly_lessons ),
      classes ( id, grade, stream )
    `,
    )
    .eq("teacher_id", teacherId)
    .eq("academic_year", academicYear);

  if (error) {
    console.error("fetchAllocationsByTeacher:", error);
    return [];
  }
  return (data ?? []).map(mapAllocationRow);
}

// ── 4. Fetch Timetable for a Specific Class ──────────────────────────────────

export async function fetchTimetableForGrade(
  gradeLabel: string, // format: "Grade 4-North"
  academicYear = 2026,
): Promise<TimetableGrid> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("timetable_slots")
    .select(
      `
      id, allocation_id, grade, day_of_week, period, academic_year,
      teacher_subject_allocations (
        teacher_id,
        teachers ( id, full_name ),
        subjects ( name, code )
      )
    `,
    )
    .eq("grade", gradeLabel)
    .eq("academic_year", academicYear);

  if (error) {
    console.error("fetchTimetableForGrade:", error);
    return {};
  }

  const grid: TimetableGrid = {};

  for (const rawSlot of (data ?? []) as any[]) {
    let alloc = rawSlot.teacher_subject_allocations;
    if (Array.isArray(alloc)) alloc = alloc[0];
    if (!alloc) continue;

    const teacher = Array.isArray(alloc.teachers)
      ? alloc.teachers[0]
      : alloc.teachers;
    const subject = Array.isArray(alloc.subjects)
      ? alloc.subjects[0]
      : alloc.subjects;

    if (teacher && subject) {
      const key = `${rawSlot.day_of_week}-${rawSlot.period}`;
      grid[key] = {
        slotId: rawSlot.id,
        teacherName: teacher.full_name,
        subjectName: subject.name,
        subjectCode: subject.code,
        allocationId: rawSlot.allocation_id,
        teacherId: teacher.id ?? alloc.teacher_id,
      };
    }
  }
  return grid;
}

// ── 5. Get List of Grades that have Timetables ────────────────────────────────

export async function fetchAllGradesWithTimetable(
  academicYear = 2026,
): Promise<string[]> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("timetable_slots")
    .select("grade")
    .eq("academic_year", academicYear);

  if (error) return [];
  // Use a Set to get unique Grade-Stream labels
  return [...new Set((data ?? []).map((r: any) => r.grade))].sort();
}

// ── 6. Fetch allocations for a class (for the timetable dropdown) ─────────────

export interface GradeAllocation {
  allocationId: string;
  subjectName: string;
  subjectCode: string;
  teacherName: string;
  teacherId: string;
}

export async function fetchGradeAllocations(
  gradeLabel: string, // e.g. "Grade 4-North"
  academicYear = 2026,
): Promise<GradeAllocation[]> {
  const supabase = createServerClient();

  // We filter by the 'grade' label in timetable logic because that's what
  // the generator uses to identify unique class groups
  const { data, error } = await supabase
    .from("teacher_subject_allocations")
    .select(
      `
      id,
      teachers ( id, full_name ),
      subjects ( name, code ),
      classes ( grade, stream )
    `,
    )
    .eq("academic_year", academicYear);

  if (error) {
    console.error("fetchGradeAllocations:", error);
    return [];
  }

  // Filter in JS to match the specific grade/stream label
  return (data ?? [])
    .map(mapAllocationRow)
    .filter(
      (row) => `${row.classes?.grade}-${row.classes?.stream}` === gradeLabel,
    )
    .map(
      (row): GradeAllocation => ({
        allocationId: row.id,
        subjectName: row.subjects?.name ?? "Unknown",
        subjectCode: row.subjects?.code ?? "?",
        teacherName: row.teachers?.full_name ?? "Unknown",
        teacherId: row.teachers?.id ?? "",
      }),
    );
}
