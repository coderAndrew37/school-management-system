"use server";

// lib/actions/class-teacher.ts

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";

type ActionResult = { success: boolean; message: string };

const assignSchema = z.object({
  grade: z.string().min(1),
  teacherId: z.string().uuid(),
  academicYear: z.number().int().default(2026),
});

// ── Assign (upsert) a class teacher for a grade ───────────────────────────────

export async function assignClassTeacherAction(
  data: z.infer<typeof assignSchema>,
): Promise<ActionResult> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, message: "Not authenticated." };

  const parsed = assignSchema.safeParse(data);
  if (!parsed.success) {
    return {
      success: false,
      message: parsed.error.issues[0]?.message ?? "Invalid input",
    };
  }

  const { error } = await supabase.from("class_teacher_assignments").upsert(
    {
      grade: parsed.data.grade,
      teacher_id: parsed.data.teacherId,
      academic_year: parsed.data.academicYear,
      assigned_by: user.id,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "grade,academic_year" },
  );

  if (error) {
    console.error("[assignClassTeacherAction]", error.message);
    return { success: false, message: `Failed to assign: ${error.message}` };
  }

  revalidatePath("/admin/class-teachers");
  revalidatePath("/teacher");
  return {
    success: true,
    message: `Class teacher assigned for ${parsed.data.grade}.`,
  };
}

// ── Remove a class teacher assignment ─────────────────────────────────────────

export async function removeClassTeacherAction(
  assignmentId: string,
): Promise<ActionResult> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, message: "Not authenticated." };

  const { error } = await supabase
    .from("class_teacher_assignments")
    .delete()
    .eq("id", assignmentId);

  if (error) {
    console.error("[removeClassTeacherAction]", error.message);
    return { success: false, message: "Failed to remove assignment." };
  }

  revalidatePath("/admin/class-teachers");
  revalidatePath("/teacher");
  return { success: true, message: "Assignment removed." };
}

// ── Fetch: is current teacher a class teacher, and for which grade? ───────────
// Used by teacher portal pages to decide what to show.

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
