import { createServerClient } from "@/lib/supabase/client";
import type {
  Subject,
  TeacherSubjectAllocation,
  TimetableGrid,
} from "@/lib/types/allocation";

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

function mapAllocationRow(row: any): TeacherSubjectAllocation {
  return {
    ...row,
    teachers: Array.isArray(row.teachers) ? row.teachers[0] : row.teachers,
    subjects: Array.isArray(row.subjects) ? row.subjects[0] : row.subjects,
  };
}

export async function fetchAllocations(
  academicYear = 2026,
): Promise<TeacherSubjectAllocation[]> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("teacher_subject_allocations")
    .select(
      `
      id, teacher_id, subject_id, grade, academic_year, created_at,
      teachers ( id, full_name, email, tsc_number ),
      subjects ( id, name, code, level, weekly_lessons )
    `,
    )
    .eq("academic_year", academicYear)
    .order("grade")
    .order("created_at");
  if (error) {
    console.error("fetchAllocations:", error);
    return [];
  }
  return (data ?? []).map(mapAllocationRow);
}

export async function fetchAllocationsByTeacher(
  teacherId: string,
  academicYear = 2026,
): Promise<TeacherSubjectAllocation[]> {
  const supabase = createServerClient();
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
    .order("grade");
  if (error) {
    console.error("fetchAllocationsByTeacher:", error);
    return [];
  }
  return (data ?? []).map(mapAllocationRow);
}

/**
 * Fetch timetable grid for a grade.
 * Now includes slotId and teacherId in each cell for editing support.
 */
export async function fetchTimetableForGrade(
  grade: string,
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
        subjects  ( name, code )
      )
    `,
    )
    .eq("grade", grade)
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
        slotId: rawSlot.id, // ← new: needed for mutations
        teacherName: teacher.full_name,
        subjectName: subject.name,
        subjectCode: subject.code,
        allocationId: rawSlot.allocation_id,
        teacherId: teacher.id ?? alloc.teacher_id, // ← new: for conflict UI
      };
    }
  }
  return grid;
}

export async function fetchAllGradesWithTimetable(
  academicYear = 2026,
): Promise<string[]> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("timetable_slots")
    .select("grade")
    .eq("academic_year", academicYear);
  if (error) return [];
  return [
    ...new Set((data ?? []).map((r: { grade: string }) => r.grade)),
  ].sort();
}

// ── Fetch allocations for a grade (used by timetable assign dropdown) ─────────

export interface GradeAllocation {
  allocationId: string;
  subjectName: string;
  subjectCode: string;
  teacherName: string;
  teacherId: string;
}

export async function fetchGradeAllocations(
  grade: string,
  academicYear = 2026,
): Promise<GradeAllocation[]> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("teacher_subject_allocations")
    .select(
      `
      id,
      teachers ( id, full_name ),
      subjects  ( name, code )
    `,
    )
    .eq("grade", grade)
    .eq("academic_year", academicYear);

  if (error) {
    console.error("fetchGradeAllocations:", error);
    return [];
  }

  return ((data ?? []) as any[]).map((row): GradeAllocation => {
    const teacher = Array.isArray(row.teachers)
      ? row.teachers[0]
      : row.teachers;
    const subject = Array.isArray(row.subjects)
      ? row.subjects[0]
      : row.subjects;
    return {
      allocationId: row.id,
      subjectName: subject?.name ?? "Unknown",
      subjectCode: subject?.code ?? "?",
      teacherName: teacher?.full_name ?? "Unknown",
      teacherId: teacher?.id ?? "",
    };
  });
}
