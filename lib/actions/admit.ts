"use server";

import { createServerClient } from "@/lib/supabase/client";
import { AdmissionActionResult, admissionSchema } from "../schemas/admission";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function admitStudentAction(
  formData: FormData,
): Promise<AdmissionActionResult> {
  // 1. Extract raw values from FormData
  const raw = {
    studentName: formData.get("studentName"),
    dateOfBirth: formData.get("dateOfBirth"),
    gender: formData.get("gender"),
    currentGrade: formData.get("currentGrade"),
    parentPhone: formData.get("parentPhone"),
  };

  // 2. Validate with Zod
  const parsed = admissionSchema.safeParse(raw);

  if (!parsed.success) {
    const firstError = parsed.error.issues[0]?.message ?? "Validation failed.";
    return { success: false, message: firstError };
  }

  const { studentName, dateOfBirth, gender, currentGrade, parentPhone } =
    parsed.data;

  const supabase = createServerClient();

  // Variable to store result for redirect logic outside try/catch
  let isSuccessful = false;

  try {
    // 3. Upsert parent by phone number
    const { data: existingParents, error: parentFetchError } = await supabase
      .from("parents")
      .select("id")
      .eq("phone_number", parentPhone)
      .limit(1);

    if (parentFetchError) {
      console.error("Parent fetch error:", parentFetchError);
      return {
        success: false,
        message: "Failed to look up parent record. Please try again.",
      };
    }

    let parentId: string;

    if (existingParents && existingParents.length > 0 && existingParents[0]) {
      parentId = existingParents[0].id;
    } else {
      const { data: newParent, error: parentInsertError } = await supabase
        .from("parents")
        .insert({
          full_name: "To be updated",
          email: `${parentPhone.replace(/\D/g, "")}@placeholder.local`,
          phone_number: parentPhone,
        })
        .select("id")
        .single();

      if (parentInsertError || !newParent) {
        console.error("Parent insert error:", parentInsertError);
        return {
          success: false,
          message:
            "Failed to register parent. The phone number may already be linked.",
        };
      }

      parentId = newParent.id;
    }

    // 4. Insert student
    const { data: student, error: studentInsertError } = await supabase
      .from("students")
      .insert({
        full_name: studentName,
        date_of_birth: dateOfBirth,
        gender: gender,
        current_grade: currentGrade,
        parent_id: parentId,
      })
      .select("id, readable_id")
      .single();

    if (studentInsertError || !student) {
      console.error("Student insert error:", studentInsertError);
      return {
        success: false,
        message: "Failed to admit student. Please try again.",
      };
    }

    // Success path
    isSuccessful = true;
  } catch (err) {
    console.error("Unexpected error in admitStudentAction:", err);
    return {
      success: false,
      message: "An unexpected error occurred. Please try again.",
    };
  }

  // 5. Final Step: Revalidate and Redirect
  // This must happen outside try/catch for Next.js to handle the redirect properly
  if (isSuccessful) {
    revalidatePath("/dashboard");
    redirect("/dashboard");
  }

  return { success: false, message: "Admission could not be completed." };
}
