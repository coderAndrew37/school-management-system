"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/actions/auth";
import { ALL_GRADES } from "@/lib/types/allocation";

// ── Schemas ───────────────────────────────────────────────────────────────────

const updateStudentSchema = z.object({
  studentId: z.string().uuid(),
  fullName: z.string().min(2).max(120),
  gender: z.enum(["Male", "Female"]).optional(),
  currentGrade: z.enum(ALL_GRADES as [string, ...string[]]),
  upiNumber: z.string().max(30).optional(),
});

const changeGradeSchema = z.object({
  studentId: z.string().uuid(),
  newGrade: z.enum(ALL_GRADES as [string, ...string[]]),
});

// ── Action result type ────────────────────────────────────────────────────────

interface ActionResult {
  success: boolean;
  message: string;
}

// ── Update student details ────────────────────────────────────────────────────

export async function updateStudentAction(
  formData: FormData,
): Promise<ActionResult> {
  const session = await getSession();
  if (!session || session.profile.role !== "admin") {
    return { success: false, message: "Unauthorised" };
  }

  const parsed = updateStudentSchema.safeParse({
    studentId: formData.get("studentId"),
    fullName: formData.get("fullName"),
    gender: formData.get("gender") || undefined,
    currentGrade: formData.get("currentGrade"),
    upiNumber: formData.get("upiNumber") || undefined,
  });

  if (!parsed.success) {
    return {
      success: false,
      message: parsed.error.issues[0]?.message ?? "Validation error",
    };
  }

  const { studentId, fullName, gender, currentGrade, upiNumber } = parsed.data;
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase
    .from("students")
    .update({
      full_name: fullName,
      gender: gender ?? null,
      current_grade: currentGrade,
      upi_number: upiNumber ?? null,
    })
    .eq("id", studentId);

  if (error) {
    console.error("[updateStudentAction]", error.message);
    return {
      success: false,
      message: "Failed to update student: " + error.message,
    };
  }

  revalidatePath("/admin/students");
  revalidatePath("/dashboard");
  return { success: true, message: `${fullName} updated successfully` };
}

// ── Change grade only (quick action) ─────────────────────────────────────────

export async function changeStudentGradeAction(
  formData: FormData,
): Promise<ActionResult> {
  const session = await getSession();
  if (!session || session.profile.role !== "admin") {
    return { success: false, message: "Unauthorised" };
  }

  const parsed = changeGradeSchema.safeParse({
    studentId: formData.get("studentId"),
    newGrade: formData.get("newGrade"),
  });

  if (!parsed.success) {
    return { success: false, message: "Invalid data" };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("students")
    .update({ current_grade: parsed.data.newGrade })
    .eq("id", parsed.data.studentId);

  if (error) return { success: false, message: error.message };

  revalidatePath("/admin/students");
  revalidatePath("/dashboard");
  return { success: true, message: "Grade updated" };
}

// ── Delete student ────────────────────────────────────────────────────────────

export async function deleteStudentAction(
  formData: FormData,
): Promise<ActionResult> {
  const session = await getSession();
  if (!session || session.profile.role !== "admin") {
    return { success: false, message: "Unauthorised" };
  }

  const studentId = formData.get("studentId");
  if (typeof studentId !== "string" || !studentId) {
    return { success: false, message: "Invalid student ID" };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("students")
    .delete()
    .eq("id", studentId);

  if (error) {
    console.error("[deleteStudentAction]", error.message);
    return { success: false, message: "Failed to delete: " + error.message };
  }

  revalidatePath("/admin/students");
  revalidatePath("/dashboard");
  return { success: true, message: "Student deleted" };
}
