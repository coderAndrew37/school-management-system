import { createServerClient } from "@/lib/supabase/client";
import type {
  Subject,
  TeacherSubjectAllocation,
  TimetableGrid,
  Class,
  SubjectLevel
} from "@/lib/types/allocation";

// ── 1. Internal Types for Supabase Joins ──────────────────────────────────────

interface RawAllocationRow {
  id: string;
  teacher_id: string;
  subject_id: string;
  class_id: string;
  academic_year: number;
  created_at: string;
  teachers: { id: string; full_name: string; email: string; tsc_number: string | null } | { id: string; full_name: string; email: string; tsc_number: string | null }[];
  subjects: { id: string; name: string; code: string; level: SubjectLevel; weekly_lessons: number } | { id: string; name: string; code: string; level: SubjectLevel; weekly_lessons: number }[];
  classes: Class | Class[];
}

interface RawTimetableSlot {
  id: string;
  allocation_id: string;
  grade: string;
  day_of_week: number;
  period: number;
  academic_year: number;
  teacher_subject_allocations: {
    teacher_id: string;
    class_id: string;
    teachers: { id: string; full_name: string } | { id: string; full_name: string }[] | null;
    subjects: { name: string; code: string } | { name: string; code: string }[] | null;
    classes: Class | Class[] | null;
  } | {
    teacher_id: string;
    class_id: string;
    teachers: { id: string; full_name: string } | { id: string; full_name: string }[] | null;
    subjects: { name: string; code: string } | { name: string; code: string }[] | null;
    classes: Class | Class[] | null;
  }[] | null;
}

// ── 2. Helpers ────────────────────────────────────────────────────────────────

function mapAllocationRow(row: RawAllocationRow): TeacherSubjectAllocation {
  return {
    ...row,
    teachers: Array.isArray(row.teachers) ? row.teachers[0] : row.teachers,
    subjects: Array.isArray(row.subjects) ? row.subjects[0] : row.subjects,
    classes: Array.isArray(row.classes) ? row.classes[0] : row.classes,
  };
}

// ── 3. Fetch Functions ────────────────────────────────────────────────────────

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
    .select(`
      id, teacher_id, subject_id, class_id, academic_year, created_at,
      teachers ( id, full_name, email, tsc_number ),
      subjects ( id, name, code, level, weekly_lessons ),
      classes ( id, grade, stream, level, academic_year )
    `)
    .eq("academic_year", academicYear)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("fetchAllocations:", error);
    return [];
  }
  return (data as unknown as RawAllocationRow[] ?? []).map(mapAllocationRow);
}

export async function fetchAllocationsByTeacher(
  teacherId: string,
  academicYear = 2026,
): Promise<TeacherSubjectAllocation[]> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("teacher_subject_allocations")
    .select(`
      id, teacher_id, subject_id, class_id, academic_year, created_at,
      teachers ( id, full_name, email, tsc_number ),
      subjects ( id, name, code, level, weekly_lessons ),
      classes ( id, grade, stream, level, academic_year )
    `)
    .eq("teacher_id", teacherId)
    .eq("academic_year", academicYear);

  if (error) {
    console.error("fetchAllocationsByTeacher:", error);
    return [];
  }
  return (data as unknown as RawAllocationRow[] ?? []).map(mapAllocationRow);
}

export async function fetchTimetableForGrade(
  gradeLabel: string,
  academicYear = 2026,
): Promise<TimetableGrid> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("timetable_slots")
    .select(`
      id, allocation_id, grade, day_of_week, period, academic_year,
      teacher_subject_allocations (
        teacher_id,
        class_id,
        teachers ( id, full_name ),
        subjects ( name, code ),
        classes ( id, grade, stream, level, academic_year )
      )
    `)
    .eq("grade", gradeLabel)
    .eq("academic_year", academicYear);

  if (error) {
    console.error("fetchTimetableForGrade:", error);
    return {};
  }

  const grid: TimetableGrid = {};
  const slots = data as unknown as RawTimetableSlot[];

  for (const rawSlot of slots ?? []) {
    let alloc = rawSlot.teacher_subject_allocations;
    if (Array.isArray(alloc)) alloc = alloc[0];
    if (!alloc) continue;

    const teacher = Array.isArray(alloc.teachers) ? alloc.teachers[0] : alloc.teachers;
    const subject = Array.isArray(alloc.subjects) ? alloc.subjects[0] : alloc.subjects;
    const classData = Array.isArray(alloc.classes) ? alloc.classes[0] : alloc.classes;

    if (teacher && subject) {
      const key = `${rawSlot.day_of_week}-${rawSlot.period}`;
      grid[key] = {
        slotId: rawSlot.id,
        teacherName: teacher.full_name,
        subjectName: subject.name,
        subjectCode: subject.code,
        allocationId: rawSlot.allocation_id,
        teacherId: teacher.id ?? alloc.teacher_id,
        className: classData ? `${classData.grade} ${classData.stream}` : rawSlot.grade,
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

  if (error || !data) return [];
  return [...new Set(data.map((r) => r.grade as string))].sort();
}

export interface GradeAllocation {
  allocationId: string;
  subjectName: string;
  subjectCode: string;
  teacherName: string;
  teacherId: string;
}

export async function fetchGradeAllocations(
  gradeLabel: string,
  academicYear = 2026,
): Promise<GradeAllocation[]> {
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from("teacher_subject_allocations")
    .select(`
      id, teacher_id, subject_id, class_id, academic_year, created_at,
      teachers ( id, full_name ),
      subjects ( name, code ),
      classes ( id, grade, stream, level, academic_year )
    `)
    .eq("academic_year", academicYear);

  if (error) {
    console.error("fetchGradeAllocations:", error);
    return [];
  }

  const rawRows = data as unknown as RawAllocationRow[];

  return (rawRows ?? [])
    .map(mapAllocationRow)
    .filter((row) => {
        const rowLabel = row.classes?.stream === "Main" 
            ? row.classes.grade 
            : `${row.classes?.grade}-${row.classes?.stream}`;
        return rowLabel === gradeLabel;
    })
    .map((row): GradeAllocation => ({
        allocationId: row.id,
        subjectName: row.subjects?.name ?? "Unknown",
        subjectCode: row.subjects?.code ?? "?",
        teacherName: row.teachers?.full_name ?? "Unknown",
        teacherId: row.teachers?.id ?? "",
    }));
}