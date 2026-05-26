"use server";

import { sendTeacherWelcomeEmail } from "@/lib/mail";
import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "../supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAuthConfirmUrl } from "@/lib/utils/site-url";
import { normalizeKenyanPhone } from "@/lib/utils/phone";
import type { ActionResult } from "@/lib/types/dashboard";

// ============================================================================
// CONTEXT RESOLUTION
// ============================================================================

async function resolveAdminContext(): Promise<{
  schoolId: string;
  profileId: string;
} | null> {
  // Use the server client (RLS-aware, reads real session)
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  // Fast path via JWT app_metadata
  const jwtSchoolId = user.app_metadata?.school_id as string | undefined;
  if (jwtSchoolId) return { schoolId: jwtSchoolId, profileId: user.id };

  // Fallback — live DB read (admin client to bypass RLS for the profile read)
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("school_id")
    .eq("id", user.id)
    .single();

  if (!profile?.school_id) return null;
  return { schoolId: profile.school_id, profileId: user.id };
}

// ============================================================================
// SERVER ACTION
// ============================================================================

export async function addTeacherAction(
  formData: FormData
): Promise<ActionResult> {
  const fullName = formData.get("fullName") as string;
  const email = formData.get("email") as string;
  const rawPhone = formData.get("phone") as string;
  const tscNumber = formData.get("tscNumber") as string;
  const imageFile = formData.get("image") as File | null;

  const phone = normalizeKenyanPhone(rawPhone);

  // 0. Resolve acting admin context
  const adminCtx = await resolveAdminContext();
  if (!adminCtx) {
    return { success: false, message: "Unauthorized: could not resolve school context." };
  }
  const { schoolId, profileId: actorProfileId } = adminCtx;

  try {
    // 1. Create Auth User Row
    const { data: authData, error: authError } =
      await supabaseAdmin.auth.admin.createUser({
        email,
        phone,
        email_confirm: true,
        user_metadata: { full_name: fullName, role: "admin" },
      });

    if (authError) throw authError;
    const userId = authData.user.id;

    // 2. Handle Image Upload (Optional)
    let avatarUrl: string | null = null;
    if (imageFile && imageFile.size > 0) {
      const fileExt = imageFile.name.split(".").pop();
      const fileName = `${userId}-${Date.now()}.${fileExt}`;
      const filePath = `teachers/${fileName}`;

      const { error: uploadError } = await supabaseAdmin.storage
        .from("avatars")
        .upload(filePath, imageFile);

      if (!uploadError) {
        const { data: publicData } = supabaseAdmin.storage
          .from("avatars")
          .getPublicUrl(filePath);
        avatarUrl = publicData.publicUrl;
      } else {
        console.error("[addTeacher] Avatar upload failed:", uploadError.message);
      }
    }

    // 3. Insert into the clean professional extensions table
    // staff_id is omitted here because your tr_set_teacher_staff_id database trigger generates it automatically.
    const { data: teacherData, error: teacherError } = await supabaseAdmin
      .from("teachers")
      .insert({
        school_id: schoolId,
        tsc_number: tscNumber || null,
        status: "active",
        invite_accepted: false,
        last_invite_sent: new Date().toISOString(),
      })
      .select("id, staff_id")
      .single();

    if (teacherError) {
      // Rollback newly created user on failure
      await supabaseAdmin.auth.admin.deleteUser(userId);
      throw teacherError;
    }

    const generatedTeacherId = teacherData.id;
    const generatedStaffId = teacherData.staff_id ?? "—";

    // 4. Populate Profiles entry with unified identity info and the generated teacher reference link
    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .update({
        school_id: schoolId,
        role: "admin", // Teachers utilize admin portal controls
        teacher_id: generatedTeacherId,
        avatar_url: avatarUrl,
        full_name: fullName,
        phone_number: phone,
        email,
      })
      .eq("id", userId);

    if (profileError) {
      // Rollback professional rows if identity placement fails
      await supabaseAdmin.from("teachers").delete().eq("id", generatedTeacherId);
      await supabaseAdmin.auth.admin.deleteUser(userId);
      throw profileError;
    }

    // 5. Sync custom JWT application claims
    const { error: jwtError } = await supabaseAdmin.rpc(
      "sync_user_jwt_claims",
      { p_profile_id: userId }
    );
    if (jwtError) {
      console.error("[addTeacher] JWT sync failed:", jwtError.message);
    }

    // 6. Record Multi-Tenant Audit Entry
    await supabaseAdmin.from("security_audit_logs").insert({
      school_id: schoolId,
      actor_id: actorProfileId,
      target_id: userId,
      action_type: "user_created",
      target_table: "teachers",
      record_id: generatedTeacherId,
      old_values: null,
      new_values: {
        teacher_id: generatedTeacherId,
        staff_id: generatedStaffId,
        full_name: fullName,
        email,
        tsc_number: tscNumber || null,
        school_id: schoolId,
        role: "admin",
      },
      context: {
        description: `Teacher "${fullName}" (${generatedStaffId}) registered by administrator`,
        actor_profile_id: actorProfileId,
      },
    });

  // 7. Dispatch Invitation Link
    const { data: linkData, error: linkError } =
      await supabaseAdmin.auth.admin.generateLink({
        type: "magiclink",
        email,
        options: { redirectTo: getAuthConfirmUrl() },
      });

    if (linkError) throw linkError;

    await sendTeacherWelcomeEmail({
      teacherEmail: email,
      teacherName: fullName,
      setupLink: linkData.properties.action_link,
    });

    revalidatePath("/admin/teachers");
    revalidatePath("/admin/dashboard");

    return {
      success: true,
      message: `${fullName} has been successfully registered with Staff ID: ${generatedStaffId}`,
    };
  } catch (error) {
    const msg =
      error instanceof Error ? error.message : "An unknown internal error occurred";
    console.error("[addTeacherAction] failed:", msg);
    return { success: false, message: msg };
  }
}