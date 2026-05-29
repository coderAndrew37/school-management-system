// lib/data/teachers.ts
// Kibali Academy — Teacher Data Fetchers
//
// KEY ARCHITECTURAL NOTE — PostgREST back-reference joins
// ──────────────────────────────────────────────────────────────────────────────
// The FK `profiles_teacher_id_fkey` is defined ON the `profiles` table:
//   profiles.teacher_id → teachers.id
//
// This means when querying FROM `teachers`, the `profiles` join is a
// REVERSE / BACK-REFERENCE (one teacher → many profiles rows).
// PostgREST therefore always returns an ARRAY for this side of the join.
//
// Correct FK-hint syntax for an explicit constraint name in PostgREST is:
//   profiles!profiles_teacher_id_fkey ( ... )
//                 ↑ bang (!) not colon (:)
//
// The colon syntax  profiles:profiles_teacher_id_fkey(...)  is the
// *output-key aliasing* syntax — it does NOT disambiguate which FK to use,
// which caused PostgREST to either skip the join or use the wrong path,
// resulting in every teacher resolving to "Unknown Teacher".
// ──────────────────────────────────────────────────────────────────────────────

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

/**
 * Shape of a single profiles row as returned by the back-reference join.
 * PostgREST always yields an array for reverse FK relationships, so the
 * parent type wraps this in RawProfileJoin[].
 */
interface RawProfileJoin {
  full_name: string;
  email: string | null;
  phone_number: string | null;
  avatar_url: string | null;
}

/**
 * Raw row returned by Supabase when selecting from `teachers` with the
 * `profiles!profiles_teacher_id_fkey` back-reference join.
 *
 * `profiles` is typed as an array because PostgREST models the back-reference
 * as one-to-many (one teacher can theoretically have multiple profile rows),
 * even though in practice exactly one profile exists per teacher.
 *
 * We intentionally keep it as RawProfileJoin[] | null rather than
 * RawProfileJoin | null to match what PostgREST actually sends over the wire.
 * The mapTeacherRow helper safely plucks index [0].
 */
interface RawTeacherRow {
  id: string;
  staff_id: string | null;
  tsc_number: string | null;
  status: string;
  last_invite_sent: string | null;
  invite_accepted: boolean;
  created_at: string;
  /**
   * PostgREST returns the aliased key exactly as written in the SELECT string.
   * Because we write `profiles!profiles_teacher_id_fkey(...)` the returned
   * JSON key is `profiles`.  It is always an array for a back-reference join.
   */
  profiles: RawProfileJoin[] | null;
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
// SELECT FRAGMENT
// ============================================================================

/**
 * `!profiles_teacher_id_fkey` tells PostgREST exactly which FK constraint to
 * traverse when joining profiles from the teachers table.
 *
 * Do NOT use the colon syntax (`profiles:profiles_teacher_id_fkey`) here —
 * that is purely an output key alias and does not influence FK resolution.
 */
const TEACHER_SELECT = `
  id,
  staff_id,
  tsc_number,
  status,
  last_invite_sent,
  invite_accepted,
  created_at,
  profiles!profiles_teacher_id_fkey ( full_name, email, phone_number, avatar_url )
` as const;

// ============================================================================
// HELPERS
// ============================================================================

async function resolveSchoolId(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>
): Promise<string | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const jwtSchoolId = user.app_metadata?.school_id as string | undefined;
  if (jwtSchoolId) return jwtSchoolId;

  const { data: profile } = await supabase
    .from("profiles")
    .select("school_id")
    .eq("id", user.id)
    .single();

  return profile?.school_id ?? null;
}

/**
 * Maps a raw Supabase teacher row (including the back-reference profiles join)
 * to the clean Teacher domain type.
 *
 * Because the join is a back-reference, `profiles` is always RawProfileJoin[]
 * on the wire. We take index [0] — the one canonical profile per teacher.
 */
function mapTeacherRow(row: RawTeacherRow): Teacher {
  // Back-reference joins always arrive as arrays; take the first (and only) element.
  const profile = Array.isArray(row.profiles) ? row.profiles[0] ?? null : null;

  return {
    id: row.id,
    staff_id: row.staff_id ?? "—",
    full_name: profile?.full_name ?? "Unknown Teacher",
    tsc_number: row.tsc_number ?? null,
    email: profile?.email ?? "",
    phone_number: profile?.phone_number ?? null,
    status: row.status as Teacher["status"],
    last_invite_sent: row.last_invite_sent ?? null,
    created_at: row.created_at,
    invite_accepted: row.invite_accepted,
    avatar_url: profile?.avatar_url ?? null,
  };
}

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

  return (data as unknown as RawTeacherRow[])
    .map(mapTeacherRow)
    .sort((a, b) => a.full_name.localeCompare(b.full_name));
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

  return (data as unknown as RawTeacherRow[])
    .map(mapTeacherRow)
    .sort((a, b) => a.full_name.localeCompare(b.full_name));
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
    return {
      totalClasses: 0,
      totalStudents: 0,
      yearsAtKibali: 0,
      assessedStrands: 0,
    };
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
    relievedAt: r.relieved_at ?? null,
  }));
}