"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/actions/auth";

// ── Helpers ───────────────────────────────────────────────────────────────────

const ADMIN_ROLES = ["admin", "superadmin"] as const;

async function requireAdmin() {
  const session = await getSession();
  if (
    !session ||
    !(ADMIN_ROLES as readonly string[]).includes(session.profile.role)
  ) {
    return null;
  }
  return session;
}

// ── Schemas ───────────────────────────────────────────────────────────────────

const updateStudentSchema = z.object({
  studentId: z.string().uuid(),
  fullName: z.string().min(2).max(120),
  gender: z.enum(["Male", "Female"]).optional().nullable(),
  currentGrade: z.string().min(1, "Grade is required"),
  currentStream: z.string().optional().nullable(),           // Made optional (column may not exist yet)
  upiNumber: z.string().max(30).optional().nullable(),
  dateOfBirth: z.string().optional().nullable(),             // Added support for DOB update
});

const changeGradeSchema = z.object({
  studentId: z.string().uuid(),
  newGrade: z.string().min(1),
  newStream: z.string().optional().nullable(),               // Made optional
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
  if (!(await requireAdmin()))
    return { success: false, message: "Unauthorised" };

  const parsed = updateStudentSchema.safeParse({
    studentId: formData.get("studentId"),
    fullName: formData.get("fullName"),
    gender: formData.get("gender") || null,
    currentGrade: formData.get("currentGrade"),
    currentStream: formData.get("currentStream") || null,
    upiNumber: formData.get("upiNumber") || null,
    dateOfBirth: formData.get("dateOfBirth") || null,
  });

  if (!parsed.success) {
    console.error("[updateStudentAction] Validation errors:", parsed.error.issues);
    return {
      success: false,
      message: parsed.error.issues[0]?.message ?? "Validation error",
    };
  }

  const {
    studentId,
    fullName,
    gender,
    currentGrade,
    currentStream,
    upiNumber,
    dateOfBirth,
  } = parsed.data;

  const supabase = await createSupabaseServerClient();

  const { error } = await supabase
    .from("students")
    .update({
      full_name: fullName,
      gender: gender ?? null,
      current_grade: currentGrade,
      // current_stream: currentStream,   // Removed - column does not exist in your table
      upi_number: upiNumber ?? null,
      date_of_birth: dateOfBirth ?? undefined,
    })
    .eq("id", studentId);

  if (error) {
    console.error("[updateStudentAction] Database error:", error.message);
    return {
      success: false,
      message: "Failed to update student: " + error.message,
    };
  }

  revalidatePath("/admin/students");
  revalidatePath("/admin/dashboard");
  return { success: true, message: `${fullName} updated successfully` };
}

// ── Change grade only (quick action) ─────────────────────────────────────────

export async function changeStudentGradeAction(
  formData: FormData,
): Promise<ActionResult> {
  if (!(await requireAdmin()))
    return { success: false, message: "Unauthorised" };

  const parsed = changeGradeSchema.safeParse({
    studentId: formData.get("studentId"),
    newGrade: formData.get("newGrade"),
    newStream: formData.get("newStream") || null,
  });

  if (!parsed.success) {
    return { success: false, message: "Invalid data" };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("students")
    .update({
      current_grade: parsed.data.newGrade,
      // current_stream removed - column does not exist
    })
    .eq("id", parsed.data.studentId);

  if (error) {
    console.error("[changeStudentGradeAction]", error.message);
    return { success: false, message: error.message };
  }

  revalidatePath("/admin/students");
  revalidatePath("/admin/dashboard");
  return { success: true, message: "Class placement updated" };
}

// ── Delete student ────────────────────────────────────────────────────────────

export async function deleteStudentAction(
  formData: FormData,
): Promise<ActionResult> {
  if (!(await requireAdmin()))
    return { success: false, message: "Unauthorised" };

  const studentId = formData.get("studentId");
  if (typeof studentId !== "string" || !studentId)
    return { success: false, message: "Invalid student ID" };

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
  revalidatePath("/admin/dashboard");
  return { success: true, message: "Student deleted" };
}

// ── Link an additional parent to an existing student ─────────────────────────

export async function linkParentToStudentAction(
  formData: FormData,
): Promise<ActionResult> {
  if (!(await requireAdmin()))
    return { success: false, message: "Unauthorised" };

  const parsed = linkParentSchema.safeParse({
    studentId: formData.get("studentId"),
    parentId: formData.get("parentId"),
    relationshipType: formData.get("relationshipType") ?? "guardian",
    isPrimaryContact: formData.get("isPrimaryContact") === "true",
  });

  if (!parsed.success)
    return {
      success: false,
      message: parsed.error.issues[0]?.message ?? "Validation error",
    };

  const { studentId, parentId, relationshipType, isPrimaryContact } =
    parsed.data;
  const supabase = await createSupabaseServerClient();

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
  if (!(await requireAdmin()))
    return { success: false, message: "Unauthorised" };

  const parsed = unlinkParentSchema.safeParse({
    studentId: formData.get("studentId"),
    parentId: formData.get("parentId"),
  });

  if (!parsed.success) return { success: false, message: "Invalid data" };

  const supabase = await createSupabaseServerClient();

  const { count } = await supabase
    .from("student_parents")
    .select("*", { count: "exact", head: true })
    .eq("student_id", parsed.data.studentId);

  if ((count ?? 0) <= 1) {
    return {
      success: false,
      message: "Cannot remove the only parent. Add another guardian first.",
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

// ── Change student status ──────────────────────────────────────────────────────

export async function changeStudentStatusAction(
  studentId: string,
  status: "active" | "transferred" | "graduated" | "withdrawn",
): Promise<ActionResult> {
  if (!(await requireAdmin()))
    return { success: false, message: "Unauthorised" };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("students")
    .update({ status })
    .eq("id", studentId);

  if (error) return { success: false, message: error.message };

  revalidatePath("/admin/students");
  revalidatePath("/admin/dashboard");
  return { success: true, message: `Student marked as ${status}.` };
}

// ── Set primary contact ────────────────────────────────────────────────────────

export async function setPrimaryContactAction(
  studentId: string,
  parentId: string,
): Promise<ActionResult> {
  if (!(await requireAdmin()))
    return { success: false, message: "Unauthorised" };

  const supabase = await createSupabaseServerClient();

  await supabase
    .from("student_parents")
    .update({ is_primary_contact: false })
    .eq("student_id", studentId);

  const { error } = await supabase
    .from("student_parents")
    .update({ is_primary_contact: true })
    .eq("student_id", studentId)
    .eq("parent_id", parentId);

  if (error) return { success: false, message: error.message };

  revalidatePath("/admin/students");
  return { success: true, message: "Primary contact updated." };
}

// ── Photo upload ──────────────────────────────────────────────────────────────

export async function uploadStudentPhotoAction(
  studentId: string,
  formData: FormData,
): Promise<{ success: boolean; message: string; photo_url?: string }> {
  const { uploadStudentPhotoAction: _upload } =
    await import("@/lib/actions/admit");
  return _upload(studentId, formData);
}