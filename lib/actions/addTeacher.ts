"use server";

import { sendTeacherWelcomeEmail } from "@/lib/mail";
import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "../supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAuthConfirmUrl } from "@/lib/utils/site-url";
import { normalizeKenyanPhone } from "@/lib/utils/phone";
import type { ActionResult } from "@/lib/types/dashboard";

// ── Generate a short staff ID: KIB-YYYY-XXXX ─────────────────────────────────

function generateStaffId(): string {
  const year = new Date().getFullYear();
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `KIB-${year}-${suffix}`;
}

// ── Resolve the acting admin's school_id & profile_id ────────────────────────

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

// ── Main Action ───────────────────────────────────────────────────────────────

export async function addTeacherAction(
  formData: FormData,
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

  const staffId = generateStaffId();

  try {
    // 1. Create Auth User
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

    // 3. Insert into Teachers table (school_id scoped)
    const { error: teacherError } = await supabaseAdmin
      .from("teachers")
      .insert({
        id: userId,
        school_id: schoolId,          // ← scoped to acting admin's school
        staff_id: staffId,
        full_name: fullName,
        email,
        phone_number: phone,
        tsc_number: tscNumber || null,
        avatar_url: avatarUrl,
        status: "active",
        invite_accepted: false,
        last_invite_sent: new Date().toISOString(),
      });

    if (teacherError) {
      await supabaseAdmin.auth.admin.deleteUser(userId);
      throw teacherError;
    }

    // 4. Update Profile — set school_id, role, teacher_id link, avatar
    // The trigger creates a bare profile row on auth.users insert;
    // we complete it here with all the required fields.
    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .update({
        school_id: schoolId,          // ← multi-tenant anchor
        role: "admin",                // ← teachers are admin-portal users
        teacher_id: userId,           // ← explicit FK link profile → teachers
        avatar_url: avatarUrl,
        full_name: fullName,
        phone_number: phone,
        email,
      })
      .eq("id", userId);

    if (profileError) throw profileError;

    // 5. Sync JWT claims so the new teacher's session has correct permissions
    const { error: jwtError } = await supabaseAdmin.rpc(
      "sync_user_jwt_claims",
      { p_profile_id: userId },
    );
    if (jwtError) {
      // Non-fatal — log but don't fail the whole action
      console.error("[addTeacher] JWT sync failed:", jwtError.message);
    }

    // 6. Audit log — record the teacher creation
    await supabaseAdmin.from("security_audit_logs").insert({
      school_id: schoolId,
      actor_id: actorProfileId,
      target_id: userId,
      action_type: "user_created",
      target_table: "teachers",
      record_id: userId,
      old_values: null,
      new_values: {
        full_name: fullName,
        email,
        staff_id: staffId,
        tsc_number: tscNumber || null,
        school_id: schoolId,
        role: "admin",
      },
      context: {
        description: `Teacher "${fullName}" registered by admin`,
        actor_profile_id: actorProfileId,
      },
    });

    // 7. Generate magic-link and send welcome email
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
      message: `${fullName} has been registered and a welcome email sent.`,
    };
  } catch (error) {
    const msg =
      error instanceof Error ? error.message : "An unknown error occurred";
    console.error("[addTeacherAction] failed:", msg);
    return { success: false, message: msg };
  }
}