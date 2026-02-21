"use server";

import { createClient } from "@supabase/supabase-js";
import { AdmissionActionResult, admissionSchema } from "../schemas/admission";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

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
    parentEmail: formData.get("parentEmail"), // Added this to your schema/form
    parentName: formData.get("parentName"), // Added this to your schema/form
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
    // 1. Check if Parent already exists in Auth/Profiles
    const { data: existingProfile } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("role", "parent")
      .filter(
        "id",
        "in",
        supabaseAdmin
          .from("parents")
          .select("id")
          .eq("phone_number", parentPhone),
      )
      .single();

    let parentUserId: string;

    if (existingProfile) {
      parentUserId = existingProfile.id;
    } else {
      // 2. Create actual Auth User for the Parent
      // This triggers your SQL 'handle_new_user()' function automatically
      const { data: newAuthUser, error: authError } =
        await supabaseAdmin.auth.admin.createUser({
          email: parentEmail,
          phone: parentPhone,
          password: "Parent" + parentPhone.slice(-4), // Temporary password: Parent + last 4 digits
          email_confirm: true,
          user_metadata: {
            full_name: parentName,
            role: "parent",
          },
        });

      if (authError)
        throw new Error(`Auth creation failed: ${authError.message}`);
      parentUserId = newAuthUser.user.id;

      // 3. Insert into the Parents table (linked by ID)
      const { error: parentError } = await supabaseAdmin
        .from("parents")
        .insert({
          id: parentUserId, // Use the Auth ID as the PK
          full_name: parentName,
          email: parentEmail,
          phone_number: parentPhone,
        });

      if (parentError) throw parentError;
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

    if (studentError) throw studentError;

    revalidatePath("/dashboard/students");
    revalidatePath("/dashboard/parents");
  } catch (err: any) {
    console.error("Admission Error:", err.message);
    return {
      success: false,
      message: err.message || "An unexpected error occurred.",
    };
  }

  redirect("/dashboard/students");
}
