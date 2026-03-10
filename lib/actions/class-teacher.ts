"use server";

// lib/actions/class-teacher.ts

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { supabaseAdmin } from "../supabase/admin";

// ── Shared types ──────────────────────────────────────────────────────────────

export interface Assignment {
  id: string;
  teacher_id: string;
  grade: string;
  academic_year: number;
}

/** Used by ClassTeacherAssignmentClient (admin UI) */
export type AssignResult =
  | { success: true; assignment: Assignment }
  | { success: false; error: string };

/** Used by removeClassTeacherAction */
export type RemoveResult =
  | { success: true }
  | { success: false; error: string };

// ── Schemas ───────────────────────────────────────────────────────────────────

const assignSchema = z.object({
  grade: z.string().min(1),
  teacherId: z.string().uuid(),
  academicYear: z.number().int().default(2026),
});

// ── Assign (upsert) a class teacher for a grade ───────────────────────────────
// Used by: /admin/class-teachers  (ClassTeacherAssignmentClient)

export async function assignClassTeacherAction(
  data: z.infer<typeof assignSchema>,
): Promise<AssignResult> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Not authenticated." };

  const parsed = assignSchema.safeParse(data);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input",
    };
  }

  // Admins and superadmins only
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || !["admin", "superadmin"].includes(profile.role)) {
    return { success: false, error: "Insufficient permissions." };
  }

  const { data: result, error } = await supabaseAdmin
    .from("class_teacher_assignments")
    .upsert(
      {
        grade: parsed.data.grade,
        teacher_id: parsed.data.teacherId,
        academic_year: parsed.data.academicYear,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "grade,academic_year" },
    )
    .select("id, teacher_id, grade, academic_year")
    .single();

  if (error) {
    console.error("[assignClassTeacherAction]", error.message);
    return { success: false, error: `Failed to assign: ${error.message}` };
  }

  revalidatePath("/admin/class-teachers");
  revalidatePath("/teacher");
  return { success: true, assignment: result as Assignment };
}

// ── Remove a class teacher assignment ─────────────────────────────────────────
// Used by: /admin/class-teachers  (ClassTeacherAssignmentClient)

export async function removeClassTeacherAction(
  assignmentId: string,
): Promise<RemoveResult> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Not authenticated." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || !["admin", "superadmin"].includes(profile.role)) {
    return { success: false, error: "Insufficient permissions." };
  }

  const { error } = await supabaseAdmin
    .from("class_teacher_assignments")
    .delete()
    .eq("id", assignmentId);

  if (error) {
    console.error("[removeClassTeacherAction]", error.message);
    return { success: false, error: "Failed to remove assignment." };
  }

  revalidatePath("/admin/class-teachers");
  revalidatePath("/teacher");
  return { success: true };
}

// ── Fetch: is current teacher a class teacher, and for which grade? ───────────
// Used by: all /teacher/class/* pages + ClassTeacherBanner

export async function fetchMyClassTeacherAssignment(): Promise<{
  isClassTeacher: boolean;
  grade: string | null;
  academicYear: number | null;
} | null> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("class_teacher_assignments")
    .select("grade, academic_year")
    .eq("teacher_id", user.id)
    .eq("academic_year", 2026)
    .maybeSingle();

  if (error) {
    console.error("[fetchMyClassTeacherAssignment]", error.message);
    return { isClassTeacher: false, grade: null, academicYear: null };
  }

  if (!data) return { isClassTeacher: false, grade: null, academicYear: null };

  return {
    isClassTeacher: true,
    grade: data.grade,
    academicYear: data.academic_year,
  };
}
