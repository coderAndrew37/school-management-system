import { createServerClient } from "@/lib/supabase/client";
import {
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

/**
 * Helper to transform Supabase array-based joins into single objects
 */
function mapAllocationRow(row: any): TeacherSubjectAllocation {
  return {
    ...row,
    // Supabase returns these as arrays if it's not sure about the relationship cardinality
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

  // Transform data to fix the array vs object mismatch
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

  // Transform data to fix the array vs object mismatch
  return (data ?? []).map(mapAllocationRow);
}

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
        grade,
        teachers ( full_name ),
        subjects ( name, code )
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

  // Cast to any first to handle the potential array wrapping in nested objects
  const rawSlots = (data ?? []) as any[];

  for (const rawSlot of rawSlots) {
    // Correctly handle the potential array wrapping in nested join
    let alloc = rawSlot.teacher_subject_allocations;
    if (Array.isArray(alloc)) {
      alloc = alloc[0];
    }

    if (alloc) {
      // Further flatten nested teachers/subjects if they came back as arrays
      const teacher = Array.isArray(alloc.teachers)
        ? alloc.teachers[0]
        : alloc.teachers;
      const subject = Array.isArray(alloc.subjects)
        ? alloc.subjects[0]
        : alloc.subjects;

      if (teacher && subject) {
        const key = `${rawSlot.day_of_week}-${rawSlot.period}`;
        grid[key] = {
          teacherName: teacher.full_name,
          subjectName: subject.name,
          subjectCode: subject.code,
          allocationId: rawSlot.allocation_id,
        };
      }
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
  const grades = [
    ...new Set((data ?? []).map((r: { grade: string }) => r.grade)),
  ];
  return grades.sort();
}
