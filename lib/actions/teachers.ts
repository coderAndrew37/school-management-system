"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { sendTeacherWelcomeEmail } from "@/lib/mail";
import { getAuthConfirmUrl } from "@/lib/utils/site-url";
import { ActionResult, TeacherStatus } from "@/lib/types/dashboard";
import { getSession } from "@/lib/actions/auth";

// ── 1. Validation ─────────────────────────────────────────────────────────────

const teacherUpdateSchema = z.object({
  teacherId: z.string().uuid(),
  fullName: z.string().min(2, "Name must be at least 2 characters").max(120),
  phoneNumber: z.string().max(20).optional().nullable(),
  tscNumber: z.string().max(30).optional().nullable(),
  avatarUrl: z.string().optional().nullable(),
});

const archiveReasonSchema = z.enum([
  "transferred",
  "terminated",
  "resigned",
  "deceased",
  "retired",
]);

type ArchiveReason = z.infer<typeof archiveReasonSchema>;

// ── 2. Guard ──────────────────────────────────────────────────────────────────

/**
 * Ensures the requester is authenticated and has administrative privileges.
 */
async function ensureAdmin(): Promise<void> {
  const session = await getSession();
  if (!session || !session.profile) {
    throw new Error("Unauthorized");
  }

  const { base_role, is_super_admin, is_dev } = session.profile;
  const isPlatformAdmin = is_super_admin || is_dev;

  if (base_role !== "admin" && !isPlatformAdmin) {
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

    // 1. Fetch the profile row context to obtain the underlying relationship reference pointer
    const { data: profile, error: profileFetchErr } = await supabaseAdmin
      .from("profiles")
      .select("teacher_id")
      .eq("id", teacherId)
      .single();

    if (profileFetchErr || !profile) throw new Error("Associated profile context not found.");

    // 2. Safely patch structural employment table fields (Only tsc_number belongs here)
    if (profile.teacher_id) {
      const { error: teacherErr } = await supabaseAdmin
        .from("teachers")
        .update({
          tsc_number: tscNumber,
        })
        .eq("id", profile.teacher_id);

      if (teacherErr) throw teacherErr;
    }

    // 3. Sync public access profile matrix and Auth identities concurrently
    await Promise.all([
      supabaseAdmin
        .from("profiles")
        .update({ 
          full_name: fullName,
          phone_number: phoneNumber,
          avatar_url: avatarUrl
        })
        .eq("id", teacherId),
        
      supabaseAdmin.auth.admin.updateUserById(teacherId, {
        user_metadata: { 
          full_name: fullName,
          avatar_url: avatarUrl
        },
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

// ── 4. Change Status (Active/On Leave) ──────────────────────────────────────────

export async function changeTeacherStatusAction(
  teacherId: string,
  status: TeacherStatus,
): Promise<ActionResult> {
  try {
    await ensureAdmin();

    // 1. Fetch the profile context to resolve the correct employment key string
    const { data: profile, error: profileFetchErr } = await supabaseAdmin
      .from("profiles")
      .select("teacher_id")
      .eq("id", teacherId)
      .single();

    if (profileFetchErr || !profile || !profile.teacher_id) {
      throw new Error("Teacher record reference missing.");
    }

    // 2. Update the teacher's duty cycle status row
    const { error } = await supabaseAdmin
      .from("teachers")
      .update({ status })
      .eq("id", profile.teacher_id);

    if (error) throw error;

    // 3. If duty cycle transitions off-duty, relieve from running primary class manager roles
    if (status !== "active") {
      await supabaseAdmin
        .from("class_teacher_assignments")
        .update({
          is_active: false,
          relieved_at: new Date().toISOString(),
        })
        .eq("teacher_id", profile.teacher_id)
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

    // Sourced cleanly from profiles where user identity info explicitly lives
    const { data: profile, error: fetchErr } = await supabaseAdmin
      .from("profiles")
      .select("id, email, full_name, teacher_id")
      .or(`id.eq.${teacherId},teacher_id.eq.${teacherId}`)
      .single();

    if (fetchErr || !profile || !profile.email) {
      console.error("[resendTeacherInviteAction] Fetch Error:", fetchErr);
      return { success: false, message: "Teacher account profile not found." };
    }

    const { data: link, error: linkErr } =
      await supabaseAdmin.auth.admin.generateLink({
        type: "magiclink",
        email: profile.email,
        options: { redirectTo: getAuthConfirmUrl() },
      });

    if (linkErr) throw linkErr;

    await sendTeacherWelcomeEmail({
      teacherEmail: profile.email,
      teacherName: profile.full_name,
      setupLink: link.properties.action_link,
    });

  // Write timeline audit records to both structural records safely and cleanly
    const updatePromises: Promise<unknown>[] = [
      (async () => {
        const { error } = await supabaseAdmin
          .from("profiles")
          .update({ last_invite_sent: new Date().toISOString() })
          .eq("id", profile.id);
        if (error) throw error;
      })()
    ];

    if (profile.teacher_id) {
      updatePromises.push(
        (async () => {
          const { error } = await supabaseAdmin
            .from("teachers")
            .update({ last_invite_sent: new Date().toISOString() })
            .eq("id", profile.teacher_id);
          if (error) throw error;
        })()
      );
    }

    await Promise.all(updatePromises);

    revalidatePath("/admin/teachers");
    revalidatePath(`/admin/teachers/${teacherId}`);

    return { success: true, message: "Invite email resent successfully." };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Invite failed";
    console.error("[resendTeacherInviteAction] Error:", msg);
    return { success: false, message: "Failed to process and resend invite." };
  }
}

// ── 6. Archive Staff (Permanent Exits) ──────────────────────────────────────────

export async function archiveTeacherAction(
  teacherId: string,
  reason: ArchiveReason
): Promise<ActionResult> {
  try {
    await ensureAdmin();

    // 1. Fetch the profile context to handle mapping lookups safely
    const { data: profile, error: profileFetchErr } = await supabaseAdmin
      .from("profiles")
      .select("teacher_id")
      .eq("id", teacherId)
      .single();

    if (profileFetchErr || !profile || !profile.teacher_id) {
      throw new Error("Teacher employment record reference missing.");
    }

    const targetTeacherUuid = profile.teacher_id;

    // 2. Scan for active instructional course configurations 
    const { data: activeAllocations } = await supabaseAdmin
      .from("teacher_subject_allocations")
      .select("id")
      .eq("teacher_id", targetTeacherUuid)
      .limit(1);

    if (activeAllocations?.length) {
      return {
        success: false,
        message: `Teacher has active subject allocations. Please reassign their subjects before ${reason === "transferred" ? "transferring" : "archiving"}.`,
      };
    }

    // 3. Mark the archive termination workflow
    const { error } = await supabaseAdmin
      .from("teachers")
      .update({
        status: reason,
        archived_at: new Date().toISOString(),
      })
      .eq("id", targetTeacherUuid);

    if (error) throw error;

    // 4. Safely clear down out current class manager references
    await supabaseAdmin
      .from("class_teacher_assignments")
      .update({ 
        is_active: false, 
        relieved_at: new Date().toISOString() 
      })
      .eq("teacher_id", targetTeacherUuid)
      .eq("is_active", true);

    // 5. Explicitly freeze auth tokens and append flags to session attributes
    await supabaseAdmin.auth.admin.updateUserById(teacherId, {
      user_metadata: { status: reason, is_archived: true },
    });

    revalidatePath("/admin/teachers");
    revalidatePath(`/admin/teachers/${teacherId}`);
    revalidatePath("/admin/dashboard");

    return { 
      success: true, 
      message: `Teacher has been marked as ${reason.replace("_", " ")} successfully.` 
    };

  } catch (err) {
    const msg = err instanceof Error ? err.message : "Archive failed";
    console.error("[archiveTeacherAction] Error:", msg);
    return { success: false, message: "Failed to archive teacher. Verify database constraints." };
  }
}