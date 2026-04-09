"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { sendTeacherWelcomeEmail } from "@/lib/mail";
import { getAuthConfirmUrl } from "@/lib/utils/site-url";
import { ActionResult, TeacherStatus } from "@/lib/types/dashboard";

// ── 1. Validation ─────────────────────────────────────────────────────────────

const teacherUpdateSchema = z.object({
  teacherId: z.string().uuid(),
  fullName: z.string().min(2, "Name must be at least 2 characters").max(120),
  phoneNumber: z.string().max(20).optional().nullable(),
  tscNumber: z.string().max(30).optional().nullable(),
  avatarUrl: z.string().optional().nullable(),
});

// ── 2. Guard ──────────────────────────────────────────────────────────────────

/**
 * Ensures the requester is authenticated and has administrative privileges.
 */
async function ensureAdmin(): Promise<void> {
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
}

// ── 3. Update Teacher ─────────────────────────────────────────────────────────

export async function updateTeacherAction(fd: FormData): Promise<ActionResult> {
  try {
    await ensureAdmin();

    const parsed = teacherUpdateSchema.safeParse({
      teacherId: fd.get("teacherId"),
      fullName: fd.get("fullName"),
      phoneNumber: fd.get("phoneNumber") || null,
      tscNumber: fd.get("tscNumber") || null,
      avatarUrl: fd.get("avatarUrl") || null,
    });

    if (!parsed.success) {
      return {
        success: false,
        message: parsed.error.issues[0]?.message ?? "Invalid input",
      };
    }

    const { teacherId, fullName, phoneNumber, tscNumber, avatarUrl } = parsed.data;

    // 1. Update the Teachers table
    const { error: teacherErr } = await supabaseAdmin
      .from("teachers")
      .update({
        full_name: fullName,
        phone_number: phoneNumber,
        tsc_number: tscNumber,
        ...(avatarUrl ? { avatar_url: avatarUrl } : {}),
      })
      .eq("id", teacherId);

    if (teacherErr) throw teacherErr;

    // 2. Sync Profile and Auth Metadata (Parallel)
    await Promise.all([
      supabaseAdmin
        .from("profiles")
        .update({ full_name: fullName })
        .eq("id", teacherId),
      supabaseAdmin.auth.admin.updateUserById(teacherId, {
        user_metadata: { full_name: fullName },
      }),
    ]);

    revalidatePath("/admin/teachers");
    revalidatePath(`/admin/teachers/${teacherId}`);

    return { success: true, message: `${fullName} updated successfully.` };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Update failed";
    console.error("[updateTeacherAction] Error:", msg);
    return { success: false, message: "Failed to update teacher record." };
  }
}

// ── 4. Change Status ──────────────────────────────────────────────────────────

/**
 * Updates teacher status and automatically relieves them of active
 * class assignments if they are no longer 'active'.
 */
export async function changeTeacherStatusAction(
  teacherId: string,
  status: TeacherStatus,
): Promise<ActionResult> {
  try {
    await ensureAdmin();

    // 1. Update the teacher's status
    const { error } = await supabaseAdmin
      .from("teachers")
      .update({ status })
      .eq("id", teacherId);

    if (error) throw error;

    // 2. If status is NOT 'active', perform a "Soft Relieve" on active class assignments
    if (status !== "active") {
      await supabaseAdmin
        .from("class_teacher_assignments")
        .update({
          is_active: false,
          relieved_at: new Date().toISOString(),
        })
        .eq("teacher_id", teacherId)
        .eq("is_active", true);
    }

    revalidatePath("/admin/teachers");
    revalidatePath(`/admin/teachers/${teacherId}`);

    return {
      success: true,
      message: `Status updated to ${status.replace("_", " ")}.`,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Status update failed";
    console.error("[changeTeacherStatusAction] Error:", msg);
    return { success: false, message: msg };
  }
}

// ── 5. Resend Invite ──────────────────────────────────────────────────────────

export async function resendTeacherInviteAction(
  teacherId: string,
): Promise<ActionResult> {
  try {
    await ensureAdmin();

    const { data: teacher, error: fetchErr } = await supabaseAdmin
      .from("teachers")
      .select("email, full_name")
      .eq("id", teacherId)
      .returns<{ email: string; full_name: string }[]>()
      .single();

    if (fetchErr || !teacher) return { success: false, message: "Teacher not found." };

    const { data: link, error: linkErr } =
      await supabaseAdmin.auth.admin.generateLink({
        type: "magiclink",
        email: teacher.email,
        options: { redirectTo: getAuthConfirmUrl() },
      });

    if (linkErr) throw linkErr;

    await sendTeacherWelcomeEmail({
      teacherEmail: teacher.email,
      teacherName: teacher.full_name,
      setupLink: link.properties.action_link,
    });

    await supabaseAdmin
      .from("teachers")
      .update({ last_invite_sent: new Date().toISOString() })
      .eq("id", teacherId);

    revalidatePath("/admin/teachers");
    revalidatePath(`/admin/teachers/${teacherId}`);

    return { success: true, message: "Invite email resent." };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Invite failed";
    console.error("[resendTeacherInviteAction] Error:", msg);
    return { success: false, message: "Failed to resend invite." };
  }
}

// ── 6. Delete Teacher ─────────────────────────────────────────────────────────

export async function deleteTeacherAction(
  teacherId: string,
  academicYear: number,
): Promise<ActionResult> {
  try {
    await ensureAdmin();

    // 1. Check for active subject allocations for safety
    const { data: allocations } = await supabaseAdmin
      .from("teacher_subject_allocations")
      .select("id")
      .eq("teacher_id", teacherId)
      .eq("academic_year", academicYear)
      .limit(1);

    if (allocations?.length) {
      return {
        success: false,
        message: "Cannot delete: Teacher has active subject allocations. Clear them first.",
      };
    }

    // 2. Cleanup Class Teacher roles
    await supabaseAdmin
      .from("class_teacher_assignments")
      .delete()
      .eq("teacher_id", teacherId);

    // 3. Delete from Auth (Cascades to public.teachers and public.profiles)
    const { error } = await supabaseAdmin.auth.admin.deleteUser(teacherId);

    if (error) throw error;

    revalidatePath("/admin/teachers");
    revalidatePath("/admin/dashboard");

    return { success: true, message: "Teacher removed from Kibali Academy." };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Deletion failed";
    console.error("[deleteTeacherAction] Error:", msg);
    return { success: false, message: "Deletion failed: " + msg };
  }
}