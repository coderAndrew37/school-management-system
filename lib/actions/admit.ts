"use server";

import { sendWelcomeEmail } from "@/lib/mail";
import { createClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { AdmissionActionResult, admissionSchema } from "../schemas/admission";

// Administrative client to bypass RLS and create Auth Users
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

/**
 * ADMIT STUDENT ACTION
 * Handles: Parent creation, Auth account setup, Student linking, and Email dispatch.
 */
export async function admitStudentAction(
  formData: FormData,
): Promise<AdmissionActionResult> {
  const raw = {
    studentName: formData.get("studentName"),
    dateOfBirth: formData.get("dateOfBirth"),
    gender: formData.get("gender"),
    currentGrade: formData.get("currentGrade"),
    parentPhone: formData.get("parentPhone"),
    parentEmail: formData.get("parentEmail"),
    parentName: formData.get("parentName"),
  };

  const parsed = admissionSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      success: false,
      message: parsed.error.issues[0]?.message ?? "Validation failed.",
    };
  }

  const {
    studentName,
    dateOfBirth,
    gender,
    currentGrade,
    parentPhone,
    parentEmail,
    parentName,
  } = parsed.data;

  try {
    // 1. Check if Parent already exists
    const { data: existingParent, error: lookupError } = await supabaseAdmin
      .from("parents")
      .select("id")
      .eq("email", parentEmail)
      .maybeSingle();

    if (lookupError)
      throw new Error(`Database lookup failed: ${lookupError.message}`);

    let parentUserId: string;
    let isNewParent = false;

    if (existingParent) {
      parentUserId = existingParent.id;
    } else {
      isNewParent = true;

      // 2. Create Auth User for the Parent (No password set yet)
      const { data: newAuthUser, error: authError } =
        await supabaseAdmin.auth.admin.createUser({
          email: parentEmail,
          phone: parentPhone,
          email_confirm: true,
          user_metadata: {
            full_name: parentName,
            role: "parent",
          },
        });

      if (authError)
        throw new Error(`Auth creation failed: ${authError.message}`);

      parentUserId = newAuthUser.user.id;

      // 3. Insert into the Parents table
      const { error: parentError } = await supabaseAdmin
        .from("parents")
        .insert({
          id: parentUserId,
          full_name: parentName,
          email: parentEmail,
          phone_number: parentPhone,
          invite_accepted: false, // Track onboarding status
        });

      if (parentError) {
        // Cleanup Auth user if DB insert fails
        await supabaseAdmin.auth.admin.deleteUser(parentUserId);
        throw new Error(
          `Parent profile creation failed: ${parentError.message}`,
        );
      }

      // 4. Generate Professional Setup Link (Recovery Link)
      const { data: linkData, error: linkError } =
        await supabaseAdmin.auth.admin.generateLink({
          type: "recovery",
          email: parentEmail,
          options: {
            // Redirects to the PKCE callback route
            redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback?type=recovery`,
          },
        });

      if (linkError)
        throw new Error(`Setup link generation failed: ${linkError.message}`);

      // 5. CRITICAL FIX: Convert Fragment (#) to Query (?)
      // This ensures your server-side callback route can read the code.
      let setupLink = linkData.properties.action_link;
      if (setupLink.includes("#")) {
        setupLink = setupLink.replace("#", "?");
      }

      // 6. Send Welcome Email via Resend
      try {
        await sendWelcomeEmail({
          parentEmail,
          parentName,
          studentName,
          setupLink: setupLink,
        });
      } catch (mailErr) {
        console.error("Mail Delivery Failed:", mailErr);
      }
    }

    // 7. Insert Student linked to the Parent
    const { error: studentError } = await supabaseAdmin
      .from("students")
      .insert({
        full_name: studentName,
        date_of_birth: dateOfBirth,
        gender: gender,
        current_grade: currentGrade,
        parent_id: parentUserId,
      });

    if (studentError)
      throw new Error(`Student registration failed: ${studentError.message}`);

    revalidatePath("/students");
    revalidatePath("/parents");
  } catch (err: any) {
    console.error("Admission Error:", err.message);
    return {
      success: false,
      message: err.message || "An unexpected error occurred.",
    };
  }

  redirect("/students");
}

/**
 * RESEND INVITE ACTION
 * Allows admins to trigger a fresh secure link for existing parents.
 */
export async function resendInviteAction(parentId: string) {
  try {
    const { data: parent, error: pError } = await supabaseAdmin
      .from("parents")
      .select("email, full_name, students(full_name)")
      .eq("id", parentId)
      .single();

    if (pError || !parent) throw new Error("Parent record not found.");

    const { data: linkData, error: linkError } =
      await supabaseAdmin.auth.admin.generateLink({
        type: "recovery",
        email: parent.email,
        options: {
          redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback?type=recovery`,
        },
      });

    if (linkError) throw linkError;

    // Apply the Fragment to Query fix here as well
    let setupLink = linkData.properties.action_link;
    if (setupLink.includes("#")) {
      setupLink = setupLink.replace("#", "?");
    }

    await sendWelcomeEmail({
      parentEmail: parent.email,
      parentName: parent.full_name,
      studentName: parent.students?.[0]?.full_name || "your child",
      setupLink: setupLink,
    });

    return { success: true, message: "A new secure invite has been sent." };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
}
