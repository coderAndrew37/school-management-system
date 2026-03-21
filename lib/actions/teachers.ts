"use server";

// lib/actions/teachers.ts

import { getSession } from "@/lib/actions/auth";
import { sendTeacherWelcomeEmail } from "@/lib/mail";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getAuthConfirmUrl } from "@/lib/utils/site-url";
import { revalidatePath } from "next/cache";
import { z } from "zod";

export type TeacherStatus = "active" | "on_leave" | "resigned" | "terminated";

export interface TeacherActionResult {
  success: boolean;
  message: string;
}

// ── Guard ─────────────────────────────────────────────────────────────────────

async function requireAdmin() {
  const session = await getSession();
  if (!session || !["admin", "superadmin"].includes(session.profile.role))
    throw new Error("Forbidden");
}

// ── Validation ────────────────────────────────────────────────────────────────

const updateSchema = z.object({
  teacherId: z.string().uuid(),
  fullName: z.string().min(2, "Name must be at least 2 characters").max(120),
  phoneNumber: z.string().max(20).optional().nullable(),
  tscNumber: z.string().max(30).optional().nullable(),
});

// ── Update teacher details ─────────────────────────────────────────────────────

export async function updateTeacherAction(
  formData: FormData,
): Promise<TeacherActionResult> {
  try {
    await requireAdmin();
  } catch {
    return { success: false, message: "Not authorised." };
  }

  const parsed = updateSchema.safeParse({
    teacherId: formData.get("teacherId"),
    fullName: formData.get("fullName"),
    phoneNumber: formData.get("phoneNumber") || null,
    tscNumber: formData.get("tscNumber") || null,
  });

  if (!parsed.success)
    return {
      success: false,
      message: parsed.error.issues[0]?.message ?? "Invalid input",
    };

  const { teacherId, fullName, phoneNumber, tscNumber } = parsed.data;

  // Update teachers table
  const { error: teacherErr } = await supabaseAdmin
    .from("teachers")
    .update({
      full_name: fullName,
      phone_number: phoneNumber,
      tsc_number: tscNumber,
    })
    .eq("id", teacherId);

  if (teacherErr) {
    console.error("[updateTeacher]", teacherErr.message);
    return { success: false, message: "Failed to update teacher." };
  }

  // Sync full_name in auth user_metadata (best-effort)
  try {
    await supabaseAdmin.auth.admin.updateUserById(teacherId, {
      user_metadata: { full_name: fullName },
    });
  } catch {
    /* non-blocking */
  }

  revalidatePath("/admin/teachers");
  return { success: true, message: `${fullName} updated.` };
}

// ── Change teacher status ──────────────────────────────────────────────────────

export async function changeTeacherStatusAction(
  teacherId: string,
  status: TeacherStatus,
): Promise<TeacherActionResult> {
  try {
    await requireAdmin();
  } catch {
    return { success: false, message: "Not authorised." };
  }

  const { error } = await supabaseAdmin
    .from("teachers")
    .update({ status })
    .eq("id", teacherId);

  if (error) return { success: false, message: error.message };

  revalidatePath("/admin/teachers");
  return {
    success: true,
    message: `Teacher marked as ${status.replace("_", " ")}.`,
  };
}

// ── Delete teacher ─────────────────────────────────────────────────────────────
// Blocked if teacher has active subject allocations for the current year.

export async function deleteTeacherAction(
  teacherId: string,
  academicYear: number,
): Promise<TeacherActionResult> {
  try {
    await requireAdmin();
  } catch {
    return { success: false, message: "Not authorised." };
  }

  // Check for active allocations
  const { data: allocations } = await supabaseAdmin
    .from("teacher_subject_allocations")
    .select("id")
    .eq("teacher_id", teacherId)
    .eq("academic_year", academicYear)
    .limit(1);

  if (allocations && allocations.length > 0)
    return {
      success: false,
      message: `Cannot delete — this teacher has active subject allocations for ${academicYear}. Remove their allocations first.`,
    };

  // Delete auth user (cascades to profiles + teachers via FK)
  const { error } = await supabaseAdmin.auth.admin.deleteUser(teacherId);

  if (error) {
    console.error("[deleteTeacher]", error.message);
    return {
      success: false,
      message: "Failed to delete teacher: " + error.message,
    };
  }

  revalidatePath("/admin/teachers");
  revalidatePath("/admin/dashboard");
  return { success: true, message: "Teacher removed from the system." };
}

// ── Resend invite ──────────────────────────────────────────────────────────────

export async function resendTeacherInviteAction(
  teacherId: string,
): Promise<TeacherActionResult> {
  try {
    await requireAdmin();
  } catch {
    return { success: false, message: "Not authorised." };
  }

  const { data: teacher } = await supabaseAdmin
    .from("teachers")
    .select("email, full_name")
    .eq("id", teacherId)
    .single();

  if (!teacher) return { success: false, message: "Teacher not found." };

  const { data: linkData, error: linkErr } =
    await supabaseAdmin.auth.admin.generateLink({
      type: "magiclink",
      email: teacher.email,
      options: { redirectTo: getAuthConfirmUrl() },
    });

  if (linkErr || !linkData?.properties?.action_link)
    return { success: false, message: "Failed to generate setup link." };

  try {
    await sendTeacherWelcomeEmail({
      teacherEmail: teacher.email,
      teacherName: teacher.full_name,
      setupLink: linkData.properties.action_link,
    });
  } catch (err) {
    console.error("[resendTeacherInvite] mail failed:", err);
    return {
      success: false,
      message: "Link generated but email failed to send.",
    };
  }

  // Track last invite sent
  await supabaseAdmin
    .from("teachers")
    .update({ last_invite_sent: new Date().toISOString() })
    .eq("id", teacherId);

  return { success: true, message: "Invite email resent." };
}

// ── Fetch allocations for a teacher (shown in edit drawer) ────────────────────

export interface TeacherAllocationSummary {
  id: string;
  grade: string;
  subjectName: string;
  subjectCode: string;
}

export async function fetchTeacherAllocationsAction(
  teacherId: string,
  academicYear: number,
): Promise<TeacherAllocationSummary[]> {
  const { data, error } = await supabaseAdmin
    .from("teacher_subject_allocations")
    .select("id, grade, subjects ( name, code )")
    .eq("teacher_id", teacherId)
    .eq("academic_year", academicYear)
    .order("grade");

  if (error) return [];

  return ((data ?? []) as any[]).map((row) => {
    const subject = Array.isArray(row.subjects)
      ? row.subjects[0]
      : row.subjects;
    return {
      id: row.id,
      grade: row.grade,
      subjectName: subject?.name ?? "Unknown",
      subjectCode: subject?.code ?? "?",
    };
  });
}
