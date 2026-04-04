"use server";

import { sendWelcomeEmail } from "@/lib/mail";
import { revalidatePath } from "next/cache";
import {
  admissionSchema,
  type AdmissionActionResult,
} from "../schemas/admission";
import { supabaseAdmin } from "../supabase/admin";
import { getAuthConfirmUrl } from "../utils/site-url";
import { normalizeKenyanPhone, KENYAN_PHONE_REGEX } from "../utils/phone";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ParentSearchResult {
  id: string;
  full_name: string;
  email: string;
  phone_number: string | null;
  children: { id: string; full_name: string; current_grade: string }[];
}

// ── Parent Search ─────────────────────────────────────────────────────────────

export async function searchParentsAction(
  query: string,
): Promise<{ success: boolean; data: ParentSearchResult[]; message?: string }> {
  if (!query || query.trim().length < 2) {
    return { success: true, data: [] };
  }

  const q = query.trim();

  try {
    const { data, error } = await supabaseAdmin
      .from("parents")
      .select(
        `id, full_name, email, phone_number,
        student_parents (
          students ( id, full_name, current_grade )
        )`,
      )
      .or(`full_name.ilike.%${q}%,email.ilike.%${q}%,phone_number.ilike.%${q}%`)
      .order("full_name")
      .limit(8);

    if (error) throw error;

    const results: ParentSearchResult[] = (data ?? []).map((p: any) => ({
      id: p.id,
      full_name: p.full_name,
      email: p.email,
      phone_number: p.phone_number,
      children: (p.student_parents ?? [])
        .map((sp: any) => sp.students)
        .filter(Boolean),
    }));

    return { success: true, data: results };
  } catch (err: any) {
    console.error("[SearchParents] Error:", err.message);
    return { success: false, data: [], message: err.message };
  }
}

// ── Admit Student ─────────────────────────────────────────────────────────────

export async function admitStudentAction(
  formData: FormData,
): Promise<AdmissionActionResult> {
  const existingParentId =
    (formData.get("existingParentId") as string | null) || null;

  const raw = {
    studentName: formData.get("studentName"),
    dateOfBirth: formData.get("dateOfBirth"),
    gender: formData.get("gender"),
    currentGrade: formData.get("currentGrade"),
    relationshipType: formData.get("relationshipType") ?? "guardian",
    existingParentId: existingParentId,
    parentName: formData.get("parentName") || null,
    parentEmail: formData.get("parentEmail") || null,
    parentPhone: formData.get("parentPhone") || null,
  };

  const parsed = admissionSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      success: false,
      message: parsed.error.issues[0]?.message ?? "Validation failed.",
    };
  }

  const d = parsed.data;

  // ── Validation for new parents ──────────────────────────────────────────────
  if (!existingParentId) {
    if (
      !d.parentName?.trim() ||
      !d.parentEmail?.trim() ||
      !d.parentPhone?.trim()
    ) {
      return { success: false, message: "Parent details are required." };
    }
    if (!KENYAN_PHONE_REGEX.test(d.parentPhone.replace(/\s/g, ""))) {
      return { success: false, message: "Enter a valid Kenyan phone number." };
    }
  }

  try {
    let parentId: string;
    let isNewParent = false;

    // ── 1. Resolve Parent ─────────────────────────────────────────────────────
    if (existingParentId) {
      parentId = existingParentId;
    } else {
      const email = d.parentEmail!.toLowerCase();
      const phone = normalizeKenyanPhone(d.parentPhone!);

      // Pre-check for duplicate email/phone in DB
      const { data: existing } = await supabaseAdmin
        .from("parents")
        .select("id")
        .or(`email.eq.${email},phone_number.eq.${phone}`)
        .maybeSingle();

      if (existing) {
        return {
          success: false,
          message: "A parent with this email or phone already exists.",
        };
      }

      // Create Auth User
      const { data: authUser, error: authError } =
        await supabaseAdmin.auth.admin.createUser({
          email,
          phone,
          email_confirm: true,
          user_metadata: { full_name: d.parentName, role: "parent" },
        });

      if (authError) throw new Error(`Auth failed: ${authError.message}`);
      parentId = authUser.user.id;
      isNewParent = true;

      // UPSERT to handle race conditions with DB triggers and ensure phone is saved
      const { error: upsertErr } = await supabaseAdmin.from("parents").upsert({
        id: parentId,
        full_name: d.parentName,
        email,
        phone_number: phone,
      });

      if (upsertErr)
        throw new Error(`Parent setup failed: ${upsertErr.message}`);
    }

    // ── 2. Register Student ───────────────────────────────────────────────────
    const { data: newStudent, error: studentError } = await supabaseAdmin
      .from("students")
      .insert({
        full_name: d.studentName,
        date_of_birth: d.dateOfBirth,
        gender: d.gender,
        current_grade: d.currentGrade,
      })
      .select("id")
      .single();

    if (studentError || !newStudent)
      throw new Error("Student registration failed.");

    // ── 3. Handle Passport Photo ──────────────────────────────────────────────
    const photoFile = formData.get("passportPhoto") as File | null;
    if (photoFile && photoFile.size > 0) {
      const ext = photoFile.type.split("/")[1] || "jpg";
      const path = `photos/${newStudent.id}.${ext}`;
      const buffer = Buffer.from(await photoFile.arrayBuffer());

      const { error: uploadError } = await supabaseAdmin.storage
        .from("student-photos")
        .upload(path, buffer, { contentType: photoFile.type, upsert: true });

      if (!uploadError) {
        await supabaseAdmin
          .from("students")
          .update({ photo_url: path })
          .eq("id", newStudent.id);
      }
    }

    // ── 4. Link Student & Parent ──────────────────────────────────────────────
    const { error: linkErr } = await supabaseAdmin
      .from("student_parents")
      .insert({
        student_id: newStudent.id,
        parent_id: parentId,
        relationship_type: d.relationshipType as any,
        is_primary_contact: true,
      });

    if (linkErr) {
      await supabaseAdmin.from("students").delete().eq("id", newStudent.id);
      throw new Error("Failed to link student to parent.");
    }

    // ── 5. Welcome Email ──────────────────────────────────────────────────────
    if (isNewParent) {
      const { data: linkData } = await supabaseAdmin.auth.admin.generateLink({
        type: "magiclink",
        email: d.parentEmail!.toLowerCase(),
        options: { redirectTo: getAuthConfirmUrl() },
      });

      if (linkData?.properties?.action_link) {
        try {
          await sendWelcomeEmail({
            parentEmail: d.parentEmail!,
            parentName: d.parentName!,
            studentName: d.studentName,
            grade: d.currentGrade,
            setupLink: linkData.properties.action_link,
          });
        } catch (e) {
          console.error("Email send failed:", e);
        }
      }
    }

    revalidatePath("/admin/students");
    revalidatePath("/admin/dashboard");

    return {
      success: true,
      message: "Student admitted successfully.",
      studentId: newStudent.id,
    };
  } catch (err: any) {
    return {
      success: false,
      message: err.message || "An unexpected error occurred.",
    };
  }
}

// ── Resend Invite ─────────────────────────────────────────────────────────────

export async function resendInviteAction(parentId: string) {
  try {
    const { data: parent, error: pError } = await supabaseAdmin
      .from("parents")
      .select(
        `
        email, full_name,
        student_parents (
          students ( full_name, current_grade )
        )
      `,
      )
      .eq("id", parentId)
      .single();

    if (pError || !parent) throw new Error("Parent record not found.");

    const { data: linkData, error: linkError } =
      await supabaseAdmin.auth.admin.generateLink({
        type: "magiclink",
        email: parent.email,
        options: { redirectTo: getAuthConfirmUrl() },
      });

    if (linkError) throw linkError;

    const firstChild = (parent.student_parents as any[])?.[0]?.students;

    await sendWelcomeEmail({
      parentEmail: parent.email,
      parentName: parent.full_name,
      studentName: firstChild?.full_name ?? "your child",
      grade: firstChild?.current_grade ?? "—",
      setupLink: linkData.properties.action_link,
    });

    return { success: true, message: "A new secure invite has been sent." };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
}

// ── Independent Photo Upload (For manual updates) ─────────────────────────────

export async function uploadStudentPhotoAction(
  studentId: string,
  formData: FormData,
): Promise<{ success: boolean; message: string; photo_url?: string }> {
  const file = formData.get("photo") as File | null;
  if (!file || file.size === 0)
    return { success: false, message: "No file provided." };
  if (file.size > 2 * 1024 * 1024)
    return { success: false, message: "Photo must be under 2 MB." };

  const ext = file.type.split("/")[1] || "jpg";
  const path = `photos/${studentId}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: uploadError } = await supabaseAdmin.storage
    .from("student-photos")
    .upload(path, buffer, { contentType: file.type, upsert: true });

  if (uploadError) return { success: false, message: "Photo upload failed." };

  const { error: updateError } = await supabaseAdmin
    .from("students")
    .update({ photo_url: path })
    .eq("id", studentId);

  if (updateError)
    return { success: false, message: "Could not update record." };

  revalidatePath("/admin/students");
  return { success: true, message: "Photo saved.", photo_url: path };
}
