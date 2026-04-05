import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  AllocationRow,
  Teacher,
  TeacherStats,
  ClassTeacherGrade,
} from "@/lib/types/dashboard";

// ── Fetch All Teachers (For the main table) ──────────────────────────────────
/**
 * Fetches all teachers for the administrative list view.
 */
export async function fetchTeachers(): Promise<Teacher[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("teachers")
    .select(
      `
      id, 
      staff_id, 
      full_name, 
      tsc_number, 
      email, 
      phone_number, 
      status, 
      last_invite_sent, 
      created_at, 
      avatar_url,
      invite_accepted
    `,
    )
    .order("full_name", { ascending: true });

  if (error) {
    console.error("[fetchTeachers] Error:", error.message);
    return [];
  }
  return (data ?? []) as Teacher[];
}

// ── Fetch Single Teacher by Staff ID (For the Profile Page) ──────────────────
/**
 * Fetches a single teacher using the public Staff ID (KIB-T-XXX).
 */
export async function fetchTeacherByStaffId(
  staffId: string,
): Promise<Teacher | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("teachers")
    .select("*")
    .eq("staff_id", staffId)
    .maybeSingle();

  if (error) {
    console.error("[fetchTeacherByStaffId] Error:", error.message);
    return null;
  }
  return data as Teacher;
}

// ── Fetch Teacher Statistics (Governance Metrics) ─────────────────────────────
/**
 * Aggregates stats for the teacher profile header.
 */
export async function fetchTeacherStats(
  teacherId: string,
  academicYear: number,
): Promise<TeacherStats> {
  const supabase = await createSupabaseServerClient();

  const [allocRes, assessRes, teacherRes] = await Promise.all([
    supabase
      .from("teacher_subject_allocations")
      .select("grade")
      .eq("teacher_id", teacherId)
      .eq("academic_year", academicYear),
    supabase
      .from("assessments")
      .select("id", { count: "exact", head: true })
      .eq("teacher_id", teacherId)
      .eq("academic_year", academicYear),
    supabase
      .from("teachers")
      .select("created_at")
      .eq("id", teacherId)
      .maybeSingle(),
  ]);

  const allocs = allocRes.data ?? [];
  const grades = [...new Set(allocs.map((a) => a.grade))];

  const yearsAtKibali = teacherRes.data
    ? Math.floor(
        (Date.now() - new Date(teacherRes.data.created_at).getTime()) /
          (1000 * 60 * 60 * 24 * 365),
      )
    : 0;

  let totalStudents = 0;
  if (grades.length > 0) {
    const { count } = await supabase
      .from("students")
      .select("id", { count: "exact", head: true })
      .in("current_grade", grades)
      .eq("status", "active");
    totalStudents = count ?? 0;
  }

  return {
    totalClasses: grades.length,
    totalStudents,
    yearsAtKibali: Math.max(0, yearsAtKibali),
    assessedStrands: assessRes.count ?? 0,
  };
}

// ── Fetch Subject Allocations (For Profile Tabs/Drawers) ──────────────────────
/**
 * Fetches all subjects assigned to a specific teacher for an academic year.
 */
export async function fetchTeacherAllocations(
  teacherId: string,
  academicYear: number,
): Promise<AllocationRow[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("teacher_subject_allocations")
    .select("id, grade, subjects ( name, code )")
    .eq("teacher_id", teacherId)
    .eq("academic_year", academicYear)
    .order("grade");

  if (error) {
    console.error("[fetchTeacherAllocations] Error:", error.message);
    return [];
  }

  return (data ?? []).map((r: any) => {
    // Handle cases where subjects might be an array or object depending on join
    const subject = Array.isArray(r.subjects) ? r.subjects[0] : r.subjects;
    return {
      id: r.id,
      subjectName: subject?.name ?? "—",
      subjectCode: subject?.code ?? "—",
      grade: r.grade,
    };
  });
}

// ── Fetch Class Teacher Assignments ──────────────────────────────────────────
/**
 * Fetches which grades this teacher is assigned to as a Class Teacher.
 */
export async function fetchClassTeacherGrades(
  teacherId: string,
  academicYear: number,
): Promise<ClassTeacherGrade[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("class_teacher_assignments")
    .select("grade, academic_year")
    .eq("teacher_id", teacherId)
    .eq("academic_year", academicYear)
    .order("grade");

  if (error) {
    console.error("[fetchClassTeacherGrades] Error:", error.message);
    return [];
  }

  return (data ?? []).map((r) => ({
    grade: r.grade,
    academicYear: r.academic_year,
  }));
}
