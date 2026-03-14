"use server";

// lib/actions/applications.ts
// Admin-side actions for reviewing public_applications.

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getSession } from "@/lib/actions/auth";

// ── Types ─────────────────────────────────────────────────────────────────────

export type ApplicationStatus =
  | "pending"
  | "reviewing"
  | "approved"
  | "declined";

export interface PublicApplication {
  id: string;
  reference_number: string;
  student_first_name: string;
  student_last_name: string;
  student_gender: string;
  student_dob: string;
  current_grade: string;
  applying_for_grade: string;
  parent_first_name: string;
  parent_last_name: string;
  parent_email: string;
  parent_phone: string;
  parent_relationship: string;
  address: string | null;
  city: string | null;
  postal_code: string | null;
  previous_school: string | null;
  special_needs: string | null;
  interests: string | null;
  status: ApplicationStatus;
  admin_notes: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  converted_student_id: string | null;
  created_at: string;
}

export interface ApplicationsResult {
  data: PublicApplication[];
  count: number;
}

// ── Fetch list ────────────────────────────────────────────────────────────────

export async function fetchApplications(
  status?: ApplicationStatus | "all",
  page = 1,
  pageSize = 20,
): Promise<ApplicationsResult> {
  const supabase = await createSupabaseServerClient();

  let query = supabase
    .from("public_applications")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1);

  if (status && status !== "all") {
    query = query.eq("status", status);
  }

  const { data, error, count } = await query;

  if (error) {
    console.error("fetchApplications error:", error.message);
    return { data: [], count: 0 };
  }

  return { data: (data ?? []) as PublicApplication[], count: count ?? 0 };
}

// ── Fetch single ──────────────────────────────────────────────────────────────

export async function fetchApplication(
  id: string,
): Promise<PublicApplication | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("public_applications")
    .select("*")
    .eq("id", id)
    .single();
  if (error) return null;
  return data as PublicApplication;
}

// ── Update status ─────────────────────────────────────────────────────────────

export async function updateApplicationStatus(
  id: string,
  status: ApplicationStatus,
  adminNotes?: string,
): Promise<{ success: boolean; message: string }> {
  const session = await getSession();
  if (!session || !["admin", "superadmin"].includes(session.profile.role)) {
    return { success: false, message: "Unauthorised" };
  }

  const { error } = await supabaseAdmin
    .from("public_applications")
    .update({
      status,
      admin_notes: adminNotes ?? null,
      reviewed_by: session.profile.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    return { success: false, message: error.message };
  }

  revalidatePath("/admin/applications");
  return { success: true, message: `Application marked as ${status}.` };
}

// ── Convert approved application → admitted student ───────────────────────────
// Calls the existing admit flow via supabaseAdmin directly (skips form layer).

export async function convertApplicationToStudent(
  applicationId: string,
): Promise<{ success: boolean; message: string }> {
  const session = await getSession();
  if (!session || !["admin", "superadmin"].includes(session.profile.role)) {
    return { success: false, message: "Unauthorised" };
  }

  const app = await fetchApplication(applicationId);
  if (!app) return { success: false, message: "Application not found." };
  if (app.status !== "approved") {
    return {
      success: false,
      message: "Only approved applications can be converted.",
    };
  }
  if (app.converted_student_id) {
    return { success: false, message: "Already converted to a student." };
  }

  try {
    // 1. Check for duplicate parent email
    const { data: existingParent } = await supabaseAdmin
      .from("parents")
      .select("id")
      .eq("email", app.parent_email)
      .maybeSingle();

    let parentId: string;

    if (existingParent) {
      parentId = existingParent.id;
    } else {
      // 2a. Create auth user
      const { data: authData, error: authError } =
        await supabaseAdmin.auth.admin.createUser({
          email: app.parent_email,
          email_confirm: true,
          user_metadata: {
            full_name: `${app.parent_first_name} ${app.parent_last_name}`,
            role: "parent",
          },
        });
      if (authError) throw new Error(authError.message);
      parentId = authData.user.id;

      // 2b. Create parents row
      const { error: parentError } = await supabaseAdmin
        .from("parents")
        .insert({
          id: parentId,
          full_name: `${app.parent_first_name} ${app.parent_last_name}`,
          email: app.parent_email,
          phone_number: app.parent_phone,
          invite_accepted: false,
        });
      if (parentError) {
        await supabaseAdmin.auth.admin.deleteUser(parentId);
        throw new Error(parentError.message);
      }

      // 2c. Generate & send welcome email (non-fatal)
      try {
        const { sendWelcomeEmail } = await import("@/lib/mail");
        const { data: linkData } = await supabaseAdmin.auth.admin.generateLink({
          type: "recovery",
          email: app.parent_email,
          options: {
            redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/confirm`,
          },
        });
        await sendWelcomeEmail({
          parentEmail: app.parent_email,
          parentName: `${app.parent_first_name} ${app.parent_last_name}`,
          studentName: `${app.student_first_name} ${app.student_last_name}`,
          grade: app.applying_for_grade,
          setupLink: linkData.properties?.action_link ?? "",
        });
      } catch (mailErr) {
        console.error("Welcome email failed:", mailErr);
      }
    }

    // 3. Insert student
    const { data: newStudent, error: studentError } = await supabaseAdmin
      .from("students")
      .insert({
        full_name: `${app.student_first_name} ${app.student_last_name}`,
        date_of_birth: app.student_dob,
        gender:
          app.student_gender === "male"
            ? "Male"
            : app.student_gender === "female"
              ? "Female"
              : "Male",
        current_grade: app.applying_for_grade,
      })
      .select("id")
      .single();

    if (studentError || !newStudent)
      throw new Error(studentError?.message ?? "Student insert failed");

    // 4. Link
    const { error: linkError } = await supabaseAdmin
      .from("student_parents")
      .insert({
        student_id: newStudent.id,
        parent_id: parentId,
        relationship_type: app.parent_relationship,
        is_primary_contact: true,
      });
    if (linkError) {
      await supabaseAdmin.from("students").delete().eq("id", newStudent.id);
      throw new Error(linkError.message);
    }

    // 5. Mark application as converted
    await supabaseAdmin
      .from("public_applications")
      .update({ converted_student_id: newStudent.id })
      .eq("id", applicationId);

    revalidatePath("/admin/applications");
    revalidatePath("/admin/students");
    return {
      success: true,
      message: "Student admitted and parent invited successfully.",
    };
  } catch (err: any) {
    return { success: false, message: err.message };
  }
}
