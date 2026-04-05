import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  AllocationRow,
  Teacher,
  TeacherStats,
  ClassTeacherAssignment,
} from "@/lib/types/dashboard";

// ── Fetch All Teachers ────────────────────────────────────────────────────────
export async function fetchTeachers(): Promise<Teacher[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("teachers")
    .select(
      `
      id, staff_id, full_name, tsc_number, email, 
      phone_number, status, last_invite_sent, 
      created_at, avatar_url, invite_accepted
    `,
    )
    .order("full_name", { ascending: true });

  if (error) {
    console.error("[fetchTeachers] Error:", error.message);
    return [];
  }
  return (data ?? []) as Teacher[];
}

// ── Fetch Single Teacher by Staff ID ──────────────────────────────────────────
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

// ── Fetch Teacher Statistics ──────────────────────────────────────────────────
export async function fetchTeacherStats(
  teacherId: string,
  academicYear: number,
): Promise<TeacherStats> {
  const supabase = await createSupabaseServerClient();

  const [allocRes, assessRes, teacherRes] = await Promise.all([
    // Join with classes to get class IDs
    supabase
      .from("teacher_subject_allocations")
      .select("class_id")
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

  const classIds = [...new Set((allocRes.data ?? []).map((a) => a.class_id))];

  const yearsAtKibali = teacherRes.data
    ? Math.floor(
        (Date.now() - new Date(teacherRes.data.created_at).getTime()) /
          (1000 * 60 * 60 * 24 * 365),
      )
    : 0;

  let totalStudents = 0;
  if (classIds.length > 0) {
    // Now querying students by class_id instead of grade string
    const { count } = await supabase
      .from("students")
      .select("id", { count: "exact", head: true })
      .in("class_id", classIds)
      .eq("status", "active");
    totalStudents = count ?? 0;
  }

  return {
    totalClasses: classIds.length,
    totalStudents,
    yearsAtKibali: Math.max(0, yearsAtKibali),
    assessedStrands: assessRes.count ?? 0,
  };
}

// ── Fetch Subject Allocations ─────────────────────────────────────────────────
export async function fetchTeacherAllocations(
  teacherId: string,
  academicYear: number,
): Promise<AllocationRow[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("teacher_subject_allocations")
    .select(
      `
      id,
      class_id,
      classes ( grade, stream ),
      subjects ( name, code )
    `,
    )
    .eq("teacher_id", teacherId)
    .eq("academic_year", academicYear);

  if (error) {
    console.error("[fetchTeacherAllocations] Error:", error.message);
    return [];
  }

  return (data ?? []).map((r: any) => {
    const subject = Array.isArray(r.subjects) ? r.subjects[0] : r.subjects;
    const cls = Array.isArray(r.classes) ? r.classes[0] : r.classes;

    return {
      id: r.id,
      subjectName: subject?.name ?? "—",
      subjectCode: subject?.code ?? "—",
      class_id: r.class_id,
      grade: cls?.grade ?? "—",
      stream: cls?.stream ?? "—",
    };
  });
}

// ── Fetch Class Teacher Assignments ───────────────────────────────────────────
export async function fetchClassTeacherAssignments(
  teacherId: string,
  academicYear: number,
): Promise<ClassTeacherAssignment[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("class_teacher_assignments")
    .select(
      `
      id,
      class_id,
      is_active,
      assigned_at,
      relieved_at,
      academic_year,
      classes ( grade, stream )
    `,
    )
    .eq("teacher_id", teacherId)
    .eq("academic_year", academicYear)
    .order("is_active", { ascending: false });

  if (error) {
    console.error("[fetchClassTeacherAssignments] Error:", error.message);
    return [];
  }

  return (data ?? []).map((r: any) => {
    const cls = Array.isArray(r.classes) ? r.classes[0] : r.classes;
    return {
      id: r.id,
      class_id: r.class_id,
      grade: cls?.grade ?? "—",
      stream: cls?.stream ?? "—",
      academicYear: r.academic_year,
      isActive: r.is_active,
      assignedAt: r.assigned_at,
      relievedAt: r.relieved_at,
    };
  });
}
