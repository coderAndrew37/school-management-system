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

    // 2. Safely patch structural employment table fields (only tsc_number belongs here)
    if (profile.teacher_id) {
      const { error: teacherErr } = await supabaseAdmin
        .from("teachers")
        .update({ tsc_number: tscNumber })
        .eq("id", profile.teacher_id);

      if (teacherErr) throw teacherErr;
    }

    // 3. Sync profile and auth metadata concurrently — wrapped in IIFEs for native Promise<void>
    await Promise.all([
      (async () => {
        const { error } = await supabaseAdmin
          .from("profiles")
          .update({ full_name: fullName, phone_number: phoneNumber, avatar_url: avatarUrl })
          .eq("id", teacherId);
        if (error) throw error;
      })(),
      (async () => {
        const { error } = await supabaseAdmin.auth.admin.updateUserById(teacherId, {
          user_metadata: { full_name: fullName, avatar_url: avatarUrl },
        });
        if (error) throw error;
      })(),
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

// ── 4. Change Status (Active/On Leave) ───────────────────────────────────────

export async function changeTeacherStatusAction(
  teacherId: string,
  status: TeacherStatus,
): Promise<ActionResult> {
  try {
    await ensureAdmin();

    const { data: profile, error: profileFetchErr } = await supabaseAdmin
      .from("profiles")
      .select("teacher_id")
      .eq("id", teacherId)
      .single();

    if (profileFetchErr || !profile || !profile.teacher_id) {
      throw new Error("Teacher record reference missing.");
    }

    const { error } = await supabaseAdmin
      .from("teachers")
      .update({ status })
      .eq("id", profile.teacher_id);

    if (error) throw error;

    if (status !== "active") {
      await supabaseAdmin
        .from("class_teacher_assignments")
        .update({ is_active: false, relieved_at: new Date().toISOString() })
        .eq("teacher_id", profile.teacher_id)
        .eq("is_active", true);
    }

    revalidatePath("/admin/teachers");
    revalidatePath(`/admin/teachers/${teacherId}`);

    return { success: true, message: `Status updated to ${status.replace("_", " ")}.` };
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

    const { data: profile, error: fetchErr } = await supabaseAdmin
      .from("profiles")
      .select("id, email, full_name, teacher_id")
      .or(`id.eq.${teacherId},teacher_id.eq.${teacherId}`)
      .single();

    if (fetchErr || !profile || !profile.email) {
      console.error("[resendTeacherInviteAction] Fetch Error:", fetchErr);
      return { success: false, message: "Teacher account profile not found." };
    }

    const { data: link, error: linkErr } = await supabaseAdmin.auth.admin.generateLink({
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

    // profiles.last_invite_sent is the canonical column — unconditional
    const updatePromises: Promise<unknown>[] = [
      (async () => {
        const { error } = await supabaseAdmin
          .from("profiles")
          .update({ last_invite_sent: new Date().toISOString() })
          .eq("id", profile.id);
        if (error) throw error;
      })(),
    ];

    // teachers.last_invite_sent — only written if teacher_id is present
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

// ── 6. Archive Staff (Permanent Exits) ───────────────────────────────────────

export async function archiveTeacherAction(
  teacherId: string,
  reason: ArchiveReason,
): Promise<ActionResult> {
  try {
    await ensureAdmin();

    const { data: profile, error: profileFetchErr } = await supabaseAdmin
      .from("profiles")
      .select("teacher_id")
      .eq("id", teacherId)
      .single();

    if (profileFetchErr || !profile || !profile.teacher_id) {
      throw new Error("Teacher employment record reference missing.");
    }

    const targetTeacherUuid = profile.teacher_id as string;

    // Scope to is_active = true — historical allocations must not block archival
    const { data: activeAllocations } = await supabaseAdmin
      .from("teacher_subject_allocations")
      .select("id")
      .eq("teacher_id", targetTeacherUuid)
      .eq("is_active", true)
      .limit(1);

    if (activeAllocations?.length) {
      return {
        success: false,
        message: `Teacher has active subject allocations. Please reassign their subjects before ${reason === "transferred" ? "transferring" : "archiving"}.`,
      };
    }

    const { error } = await supabaseAdmin
      .from("teachers")
      .update({ status: reason, archived_at: new Date().toISOString() })
      .eq("id", targetTeacherUuid);

    if (error) throw error;

    await supabaseAdmin
      .from("class_teacher_assignments")
      .update({ is_active: false, relieved_at: new Date().toISOString() })
      .eq("teacher_id", targetTeacherUuid)
      .eq("is_active", true);

    // Hard-freeze the JWT — ban_duration actively rejects the session
    await supabaseAdmin.auth.admin.updateUserById(teacherId, {
      ban_duration: "876000h",
      user_metadata: { status: reason, is_archived: true },
    });

    await supabaseAdmin.auth.admin.updateUserById(teacherId, {
      app_metadata: { is_archived: true, archived_reason: reason },
    });

    revalidatePath("/admin/teachers");
    revalidatePath(`/admin/teachers/${teacherId}`);
    revalidatePath("/admin/dashboard");

    return {
      success: true,
      message: `Teacher has been marked as ${reason.replace("_", " ")} and access revoked.`,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Archive failed";
    console.error("[archiveTeacherAction] Error:", msg);
    return { success: false, message: "Failed to archive teacher. Verify database constraints." };
  }
}

// ── 7. Update Staff Access (role assignments + permission overrides) ──────────
//
// Called by StaffAccessMatrix AccessEditor.
// teacherId = teachers.id — profile is resolved internally.

export interface UpdateStaffAccessPayload {
  roleIds:   string[];
  overrides: { permissionId: string; hasAccess: boolean }[];
}

type AccessActionResult = ActionResult & { error?: string };

export async function updateStaffAccessAction(
  teacherId: string,
  payload: UpdateStaffAccessPayload,
): Promise<AccessActionResult> {
  try {
    await ensureAdmin();

    // Resolve profile from teachers.id
    const { data: profile, error: profileErr } = await supabaseAdmin
      .from("profiles")
      .select("id, school_id")
      .eq("teacher_id", teacherId)
      .single();

    if (profileErr || !profile) {
      return { success: false, message: "No profile linked to this teacher (profiles.teacher_id not set).", error: "NO_PROFILE" };
    }

    const profileId = profile.id as string;
    const schoolId  = profile.school_id as string;

    // Validate all roleIds belong to this school (composite key guard)
    if (payload.roleIds.length > 0) {
      const { data: validRoles } = await supabaseAdmin
        .from("admin_role_definitions")
        .select("id")
        .in("id", payload.roleIds)
        .eq("school_id", schoolId)
        .eq("is_active", true);

      const validIds = new Set((validRoles ?? []).map((r) => r.id as string));
      const invalid  = payload.roleIds.filter((id) => !validIds.has(id));
      if (invalid.length > 0) {
        return { success: false, message: `Role(s) not valid for this school: ${invalid.join(", ")}` };
      }
    }

    const allowed = payload.overrides.filter((o) => o.hasAccess).map((o) => o.permissionId);
    const denied  = payload.overrides.filter((o) => !o.hasAccess).map((o) => o.permissionId);

    // Revoke existing active assignments + update permission overrides in parallel
    await Promise.all([
      (async () => {
        const { error } = await supabaseAdmin
          .from("profiles")
          .update({
            allowed_permissions_override: allowed,
            denied_permissions_override:  denied,
            updated_at: new Date().toISOString(),
          })
          .eq("id", profileId);
        if (error) throw new Error(`Permission override update failed: ${error.message}`);
      })(),
      (async () => {
        const { error } = await supabaseAdmin
          .from("staff_role_assignments")
          .update({ revoked_at: new Date().toISOString() })
          .eq("profile_id", profileId)
          .is("revoked_at", null);
        if (error) throw new Error(`Role revocation failed: ${error.message}`);
      })(),
    ]);

    // Insert fresh assignments (sequential — depends on revoke completing first)
    if (payload.roleIds.length > 0) {
      const { error: insertError } = await supabaseAdmin
        .from("staff_role_assignments")
        .insert(
          payload.roleIds.map((roleId) => ({
            profile_id: profileId,
            role_id:    roleId,
            school_id:  schoolId,
          }))
        );

      if (insertError) {
        console.error("[updateStaffAccessAction] role insert failed:", insertError.message);
        return { success: false, message: "Permissions saved but role assignments failed. Please retry." };
      }
    }

    revalidatePath("/admin/staff");
    return { success: true, message: "Access configuration saved." };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("[updateStaffAccessAction]", msg);
    return { success: false, message: msg };
  }
}

// ── 8. Transfer Teacher Out ───────────────────────────────────────────────────
//
// Called by StaffAccessMatrix TransferOutForm.
// teacherId = teachers.id — profile is resolved internally.

export interface TransferOutPayload {
  teacherId:             string;
  destinationSchoolName: string;
  reason?:               string;
}

export async function transferTeacherOutAction(
  payload: TransferOutPayload,
): Promise<AccessActionResult> {
  try {
    await ensureAdmin();

    const { teacherId, destinationSchoolName, reason } = payload;
    const transferDate = new Date().toISOString();

    // Resolve profile from teachers.id
    const { data: profile, error: profileErr } = await supabaseAdmin
      .from("profiles")
      .select("id, school_id")
      .eq("teacher_id", teacherId)
      .single();

    if (profileErr || !profile) {
      return { success: false, message: "No profile linked to this teacher.", error: "NO_PROFILE" };
    }

    const profileId = profile.id as string;

    await Promise.all([
      // teachers table: status + transfer destination
      (async () => {
        const { error } = await supabaseAdmin
          .from("teachers")
          .update({
            status:                      "transferred",
            transfer_destination_school: destinationSchoolName,
            transfer_date:               transferDate,
          })
          .eq("id", teacherId);
        if (error) throw new Error(`Teacher transfer failed: ${error.message}`);
      })(),
      // Revoke all active role assignments
      (async () => {
        const { error } = await supabaseAdmin
          .from("staff_role_assignments")
          .update({ revoked_at: transferDate })
          .eq("profile_id", profileId)
          .is("revoked_at", null);
        if (error) throw new Error(`Role revocation on transfer failed: ${error.message}`);
      })(),
      // Clear permission overrides on profiles
      (async () => {
        const { error } = await supabaseAdmin
          .from("profiles")
          .update({
            allowed_permissions_override: [],
            denied_permissions_override:  [],
            admin_role:                   null,
            updated_at:                   transferDate,
          })
          .eq("id", profileId);
        if (error) throw new Error(`Profile clear on transfer failed: ${error.message}`);
      })(),
    ]);

    // Non-blocking audit log
    void supabaseAdmin.from("role_audit_logs").insert({
      actor_id:        profileId,
      target_id:       profileId,
      action:          "TRANSFER_OUT",
      previous_values: { status: "active" },
      new_values:      { status: "transferred", destination: destinationSchoolName },
      reason:          reason ?? `Transferred to ${destinationSchoolName}`,
    }).then(({ error: e }) => { if (e) console.warn("[audit transfer]", e.message); });

    revalidatePath("/admin/staff");
    revalidatePath("/admin/teachers");

    return { success: true, message: `${destinationSchoolName} transfer recorded. All access revoked.` };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown transfer error";
    console.error("[transferTeacherOutAction]", msg);
    return { success: false, message: msg };
  }
}