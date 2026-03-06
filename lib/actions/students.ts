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

const linkParentSchema = z.object({
  studentId: z.string().uuid(),
  parentId: z.string().uuid(),
  relationshipType: z
    .enum(["mother", "father", "guardian", "other"])
    .default("guardian"),
  isPrimaryContact: z.boolean().default(false),
});

const unlinkParentSchema = z.object({
  studentId: z.string().uuid(),
  parentId: z.string().uuid(),
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
      // Note: no parent_id — parent links live in student_parents join table
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
// student_parents rows are removed automatically via ON DELETE CASCADE.

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

// ── Link an additional parent to an existing student ─────────────────────────
// Useful from the student edit page to add a second guardian.

export async function linkParentToStudentAction(
  formData: FormData,
): Promise<ActionResult> {
  const session = await getSession();
  if (!session || session.profile.role !== "admin") {
    return { success: false, message: "Unauthorised" };
  }

  const parsed = linkParentSchema.safeParse({
    studentId: formData.get("studentId"),
    parentId: formData.get("parentId"),
    relationshipType: formData.get("relationshipType") ?? "guardian",
    isPrimaryContact: formData.get("isPrimaryContact") === "true",
  });

  if (!parsed.success) {
    return {
      success: false,
      message: parsed.error.issues[0]?.message ?? "Validation error",
    };
  }

  const { studentId, parentId, relationshipType, isPrimaryContact } =
    parsed.data;
  const supabase = await createSupabaseServerClient();

  // If this link is being set as primary, demote all existing primary links first
  if (isPrimaryContact) {
    await supabase
      .from("student_parents")
      .update({ is_primary_contact: false })
      .eq("student_id", studentId);
  }

  const { error } = await supabase.from("student_parents").upsert(
    {
      student_id: studentId,
      parent_id: parentId,
      relationship_type: relationshipType,
      is_primary_contact: isPrimaryContact,
    },
    { onConflict: "student_id,parent_id" },
  );

  if (error) {
    console.error("[linkParentToStudentAction]", error.message);
    return {
      success: false,
      message: "Failed to link parent: " + error.message,
    };
  }

  revalidatePath("/admin/students");
  return { success: true, message: "Parent linked successfully" };
}

// ── Unlink a parent from a student ───────────────────────────────────────────

export async function unlinkParentFromStudentAction(
  formData: FormData,
): Promise<ActionResult> {
  const session = await getSession();
  if (!session || session.profile.role !== "admin") {
    return { success: false, message: "Unauthorised" };
  }

  const parsed = unlinkParentSchema.safeParse({
    studentId: formData.get("studentId"),
    parentId: formData.get("parentId"),
  });

  if (!parsed.success) {
    return { success: false, message: "Invalid data" };
  }

  const supabase = await createSupabaseServerClient();

  // Guard: don't leave a student with zero parents
  const { count } = await supabase
    .from("student_parents")
    .select("*", { count: "exact", head: true })
    .eq("student_id", parsed.data.studentId);

  if ((count ?? 0) <= 1) {
    return {
      success: false,
      message:
        "Cannot remove the only parent. Add another guardian first, then remove this one.",
    };
  }

  const { error } = await supabase
    .from("student_parents")
    .delete()
    .eq("student_id", parsed.data.studentId)
    .eq("parent_id", parsed.data.parentId);

  if (error) {
    console.error("[unlinkParentFromStudentAction]", error.message);
    return { success: false, message: "Failed to unlink: " + error.message };
  }

  revalidatePath("/admin/students");
  return { success: true, message: "Parent unlinked" };
}
