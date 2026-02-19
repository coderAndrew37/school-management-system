import { createServerClient } from "@/lib/supabase/client";
import {
  Subject,
  TeacherSubjectAllocation,
  TimetableSlot,
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
  return (data ?? []) as TeacherSubjectAllocation[];
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
  return (data ?? []) as TeacherSubjectAllocation[];
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
  for (const slot of (data ?? []) as TimetableSlot[]) {
    const key = `${slot.day_of_week}-${slot.period}`;
    const alloc = slot.teacher_subject_allocations;
    if (alloc?.subjects && alloc?.teachers) {
      grid[key] = {
        teacherName: alloc.teachers.full_name,
        subjectName: alloc.subjects.name,
        subjectCode: alloc.subjects.code,
        allocationId: slot.allocation_id,
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
  const grades = [
    ...new Set((data ?? []).map((r: { grade: string }) => r.grade)),
  ];
  return grades.sort();
}
