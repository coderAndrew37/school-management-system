// lib/data/teachers.ts
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  AllocationRow,
  ClassTeacherAssignment,
  Teacher,
  TeacherStats,
} from "@/lib/types/dashboard";

// ── 1. Raw DB row shapes ──────────────────────────────────────────────────────

interface RawAllocationRow {
  id: string;
  class_id: string;
  classes: { grade: string; stream: string } | null;
  subjects: { name: string; code: string } | null;
}

interface RawAssignmentRow {
  id: string;
  class_id: string;
  is_active: boolean;
  assigned_at: string;
  relieved_at: string | null;
  academic_year: number;
  classes: { grade: string; stream: string } | null;
}

// ── 2. Resolve school_id from JWT (fast) or profile row (fallback) ────────────

async function resolveSchoolId(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
): Promise<string | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  // Fast path — JWT app_metadata (written by sync_user_jwt_claims trigger)
  const jwtSchoolId = user.app_metadata?.school_id as string | undefined;
  if (jwtSchoolId) return jwtSchoolId;

  // Fallback — live DB read
  const { data: profile } = await supabase
    .from("profiles")
    .select("school_id")
    .eq("id", user.id)
    .single();

  return profile?.school_id ?? null;
}

// ── 3. Fetch All Teachers ─────────────────────────────────────────────────────

export async function fetchTeachers(): Promise<Teacher[]> {
  const supabase = await createSupabaseServerClient();
  const schoolId = await resolveSchoolId(supabase);
  if (!schoolId) return [];

  const { data, error } = await supabase
    .from("teachers")
    .select(
      `id, staff_id, full_name, tsc_number, email,
       phone_number, status, last_invite_sent,
       created_at, avatar_url, invite_accepted`,
    )
    .eq("school_id", schoolId)
    .order("full_name", { ascending: true });

  if (error) {
    console.error("[fetchTeachers] Error:", error.message);
    return [];
  }

  return (data ?? []) as unknown as Teacher[];
}

// ── 4. Fetch Teachers by Status ───────────────────────────────────────────────

export async function fetchTeachersByStatus(
  status: "active" | "on_leave" | "all",
): Promise<Teacher[]> {
  const supabase = await createSupabaseServerClient();
  const schoolId = await resolveSchoolId(supabase);
  if (!schoolId) return [];

  let query = supabase
    .from("teachers")
    .select(
      `id, staff_id, full_name, tsc_number, email,
       phone_number, status, last_invite_sent,
       created_at, avatar_url, invite_accepted`,
    )
    .eq("school_id", schoolId)
    .order("full_name", { ascending: true });

  if (status !== "all") {
    query = query.eq("status", status);
  }

  const { data, error } = await query;

  if (error) {
    console.error("[fetchTeachersByStatus] Error:", error.message);
    return [];
  }

  return (data ?? []) as unknown as Teacher[];
}

// ── 5. Fetch Single Teacher by Staff ID ───────────────────────────────────────

export async function fetchTeacherByStaffId(
  staffId: string,
): Promise<Teacher | null> {
  const supabase = await createSupabaseServerClient();
  const schoolId = await resolveSchoolId(supabase);
  if (!schoolId) return null;

  const { data, error } = await supabase
    .from("teachers")
    .select("*")
    .eq("staff_id", staffId)
    .eq("school_id", schoolId)
    .maybeSingle();

  if (error) {
    console.error("[fetchTeacherByStaffId] Error:", error.message);
    return null;
  }

  return data as unknown as Teacher | null;
}

// ── 6. Fetch Single Teacher by UUID ──────────────────────────────────────────

export async function fetchTeacherById(
  teacherId: string,
): Promise<Teacher | null> {
  const supabase = await createSupabaseServerClient();
  const schoolId = await resolveSchoolId(supabase);
  if (!schoolId) return null;

  const { data, error } = await supabase
    .from("teachers")
    .select("*")
    .eq("id", teacherId)
    .eq("school_id", schoolId)
    .maybeSingle();

  if (error) {
    console.error("[fetchTeacherById] Error:", error.message);
    return null;
  }

  return data as unknown as Teacher | null;
}

// ── 7. Count Active Teachers ──────────────────────────────────────────────────

export async function countActiveTeachers(): Promise<number> {
  const supabase = await createSupabaseServerClient();
  const schoolId = await resolveSchoolId(supabase);
  if (!schoolId) return 0;

  const { count, error } = await supabase
    .from("teachers")
    .select("id", { count: "exact", head: true })
    .eq("school_id", schoolId)
    .eq("status", "active");

  if (error) {
    console.error("[countActiveTeachers] Error:", error.message);
    return 0;
  }

  return count ?? 0;
}

// ── 8. Fetch Teacher Statistics ───────────────────────────────────────────────

export async function fetchTeacherStats(
  teacherId: string,
  academicYear: number,
): Promise<TeacherStats> {
  const supabase = await createSupabaseServerClient();
  const schoolId = await resolveSchoolId(supabase);
  if (!schoolId) {
    return { totalClasses: 0, totalStudents: 0, yearsAtKibali: 0, assessedStrands: 0 };
  }

  const [allocRes, assessRes, teacherRes] = await Promise.all([
    supabase
      .from("teacher_subject_allocations")
      .select("class_id")
      .eq("teacher_id", teacherId)
      .eq("school_id", schoolId)
      .eq("academic_year", academicYear),
    supabase
      .from("assessments")
      .select("id", { count: "exact", head: true })
      .eq("teacher_id", teacherId)
      .eq("school_id", schoolId)
      .eq("academic_year", academicYear),
    supabase
      .from("teachers")
      .select("created_at")
      .eq("id", teacherId)
      .eq("school_id", schoolId)
      .maybeSingle(),
  ]);

  const classIds = [
    ...new Set((allocRes.data ?? []).map((a) => a.class_id as string)),
  ];

  const yearsAtKibali = teacherRes.data
    ? Math.floor(
        (Date.now() - new Date(teacherRes.data.created_at).getTime()) /
          (1000 * 60 * 60 * 24 * 365),
      )
    : 0;

  let totalStudents = 0;
  if (classIds.length > 0) {
    const { count } = await supabase
      .from("students")
      .select("id", { count: "exact", head: true })
      .in("class_id", classIds)
      .eq("school_id", schoolId)
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

// ── 9. Fetch Subject Allocations ──────────────────────────────────────────────

export async function fetchTeacherAllocations(
  teacherId: string,
  academicYear: number,
): Promise<AllocationRow[]> {
  const supabase = await createSupabaseServerClient();
  const schoolId = await resolveSchoolId(supabase);
  if (!schoolId) return [];

  const { data, error } = await supabase
    .from("teacher_subject_allocations")
    .select(
      `id, class_id,
       classes ( grade, stream ),
       subjects ( name, code )`,
    )
    .eq("teacher_id", teacherId)
    .eq("school_id", schoolId)
    .eq("academic_year", academicYear)
    .returns<RawAllocationRow[]>();

  if (error) {
    console.error("[fetchTeacherAllocations] Error:", error.message);
    return [];
  }

  return (data ?? []).map((r) => ({
    id: r.id,
    subjectName: r.subjects?.name ?? "—",
    subjectCode: r.subjects?.code ?? "—",
    class_id: r.class_id,
    grade: r.classes?.grade ?? "—",
    stream: r.classes?.stream ?? "—",
  }));
}

// ── 10. Fetch Class Teacher Assignments ───────────────────────────────────────

export async function fetchClassTeacherAssignments(
  teacherId: string,
  academicYear: number,
): Promise<ClassTeacherAssignment[]> {
  const supabase = await createSupabaseServerClient();
  const schoolId = await resolveSchoolId(supabase);
  if (!schoolId) return [];

  const { data, error } = await supabase
    .from("class_teacher_assignments")
    .select(
      `id, class_id, is_active, assigned_at, relieved_at, academic_year,
       classes ( grade, stream )`,
    )
    .eq("teacher_id", teacherId)
    .eq("school_id", schoolId)
    .eq("academic_year", academicYear)
    .order("is_active", { ascending: false })
    .returns<RawAssignmentRow[]>();

  if (error) {
    console.error("[fetchClassTeacherAssignments] Error:", error.message);
    return [];
  }

  return (data ?? []).map((r) => ({
    id: r.id,
    class_id: r.class_id,
    grade: r.classes?.grade ?? "—",
    stream: r.classes?.stream ?? "—",
    academicYear: r.academic_year,
    isActive: r.is_active,
    assignedAt: r.assigned_at,
    relievedAt: r.relieved_at,
  }));
}