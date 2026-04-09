"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { supabaseAdmin } from "../supabase/admin";
import { ActionResult } from "@/lib/types/dashboard";

// ── Types & Interfaces ────────────────────────────────────────────────────────

interface MyAssignmentRow {
  academic_year: number;
  classes: {
    grade: string;
    stream: string;
  } | null;
}

// ── Validation ────────────────────────────────────────────────────────────────

const assignSchema = z.object({
  classId: z.string().uuid(),
  teacherId: z.string().uuid(),
  academicYear: z.number().int().default(2026),
});

// ── Guard ─────────────────────────────────────────────────────────────────────

async function ensureAdmin(): Promise<string> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("Unauthorized");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || !["admin", "superadmin"].includes(profile.role)) {
    throw new Error("Forbidden: Admin access required.");
  }
  return user.id;
}

// ── Assign/Swap a Class Teacher ───────────────────────────────────────────────

/**
 * Handles assigning a teacher to a class.
 * If the class has an active teacher, they are automatically relieved first.
 */
export async function assignClassTeacherAction(
  data: z.infer<typeof assignSchema>,
): Promise<ActionResult> {
  try {
    const adminId = await ensureAdmin();
    const parsed = assignSchema.parse(data);

    // 1. Find the current active teacher for this class (if any)
    const { data: currentActive } = await supabaseAdmin
      .from("class_teacher_assignments")
      .select("id, teacher_id")
      .eq("class_id", parsed.classId)
      .eq("is_active", true)
      .maybeSingle();

    // 2. Optimization: If the same teacher is already assigned, just return success
    if (currentActive?.teacher_id === parsed.teacherId) {
      return {
        success: true,
        message: "Teacher is already assigned to this class.",
      };
    }

    // 3. Relieve the current teacher if one exists
    if (currentActive) {
      const { error: relieveError } = await supabaseAdmin
        .from("class_teacher_assignments")
        .update({
          is_active: false,
          relieved_at: new Date().toISOString(),
        })
        .eq("id", currentActive.id);

      if (relieveError) throw relieveError;
    }

    // 4. Insert the new assignment
    const { error: insertError } = await supabaseAdmin
      .from("class_teacher_assignments")
      .insert({
        class_id: parsed.classId,
        teacher_id: parsed.teacherId,
        academic_year: parsed.academicYear,
        assigned_by: adminId,
        is_active: true,
      });

    if (insertError) throw insertError;

    revalidatePath("/admin/teachers");
    revalidatePath("/admin/class-teachers");

    return {
      success: true,
      message: "Class teacher assigned successfully.",
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to assign teacher";
    console.error("[assignClassTeacherAction] Error:", msg);
    return {
      success: false,
      message: msg,
    };
  }
}

// ── Relieve a Class Teacher (Soft Delete) ─────────────────────────────────────

export async function relieveClassTeacherAction(
  assignmentId: string,
): Promise<ActionResult> {
  try {
    await ensureAdmin();

    const { error } = await supabaseAdmin
      .from("class_teacher_assignments")
      .update({
        is_active: false,
        relieved_at: new Date().toISOString(),
      })
      .eq("id", assignmentId);

    if (error) throw error;

    revalidatePath("/admin/teachers");
    revalidatePath("/admin/class-teachers");

    return { success: true, message: "Teacher relieved of duties." };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Process failed";
    console.error("[relieveClassTeacherAction] Error:", msg);
    return { success: false, message: "Failed to relieve teacher." };
  }
}

// ── Fetch Current User assignments (For Teacher Portal) ──────────────────────

/**
 * Returns active classes for the currently logged-in teacher.
 */
export async function fetchMyClassTeacherAssignments() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("class_teacher_assignments")
    .select(`
      academic_year,
      classes (
        grade,
        stream
      )
    `)
    .eq("teacher_id", user.id)
    .eq("is_active", true)
    .eq("academic_year", 2026)
    .returns<MyAssignmentRow[]>();

  if (error) {
    console.error("[fetchMyClassTeacherAssignments] Error:", error.message);
    return { isClassTeacher: false, classes: [] as { grade: string; stream: string }[] };
  }

  const formattedClasses = (data ?? []).map((r) => ({
    grade: r.classes?.grade ?? "Unknown",
    stream: r.classes?.stream ?? "Unknown",
  }));

  return {
    isClassTeacher: formattedClasses.length > 0,
    classes: formattedClasses,
    academicYear: data?.[0]?.academic_year ?? 2026,
  };
}

// ── Legacy Shim ──────────────────────────────────────────────────────────────

export async function fetchMyClassTeacherAssignment() {
  const result = await fetchMyClassTeacherAssignments();
  if (!result) return null;

  return {
    isClassTeacher: result.isClassTeacher,
    grade: result.classes[0]?.grade ?? null,
    stream: result.classes[0]?.stream ?? null,
    academicYear: result.academicYear,
  };
}