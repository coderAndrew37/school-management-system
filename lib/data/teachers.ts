// lib/data/teachers.ts
// Kibali Academy — Teacher Data Fetchers
//
// All queries are school_id scoped via Supabase RLS + explicit .eq() filters.
// Zero usage of `any` — every join shape is explicitly typed.
// Core identity attributes are resolved directly from the normalized profiles relation.

import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  AllocationRow,
  ClassTeacherAssignment,
  Teacher,
  TeacherStats,
} from "@/lib/types/dashboard";

// ============================================================================
// INTERNAL JOIN TYPES
// ============================================================================

interface RawProfileJoin {
  full_name: string;
  email: string | null;
  phone_number: string | null;
  avatar_url: string | null;
}

interface RawTeacherRow {
  id: string;
  staff_id: string | null;
  tsc_number: string | null;
  status: string;
  last_invite_sent: string | null;
  invite_accepted: boolean;
  created_at: string;
  profiles: RawProfileJoin[] | RawProfileJoin | null;
}

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

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Resolves the calling user's school_id from their profile.
 * Returns null if unauthenticated or profile missing.
 */
async function resolveSchoolId(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>
): Promise<string | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  // Prefer JWT app_metadata (zero DB call path) — written by sync_user_jwt_claims trigger
  const jwtSchoolId = user.app_metadata?.school_id as string | undefined;
  if (jwtSchoolId) return jwtSchoolId;

  // Fallback: read from profiles
  const { data: profile } = await supabase
    .from("profiles")
    .select("school_id")
    .eq("id", user.id)
    .single();

  return profile?.school_id ?? null;
}

function mapTeacherRow(row: RawTeacherRow): Teacher {
  // Handle both array or single object returns gracefully based on cache state
  const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;

  return {
    id: row.id,
    staff_id: row.staff_id ?? "—",
    full_name: profile?.full_name ?? "Unknown Teacher",
    tsc_number: row.tsc_number,
    email: profile?.email ?? "",
    phone_number: profile?.phone_number ?? null,
    status: (row.status as Teacher["status"]) ?? "active",
    last_invite_sent: row.last_invite_sent,
    created_at: row.created_at,
    invite_accepted: row.invite_accepted,
    avatar_url: profile?.avatar_url ?? null,
  };
}

// Explicitly pointing to the verified foreign key constraint that targets 'teachers' from 'profiles'
const TEACHER_SELECT = `
  id, staff_id, tsc_number, status, last_invite_sent, invite_accepted, created_at,
  profiles:profiles_teacher_id_fkey ( full_name, email, phone_number, avatar_url )
` as const;

// ============================================================================
// TEACHER FETCHERS
// ============================================================================

export async function fetchTeachers(): Promise<Teacher[]> {
  const supabase = await createSupabaseServerClient();
  const schoolId = await resolveSchoolId(supabase);
  if (!schoolId) return [];

  const { data, error } = await supabase
    .from("teachers")
    .select(TEACHER_SELECT)
    .eq("school_id", schoolId);

  if (error) {
    console.error("[fetchTeachers] Error:", error.message);
    return [];
  }

  const mapped = (data as unknown as RawTeacherRow[]).map(mapTeacherRow);

  // Keep rendering order strictly alphabetical by teacher's real name
  return mapped.sort((a, b) => a.full_name.localeCompare(b.full_name));
}

export async function fetchTeachersByStatus(
  status: "active" | "on_leave" | "all"
): Promise<Teacher[]> {
  const supabase = await createSupabaseServerClient();
  const schoolId = await resolveSchoolId(supabase);
  if (!schoolId) return [];

  let query = supabase
    .from("teachers")
    .select(TEACHER_SELECT)
    .eq("school_id", schoolId);

  if (status !== "all") {
    query = query.eq("status", status);
  }

  const { data, error } = await query;

  if (error) {
    console.error("[fetchTeachersByStatus] Error:", error.message);
    return [];
  }

  const mapped = (data as unknown as RawTeacherRow[]).map(mapTeacherRow);
  return mapped.sort((a, b) => a.full_name.localeCompare(b.full_name));
}

export async function fetchTeacherByStaffId(
  staffId: string
): Promise<Teacher | null> {
  const supabase = await createSupabaseServerClient();
  const schoolId = await resolveSchoolId(supabase);
  if (!schoolId) return null;

  const { data, error } = await supabase
    .from("teachers")
    .select(TEACHER_SELECT)
    .eq("staff_id", staffId)
    .eq("school_id", schoolId)
    .maybeSingle();

  if (error) {
    console.error("[fetchTeacherByStaffId] Error:", error.message);
    return null;
  }

  if (!data) return null;
  return mapTeacherRow(data as unknown as RawTeacherRow);
}

export async function fetchTeacherById(
  teacherId: string
): Promise<Teacher | null> {
  const supabase = await createSupabaseServerClient();
  const schoolId = await resolveSchoolId(supabase);
  if (!schoolId) return null;

  const { data, error } = await supabase
    .from("teachers")
    .select(TEACHER_SELECT)
    .eq("id", teacherId)
    .eq("school_id", schoolId)
    .maybeSingle();

  if (error) {
    console.error("[fetchTeacherById] Error:", error.message);
    return null;
  }

  if (!data) return null;
  return mapTeacherRow(data as unknown as RawTeacherRow);
}

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

// ============================================================================
// TEACHER STATISTICS & ALLOCATIONS
// ============================================================================

export async function fetchTeacherStats(
  teacherId: string,
  academicYear: number
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
          (1000 * 60 * 60 * 24 * 365)
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

export async function fetchTeacherAllocations(
  teacherId: string,
  academicYear: number
): Promise<AllocationRow[]> {
  const supabase = await createSupabaseServerClient();
  const schoolId = await resolveSchoolId(supabase);
  if (!schoolId) return [];

  const { data, error } = await supabase
    .from("teacher_subject_allocations")
    .select(
      `id, class_id,
       classes ( grade, stream ),
       subjects ( name, code )`
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

export async function fetchClassTeacherAssignments(
  teacherId: string,
  academicYear: number
): Promise<ClassTeacherAssignment[]> {
  const supabase = await createSupabaseServerClient();
  const schoolId = await resolveSchoolId(supabase);
  if (!schoolId) return [];

  const { data, error } = await supabase
    .from("class_teacher_assignments")
    .select(
      `id, class_id, is_active, assigned_at, relieved_at, academic_year,
       classes ( grade, stream )`
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