import { createSupabaseServerClient } from "@/lib/supabase/server";
import type {
  Subject,
  TeacherSubjectAllocation,
  TimetableGrid,
  Class,
} from "@/lib/types/allocation";

// ── 1. Strict Internal Types for Database Joins ───────────────────────────────

interface ProfileJoin {
  full_name: string;
}

interface TeacherJoin {
  id: string;
  staff_id: string | null;
  tsc_number: string | null;
  profiles: ProfileJoin | ProfileJoin[] | null;
}

interface SubjectJoin {
  id: string;
  name: string;
  code: string;
  level: "lower_primary" | "upper_primary" | "junior_secondary";
  weekly_lessons: number;
}

interface RawAllocationRow {
  id: string;
  teacher_id: string;
  subject_id: string;
  class_id: string;
  academic_year: number;
  is_active: boolean;
  created_at: string;
  teachers: TeacherJoin | TeacherJoin[] | null;
  subjects: SubjectJoin | SubjectJoin[] | null;
  classes: Class | Class[] | null;
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
    teachers: TeacherJoin | TeacherJoin[] | null;
    subjects: Omit<SubjectJoin, "id" | "level" | "weekly_lessons"> | Omit<SubjectJoin, "id" | "level" | "weekly_lessons">[] | null;
    classes: Class | Class[] | null;
  } | {
    teacher_id: string;
    class_id: string;
    teachers: TeacherJoin | TeacherJoin[] | null;
    subjects: Omit<SubjectJoin, "id" | "level" | "weekly_lessons"> | Omit<SubjectJoin, "id" | "level" | "weekly_lessons">[] | null;
    classes: Class | Class[] | null;
  }[] | null;
}

// ── 2. Type-Safe Mappers ──────────────────────────────────────────────────────

function extractSingle<T>(field: T | T[] | null | undefined): T | null {
  if (!field) return null;
  return Array.isArray(field) ? field[0] ?? null : field;
}

function mapAllocationRow(row: RawAllocationRow): TeacherSubjectAllocation {
  const rawTeacher = extractSingle(row.teachers);
  const rawSubject = extractSingle(row.subjects);
  const rawClass = extractSingle(row.classes);
  const rawProfile = rawTeacher ? extractSingle(rawTeacher.profiles) : null;

  return {
    id: row.id,
    school_id: rawClass?.school_id ?? "",
    teacher_id: row.teacher_id,
    subject_id: row.subject_id,
    class_id: row.class_id,
    academic_year: row.academic_year,
    is_active: row.is_active,
    created_at: row.created_at,
    teachers: rawTeacher ? {
      id: rawTeacher.id,
      staff_id: rawTeacher.staff_id,
      tsc_number: rawTeacher.tsc_number,
      profiles: rawProfile ? { full_name: rawProfile.full_name } : null
    } : null,
    subjects: rawSubject ? { ...rawSubject } : null,
    classes: rawClass ? { ...rawClass } : null,
  };
}

// ── 3. Fetch Functions ────────────────────────────────────────────────────────

// Explicitly multi-tenant scoped to ensure systems do not leak globally
export async function fetchSubjects(): Promise<Subject[]> {
  const supabase = await createSupabaseServerClient();
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
  schoolId: string,
  academicYear = 2026,
): Promise<TeacherSubjectAllocation[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("teacher_subject_allocations")
    .select(`
      id, teacher_id, subject_id, class_id, academic_year, is_active, created_at,
      teachers ( id, staff_id, tsc_number, profiles ( full_name ) ),
      subjects ( id, name, code, level, weekly_lessons ),
      classes ( id, school_id, grade, stream, level, academic_year )
    `)
    .eq("school_id", schoolId) // Multi-tenant compliance filter hook
    .eq("academic_year", academicYear)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("fetchAllocations:", error);
    return [];
  }
  return (data as unknown as RawAllocationRow[] ?? []).map(mapAllocationRow);
}

export async function fetchAllocationsByTeacher(
  schoolId: string,
  teacherId: string,
  academicYear = 2026,
): Promise<TeacherSubjectAllocation[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("teacher_subject_allocations")
    .select(`
      id, teacher_id, subject_id, class_id, academic_year, is_active, created_at,
      teachers ( id, staff_id, tsc_number, profiles ( full_name ) ),
      subjects ( id, name, code, level, weekly_lessons ),
      classes ( id, school_id, grade, stream, level, academic_year )
    `)
    .eq("school_id", schoolId)
    .eq("teacher_id", teacherId)
    .eq("academic_year", academicYear);

  if (error) {
    console.error("fetchAllocationsByTeacher:", error);
    return [];
  }
  return (data as unknown as RawAllocationRow[] ?? []).map(mapAllocationRow);
}

export async function fetchTimetableForGrade(
  schoolId: string,
  gradeLabel: string,
  academicYear = 2026,
): Promise<TimetableGrid> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("timetable_slots")
    .select(`
      id, allocation_id, grade, day_of_week, period, academic_year,
      teacher_subject_allocations (
        teacher_id,
        class_id,
        teachers ( id, staff_id, tsc_number, profiles ( full_name ) ),
        subjects ( name, code ),
        classes ( id, school_id, grade, stream, level, academic_year )
      )
    `)
    .eq("school_id", schoolId)
    .eq("grade", gradeLabel)
    .eq("academic_year", academicYear);

  if (error) {
    console.error("fetchTimetableForGrade:", error);
    return {};
  }

  const grid: TimetableGrid = {};
  const slots = data as unknown as RawTimetableSlot[];

  for (const rawSlot of slots ?? []) {
    const alloc = extractSingle(rawSlot.teacher_subject_allocations);
    if (!alloc) continue;

    const teacher = extractSingle(alloc.teachers);
    const subject = extractSingle(alloc.subjects);
    const classData = extractSingle(alloc.classes);
    const profile = teacher ? extractSingle(teacher.profiles) : null;

    if (teacher && profile && subject) {
      const key = `${rawSlot.day_of_week}-${rawSlot.period}`;
      grid[key] = {
        slotId: rawSlot.id,
        teacherName: profile.full_name,
        subjectName: subject.name,
        subjectCode: subject.code,
        allocationId: rawSlot.allocation_id,
        teacherId: teacher.id,
        className: classData ? `${classData.grade} ${classData.stream}` : rawSlot.grade,
      };
    }
  }
  return grid;
}

export async function fetchAllGradesWithTimetable(
  schoolId: string,
  academicYear = 2026,
): Promise<string[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("timetable_slots")
    .select("grade")
    .eq("school_id", schoolId)
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
  schoolId: string,
  gradeLabel: string,
  academicYear = 2026,
): Promise<GradeAllocation[]> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("teacher_subject_allocations")
    .select(`
      id, teacher_id, subject_id, class_id, academic_year, is_active, created_at,
      teachers ( id, staff_id, tsc_number, profiles ( full_name ) ),
      subjects ( id, name, code, level, weekly_lessons ),
      classes ( id, school_id, grade, stream, level, academic_year )
    `)
    .eq("school_id", schoolId)
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
    .map((row): GradeAllocation => {
      const profile = row.teachers?.profiles;
      return {
        allocationId: row.id,
        subjectName: row.subjects?.name ?? "Unknown",
        subjectCode: row.subjects?.code ?? "?",
        teacherName: profile?.full_name ?? "Unknown",
        teacherId: row.teachers?.id ?? "",
      };
    });
}