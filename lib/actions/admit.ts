"use server";

import { createClient } from "@supabase/supabase-js";
import { AdmissionActionResult, admissionSchema } from "../schemas/admission";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { sendWelcomeEmail } from "@/lib/mail";

// Administrative client to bypass RLS and create Auth Users
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

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
    // 1. Check if Parent already exists (Look up by email for reliability)
    const { data: existingParent, error: lookupError } = await supabaseAdmin
      .from("parents")
      .select("id")
      .eq("email", parentEmail)
      .maybeSingle();

    if (lookupError)
      throw new Error(`Database lookup failed: ${lookupError.message}`);

    let parentUserId: string;
    let isNewParent = false;
    const tempPassword = "Parent" + parentPhone.slice(-4);

    if (existingParent) {
      parentUserId = existingParent.id;
    } else {
      isNewParent = true;

      // 2. Create actual Auth User for the Parent
      // This triggers your SQL 'handle_new_user()' function automatically
      const { data: newAuthUser, error: authError } =
        await supabaseAdmin.auth.admin.createUser({
          email: parentEmail,
          phone: parentPhone,
          password: tempPassword,
          email_confirm: true,
          user_metadata: {
            full_name: parentName,
            role: "parent",
          },
        });

      if (authError)
        throw new Error(`Auth creation failed: ${authError.message}`);

      parentUserId = newAuthUser.user.id;

      // 3. Insert into the Parents table (linked by Auth ID)
      const { error: parentError } = await supabaseAdmin
        .from("parents")
        .insert({
          id: parentUserId,
          full_name: parentName,
          email: parentEmail,
          phone_number: parentPhone,
        });

      if (parentError) {
        // Cleanup Auth user if DB insert fails to prevent orphaned accounts
        await supabaseAdmin.auth.admin.deleteUser(parentUserId);
        throw new Error(
          `Parent profile creation failed: ${parentError.message}`,
        );
      }
    }

    // 4. Insert Student linked to the Parent's ID
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

    // 5. Send Welcome Email via Resend if it's a new account
    if (isNewParent) {
      try {
        await sendWelcomeEmail({
          parentEmail,
          parentName,
          studentName,
          tempPassword,
        });
      } catch (mailErr) {
        // We log mail errors but don't stop the process since the DB is already updated
        console.error("Mail Delivery Failed:", mailErr);
      }
    }

    // Revalidate paths to refresh dashboard data
    revalidatePath("/students");
    revalidatePath("/parents");
  } catch (err: any) {
    console.error("Admission Error:", err.message);
    return {
      success: false,
      message: err.message || "An unexpected error occurred.",
    };
  }

  // Redirect to students list on success
  redirect("/students");
}
