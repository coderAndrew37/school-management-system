"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { supabaseAdmin } from "../supabase/admin";
import { ActionResult } from "@/lib/types/dashboard";

// ── Types ─────────────────────────────────────────────────────────────────────

interface AdminContext {
  adminId:  string;
  schoolId: string;
}

interface MyAssignmentRow {
  academic_year: number;
  classes: { grade: string; stream: string } | null;
}

// ── Validation ────────────────────────────────────────────────────────────────

const assignSchema = z.object({
  classId:      z.string().uuid(),
  teacherId:    z.string().uuid(),
  academicYear: z.number().int().default(2026),
});

// ── Guard ─────────────────────────────────────────────────────────────────────

/**
 * Verifies the caller is an admin using base_role and returns both their user ID and school ID.
 * school_id is required so every mutation can be correctly scoped to the tenant.
 */
async function ensureAdmin(): Promise<AdminContext> {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) throw new Error("Unauthorized");

  // 1. Fetch base_role along with your explicit super_admin and dev flags
  const { data: profile } = await supabase
    .from("profiles")
    .select("base_role, is_super_admin, is_dev, school_id")
    .eq("id", user.id)
    .single();

  if (!profile) throw new Error("Forbidden: Profile not found");

  // 2. Check if the user is a global platform admin
  const isPlatformAdmin = profile.is_super_admin || profile.is_dev;
  const isLocalAdmin = ["admin", "superadmin"].includes(profile.base_role);

  if (!isLocalAdmin && !isPlatformAdmin) {
    throw new Error("Forbidden: Admin access required");
  }

  // 3. Super admins/devs might not be bound to a single school. 
  // Only throw if a local admin lacks a school context, or adapt if your actions require it.
  if (!isPlatformAdmin && !profile.school_id) {
    throw new Error("Admin profile has no school assigned");
  }

  // Fallback school_id for super admins if your table mutations require a UUID
  return { 
    adminId: user.id, 
    schoolId: profile.school_id ?? "" 
  };
}
// ── Assign / Swap a Class Teacher ─────────────────────────────────────────────

/**
 * Assigns a teacher to a class for the given academic year.
 * If another teacher is currently active on this class, they are relieved first.
 * All queries are scoped to the admin's school_id to enforce tenant isolation.
 */
export async function assignClassTeacherAction(
  data: z.infer<typeof assignSchema>,
): Promise<ActionResult> {
  try {
    const { adminId, schoolId } = await ensureAdmin();
    const parsed = assignSchema.parse(data);

    // 1. Find the current active assignment for this class — scoped to this school
    const { data: currentActive } = await supabaseAdmin
      .from("class_teacher_assignments")
      .select("id, teacher_id")
      .eq("class_id",   parsed.classId)
      .eq("school_id",  schoolId)
      .eq("is_active",  true)
      .maybeSingle();

    // 2. No-op: same teacher already assigned
    if (currentActive?.teacher_id === parsed.teacherId) {
      return { success: true, message: "Teacher is already assigned to this class" };
    }

    // 3. Relieve the current teacher if one exists
    if (currentActive) {
      const { error: relieveError } = await supabaseAdmin
        .from("class_teacher_assignments")
        .update({ is_active: false, relieved_at: new Date().toISOString() })
        .eq("id",        currentActive.id)
        .eq("school_id", schoolId); // extra tenant scope on mutation

      if (relieveError) throw relieveError;
    }

    // 4. Insert the new assignment — school_id is required (NOT NULL constraint)
    const { error: insertError } = await supabaseAdmin
      .from("class_teacher_assignments")
      .insert({
        class_id:      parsed.classId,
        teacher_id:    parsed.teacherId,
        academic_year: parsed.academicYear,
        assigned_by:   adminId,
        school_id:     schoolId,
        is_active:     true,
      });

    if (insertError) throw insertError;

    revalidatePath("/admin/class-teachers");
    revalidatePath("/admin/teachers");

    return { success: true, message: "Class teacher assigned successfully" };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to assign teacher";
    console.error("[assignClassTeacherAction]", msg);
    return { success: false, message: msg };
  }
}

// ── Relieve a Class Teacher ───────────────────────────────────────────────────

/**
 * Soft-deletes an assignment by setting is_active = false.
 * Scoped to the admin's school_id so cross-tenant relief is impossible.
 */
export async function relieveClassTeacherAction(
  assignmentId: string,
): Promise<ActionResult> {
  try {
    const { schoolId } = await ensureAdmin();

    const { error } = await supabaseAdmin
      .from("class_teacher_assignments")
      .update({ is_active: false, relieved_at: new Date().toISOString() })
      .eq("id",        assignmentId)
      .eq("school_id", schoolId); // prevents cross-tenant mutation

    if (error) throw error;

    revalidatePath("/admin/class-teachers");
    revalidatePath("/admin/teachers");

    return { success: true, message: "Teacher relieved of duties" };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to relieve teacher";
    console.error("[relieveClassTeacherAction]", msg);
    return { success: false, message: msg };
  }
}

// ── Fetch Current Teacher's Own Assignments ───────────────────────────────────

/**
 * Returns active class assignments for the currently logged-in teacher.
 * Used in the teacher portal — queries are row-level-security scoped.
 */
export async function fetchMyClassTeacherAssignments() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("class_teacher_assignments")
    .select(`
      academic_year,
      classes ( grade, stream )
    `)
    .eq("teacher_id",    user.id)
    .eq("is_active",     true)
    .eq("academic_year", 2026)
    .returns<MyAssignmentRow[]>();

  if (error) {
    console.error("[fetchMyClassTeacherAssignments]", error.message);
    return { isClassTeacher: false, classes: [] as { grade: string; stream: string }[] };
  }

  const classes = (data ?? []).map((r) => ({
    grade:  r.classes?.grade  ?? "Unknown",
    stream: r.classes?.stream ?? "Unknown",
  }));

  return {
    isClassTeacher: classes.length > 0,
    classes,
    academicYear: data?.[0]?.academic_year ?? 2026,
  };
}

// ── Legacy shim ───────────────────────────────────────────────────────────────

export async function fetchMyClassTeacherAssignment() {
  const result = await fetchMyClassTeacherAssignments();
  if (!result) return null;
  return {
    isClassTeacher: result.isClassTeacher,
    grade:          result.classes[0]?.grade  ?? null,
    stream:         result.classes[0]?.stream ?? null,
    academicYear:   result.academicYear,
  };
}