"use server";

// lib/actions/teachers.ts
// Kibali Academy — Add Teacher Server Action
//
// ROLE ARCHITECTURE CLARIFICATION
// ──────────────────────────────────────────────────────────────────────────────
// Every person registered through this action is a TEACHER.
// Their system-level `profiles.role` is ALWAYS "staff".
//
// "admin" roles (headteacher, bursar, DOS etc.) are NEVER set directly on
// `profiles.role` here. Granular admin permissions are managed exclusively
// through `staff_role_assignments → admin_role_definitions`.
//
// This means:
//   - profiles.role = "staff"  → always, for every teacher registered here
//   - isAdminStaff flag        → only controls whether an initial
//                                 staff_role_assignment row is inserted,
//                                 NOT what profiles.role is set to
//
// This prevents accidental admin-portal access being granted at the profile
// level, while still allowing the caller to pre-seed a granular role.
// ──────────────────────────────────────────────────────────────────────────────

import { sendTeacherWelcomeEmail }     from "@/lib/mail";
import { revalidatePath }              from "next/cache";
import { supabaseAdmin }               from "../supabase/admin";
import { createSupabaseServerClient }  from "@/lib/supabase/server";
import { getAuthConfirmUrl }           from "@/lib/utils/site-url";
import { normalizeKenyanPhone }        from "@/lib/utils/phone";
import type { ActionResult }           from "@/lib/types/dashboard";

// ============================================================================
// INTERNAL TYPES
// ============================================================================

interface AdminContext {
  schoolId: string;
  profileId: string;
}

// ============================================================================
// CONTEXT RESOLUTION
// ============================================================================

async function resolveAdminContext(): Promise<AdminContext | null> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const jwtSchoolId = user.app_metadata?.school_id as string | undefined;
  if (jwtSchoolId) return { schoolId: jwtSchoolId, profileId: user.id };

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("school_id")
    .eq("id", user.id)
    .single();

  if (!profile?.school_id) return null;
  return { schoolId: profile.school_id, profileId: user.id };
}

// ============================================================================
// ADD TEACHER ACTION
// ============================================================================

export async function addTeacherAction(
  formData: FormData
): Promise<ActionResult> {
  const fullName     = formData.get("fullName")      as string;
  const email        = formData.get("email")         as string;
  const rawPhone     = formData.get("phone")         as string;
  const tscNumber    = formData.get("tscNumber")     as string;
  const imageFile    = formData.get("image")         as File | null;

  // isAdminStaff: when true, the teacher also holds an administrative role
  // (headteacher, bursar, DOS etc.).  This does NOT change profiles.role —
  // it only gates whether an initial staff_role_assignment row is created.
  const isAdminStaff  = formData.get("isAdminStaff") === "true";
  const initialRoleId = (formData.get("initialRoleId") as string | null) || null;

  const phone = normalizeKenyanPhone(rawPhone);

  const adminCtx = await resolveAdminContext();
  if (!adminCtx) {
    return {
      success: false,
      message: "Unauthorized: could not resolve school context.",
    };
  }

  const { schoolId, profileId: actorProfileId } = adminCtx;

  // ALL teachers use the "staff" system role, regardless of isAdminStaff.
  // Admin-portal access is controlled through staff_role_assignments only.
  const SYSTEM_ROLE = "staff" as const;

  try {
    // ── 1. Create Auth User ────────────────────────────────────────────────
    const { data: authData, error: authError } =
      await supabaseAdmin.auth.admin.createUser({
        email,
        phone,
        email_confirm: true,
        user_metadata: {
          full_name: fullName,
          role:      SYSTEM_ROLE,
          school_id: schoolId,
        },
      });

    if (authError) throw authError;
    const userId = authData.user.id;

    // ── 2. Optional avatar upload ──────────────────────────────────────────
    let avatarUrl: string | null = null;
    if (imageFile && imageFile.size > 0) {
      const fileExt  = imageFile.name.split(".").pop() ?? "jpg";
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

    // ── 3. Insert teacher row ──────────────────────────────────────────────
    // staff_id is auto-generated by the tr_set_teacher_staff_id trigger.
    const { data: teacherData, error: teacherError } = await supabaseAdmin
      .from("teachers")
      .insert({
        school_id:        schoolId,
        tsc_number:       tscNumber || null,
        status:           "active",
        invite_accepted:  false,
        last_invite_sent: new Date().toISOString(),
      })
      .select("id, staff_id")
      .single();

    if (teacherError) {
      await supabaseAdmin.auth.admin.deleteUser(userId);
      throw teacherError;
    }

    const generatedTeacherId = teacherData.id as string;
    const generatedStaffId   = (teacherData.staff_id as string | null) ?? "—";

    // ── 4. Update profile row (created by handle_new_user trigger) ─────────
    // Link to the teacher row and lock the system role to "staff".
    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .update({
        school_id:    schoolId,
        role:         SYSTEM_ROLE,   // always "staff" — never "admin" here
        teacher_id:   generatedTeacherId,
        avatar_url:   avatarUrl,
        full_name:    fullName,
        phone_number: phone,
        email,
      })
      .eq("id", userId);

    if (profileError) {
      await supabaseAdmin.from("teachers").delete().eq("id", generatedTeacherId);
      await supabaseAdmin.auth.admin.deleteUser(userId);
      throw profileError;
    }

    // ── 5. Optionally assign a granular staff role ─────────────────────────
    // This inserts into staff_role_assignments (e.g. headteacher, bursar).
    // It does NOT grant admin-portal access on its own — that is determined
    // by the RLS / middleware layer reading staff_role_assignments, not
    // profiles.role.
    if (isAdminStaff && initialRoleId) {
      const { error: roleAssignError } = await supabaseAdmin
        .from("staff_role_assignments")
        .insert({
          school_id:   schoolId,
          profile_id:  userId,
          role_id:     initialRoleId,
          assigned_by: actorProfileId,
          notes:       "Assigned on registration",
        });

      if (roleAssignError) {
        // Non-fatal: the admin can assign the role manually from the portal.
        console.error(
          "[addTeacher] Role assignment failed (non-fatal):",
          roleAssignError.message
        );
      }
    }

    // ── 6. Sync JWT claims ─────────────────────────────────────────────────
    const { error: jwtError } = await supabaseAdmin.rpc(
      "sync_user_jwt_claims",
      { p_profile_id: userId }
    );
    if (jwtError) {
      console.error("[addTeacher] JWT sync failed (non-fatal):", jwtError.message);
    }

    // ── 7. Audit log ───────────────────────────────────────────────────────
    await supabaseAdmin.from("security_audit_logs").insert({
      school_id:    schoolId,
      actor_id:     actorProfileId,
      target_id:    userId,
      action_type:  "INSERT",
      target_table: "teachers",
      record_id:    generatedTeacherId,
      old_values:   null,
      new_values:   {
        teacher_id:    generatedTeacherId,
        staff_id:      generatedStaffId,
        full_name:     fullName,
        email,
        tsc_number:    tscNumber || null,
        school_id:     schoolId,
        system_role:   SYSTEM_ROLE,
        // admin_role is null on the profile; role details live in
        // staff_role_assignments if isAdminStaff was true
        admin_role_id: isAdminStaff ? (initialRoleId ?? null) : null,
      },
      context: {
        description:      `Teacher "${fullName}" (${generatedStaffId}) registered`,
        actor_profile_id: actorProfileId,
        has_staff_role:   isAdminStaff,
      },
    });

    // ── 8. Send welcome email with magic link ──────────────────────────────
    const { data: linkData, error: linkError } =
      await supabaseAdmin.auth.admin.generateLink({
        type:    "magiclink",
        email,
        options: { redirectTo: getAuthConfirmUrl() },
      });

    if (linkError) throw linkError;

    await sendTeacherWelcomeEmail({
      teacherEmail: email,
      teacherName:  fullName,
      setupLink:    linkData.properties.action_link,
    });

    revalidatePath("/admin/teachers");
    revalidatePath("/admin/dashboard");

    return {
      success: true,
      message: `${fullName} registered successfully. Staff ID: ${generatedStaffId}`,
    };

  } catch (error) {
    const msg =
      error instanceof Error ? error.message : "An unknown internal error occurred";
    console.error("[addTeacherAction] failed:", msg);
    return { success: false, message: msg };
  }
}